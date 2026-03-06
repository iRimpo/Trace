/**
 * GLTF character bone retargeting for pose overlay.
 *
 * Architecture:
 * - Professional's BlazePose world landmarks (wx/wy/wz, meters) provide
 *   bone direction vectors — only angles, no positions.
 * - Each bone's local quaternion is set to align its rest axis (Y-up for
 *   Mixamo rigs) with the world-landmark direction vector.
 * - The character's proportions (bone lengths) come entirely from the GLB;
 *   they are never scaled to match the user's body.
 * - The root (Hips) is positioned + uniformly scaled in screen space so
 *   the character appears anchored to the user's detected hip position.
 */

import * as THREE from "three";
import { Keypoint } from "./mediapipe";

// ── Mixamo bone name prefix ───────────────────────────────────────────
const P = "mixamorig:";

// ── Bone → [fromKeypoint, toKeypoint] direction pairs ────────────────
// Each entry drives that bone's rotation so its local Y-axis points
// from keypoints[from].world toward keypoints[to].world.
// null = no drive (bone stays at rest/identity).

export const BONE_DRIVES: Record<string, [number, number] | null> = {
  [`${P}Hips`]:           null, // root — positioned manually

  // Spine: hip-midpoint → shoulder-midpoint direction via Spine bone
  // We map to index pair (23→11) which means "L_HIP → L_SHOULDER" as proxy
  [`${P}Spine`]:          [23, 11],
  [`${P}Spine1`]:         null, // leave at rest (Spine handles all torso bend)
  [`${P}Spine2`]:         null,

  // Neck / Head
  [`${P}Neck`]:           [11, 0],  // shoulder midpoint → nose
  [`${P}Head`]:           null,     // leave at rest (neck handles head tilt)

  // Left arm
  [`${P}LeftShoulder`]:   null,
  [`${P}LeftArm`]:        [11, 13], // L_SHOULDER → L_ELBOW
  [`${P}LeftForeArm`]:    [13, 15], // L_ELBOW → L_WRIST
  [`${P}LeftHand`]:       null,     // driven by applyHandPose

  // Right arm
  [`${P}RightShoulder`]:  null,
  [`${P}RightArm`]:       [12, 14],
  [`${P}RightForeArm`]:   [14, 16],
  [`${P}RightHand`]:      null,

  // Left leg
  [`${P}LeftUpLeg`]:      [23, 25], // L_HIP → L_KNEE
  [`${P}LeftLeg`]:        [25, 27], // L_KNEE → L_ANKLE
  [`${P}LeftFoot`]:       [27, 29], // L_ANKLE → L_HEEL
  [`${P}LeftToeBase`]:    null,

  // Right leg
  [`${P}RightUpLeg`]:     [24, 26],
  [`${P}RightLeg`]:       [26, 28],
  [`${P}RightFoot`]:      [28, 30],
  [`${P}RightToeBase`]:   null,
};

// ── Finger bone drives ────────────────────────────────────────────────
// BlazePose provides: wrist(15/16), pinky(17/18), index(19/20), thumb(21/22)
// We drive Bone1 (first phalanx) of each finger from wrist → fingertip.
// Bone2/3/4 stay at rest (natural slight curl from T-pose).

// [boneName, fromKp, toKp]
const LEFT_FINGER_DRIVES: [string, number, number][] = [
  [`${P}LeftHandThumb1`,  15, 21],  // wrist → thumb tip
  [`${P}LeftHandIndex1`,  15, 19],  // wrist → index tip
  // Middle: interpolate between index and pinky
  [`${P}LeftHandMiddle1`, 15, 19],  // use index as approximation
  [`${P}LeftHandRing1`,   15, 17],  // use pinky as approximation
  [`${P}LeftHandPinky1`,  15, 17],  // wrist → pinky tip
];

const RIGHT_FINGER_DRIVES: [string, number, number][] = [
  [`${P}RightHandThumb1`,  16, 22],
  [`${P}RightHandIndex1`,  16, 20],
  [`${P}RightHandMiddle1`, 16, 20],
  [`${P}RightHandRing1`,   16, 18],
  [`${P}RightHandPinky1`,  16, 18],
];

// ── Reusable temporaries (avoid per-frame GC) ─────────────────────────
const _from  = new THREE.Vector3();
const _to    = new THREE.Vector3();
const _dir   = new THREE.Vector3();
const _yUp   = new THREE.Vector3(0, 1, 0);
const _worldQ = new THREE.Quaternion();
const _parentInvQ = new THREE.Quaternion();
const _localQ = new THREE.Quaternion();

// ── Collect bones from a loaded GLTF ────────────────────────────────

/**
 * Traverse a GLTF scene and collect all Bone objects into a flat map
 * keyed by bone.name.
 */
export function collectBones(
  root: THREE.Object3D
): Record<string, THREE.Bone> {
  const map: Record<string, THREE.Bone> = {};
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      map[obj.name] = obj as THREE.Bone;
    }
  });
  return map;
}

// ── Measure character rest height ────────────────────────────────────

/**
 * Measure the character's rest height (hips → head in model units).
 * Called once after loading to derive AR scale.
 */
export function measureCharacterHeight(
  bones: Record<string, THREE.Bone>
): number {
  const hips = bones[`${P}Hips`];
  const head = bones[`${P}Head`];
  if (!hips || !head) return 1;

  // Force world matrix update so positions are valid
  hips.updateWorldMatrix(true, true);

  const hipPos  = new THREE.Vector3();
  const headPos = new THREE.Vector3();
  hips.getWorldPosition(hipPos);
  head.getWorldPosition(headPos);

  return Math.abs(headPos.y - hipPos.y) || 1;
}

// ── Per-bone quaternion from world landmark direction ─────────────────

/**
 * Compute the local quaternion for `bone` such that its Y-axis points
 * along `worldDir`. Applies relative to the parent's current world rotation.
 */
function setBoneFromWorldDir(
  bone: THREE.Bone,
  worldDir: THREE.Vector3,
  lerpAlpha = 0.3
): void {
  if (worldDir.lengthSq() < 1e-6) return;

  // World quaternion: rotate Y-up → worldDir
  _worldQ.setFromUnitVectors(_yUp, worldDir);

  // Convert to local space: localQ = inv(parentWorldQ) × worldQ
  const parent = bone.parent;
  if (parent) {
    parent.getWorldQuaternion(_parentInvQ).invert();
    _localQ.multiplyQuaternions(_parentInvQ, _worldQ);
  } else {
    _localQ.copy(_worldQ);
  }

  // Slerp toward target for temporal smoothing
  bone.quaternion.slerp(_localQ, lerpAlpha);
}

// ── Helper to safely get world landmark as Three.js Vector3 ──────────

function getWorldLandmark(kp: Keypoint | undefined, out: THREE.Vector3): boolean {
  if (!kp || kp.wx == null || kp.wy == null || kp.wz == null) return false;
  // MediaPipe world: x=right, y=up-positive, z=toward-camera
  // Three.js scene (Y-up): we map directly, negate z for depth sense
  // (no x-mirror: CSS scaleX(-1) on the canvas handles the visual flip)
  out.set(kp.wx, -kp.wy, -kp.wz);
  return true;
}

// ── Midpoint world landmark ───────────────────────────────────────────

function midWorldLandmark(
  a: Keypoint | undefined,
  b: Keypoint | undefined,
  out: THREE.Vector3
): boolean {
  if (!getWorldLandmark(a, _from)) return false;
  if (!getWorldLandmark(b, _to))   return false;
  out.addVectors(_from, _to).multiplyScalar(0.5);
  return true;
}

// ── Main pose retargeting ─────────────────────────────────────────────

/**
 * Drive the character skeleton from professional's BlazePose world landmarks.
 * Only bone rotations are set — bone lengths come from the GLB rest pose.
 *
 * @param bones    Bone map from collectBones()
 * @param kps      Professional's keypoints (must have wx/wy/wz populated)
 * @param minConf  Minimum visibility score to use a keypoint pair
 * @param lerpAlpha Slerp speed (0 = frozen, 1 = instant snap)
 */
export function applyPoseToRig(
  bones: Record<string, THREE.Bone>,
  kps: Keypoint[],
  minConf  = 0.25,
  lerpAlpha = 0.3
): void {
  // Update world matrices from root down (parent-first order guaranteed by
  // the bone hierarchy, but we need at least the hips to be current)
  bones[`${P}Hips`]?.updateWorldMatrix(true, false);

  for (const [boneName, pair] of Object.entries(BONE_DRIVES)) {
    if (!pair) continue;
    const bone = bones[boneName];
    if (!bone) continue;

    const [fromIdx, toIdx] = pair;

    // Special case: Spine uses midpoints (hip-mid → shoulder-mid)
    if (boneName === `${P}Spine`) {
      const lHip = kps[23];
      const rHip = kps[24];
      const lSh  = kps[11];
      const rSh  = kps[12];

      const hipConf = Math.min(lHip?.score ?? 0, rHip?.score ?? 0);
      const shConf  = Math.min(lSh?.score  ?? 0, rSh?.score  ?? 0);
      if (hipConf < minConf || shConf < minConf) continue;

      if (!midWorldLandmark(lHip, rHip, _from)) continue;
      if (!midWorldLandmark(lSh,  rSh,  _to))   continue;

      _dir.subVectors(_to, _from).normalize();
      bone.updateWorldMatrix(true, false);
      setBoneFromWorldDir(bone, _dir, lerpAlpha);
      bone.updateMatrixWorld();
      continue;
    }

    // Neck: shoulder-mid → nose
    if (boneName === `${P}Neck`) {
      const lSh  = kps[11];
      const rSh  = kps[12];
      const nose = kps[0];

      if (
        (lSh?.score ?? 0)  < minConf ||
        (rSh?.score ?? 0)  < minConf ||
        (nose?.score ?? 0) < minConf
      ) continue;

      if (!midWorldLandmark(lSh, rSh, _from)) continue;
      if (!getWorldLandmark(nose, _to))        continue;

      _dir.subVectors(_to, _from).normalize();
      bone.updateWorldMatrix(true, false);
      setBoneFromWorldDir(bone, _dir, lerpAlpha * 0.5); // neck moves slowly
      bone.updateMatrixWorld();
      continue;
    }

    // General case: fromIdx → toIdx
    const kpFrom = kps[fromIdx];
    const kpTo   = kps[toIdx];
    if (
      !kpFrom || !kpTo ||
      (kpFrom.score ?? 0) < minConf ||
      (kpTo.score   ?? 0) < minConf
    ) continue;

    if (!getWorldLandmark(kpFrom, _from)) continue;
    if (!getWorldLandmark(kpTo,   _to))   continue;

    _dir.subVectors(_to, _from).normalize();
    bone.updateWorldMatrix(true, false);
    setBoneFromWorldDir(bone, _dir, lerpAlpha);
    bone.updateMatrixWorld();
  }
}

// ── Hand / finger pose ────────────────────────────────────────────────

/**
 * Drive Bone1 of each finger from the professional's fingertip world landmarks.
 * Bone2/3/4 keep the GLB's natural rest-pose curl.
 */
export function applyHandPose(
  bones: Record<string, THREE.Bone>,
  kps: Keypoint[],
  side: "Left" | "Right",
  minConf  = 0.2,
  lerpAlpha = 0.3
): void {
  const drives = side === "Left" ? LEFT_FINGER_DRIVES : RIGHT_FINGER_DRIVES;

  for (const [boneName, fromIdx, toIdx] of drives) {
    const bone   = bones[boneName];
    const kpFrom = kps[fromIdx];
    const kpTo   = kps[toIdx];
    if (!bone) continue;
    if (
      !kpFrom || !kpTo ||
      (kpFrom.score ?? 0) < minConf ||
      (kpTo.score   ?? 0) < minConf
    ) continue;

    if (!getWorldLandmark(kpFrom, _from)) continue;
    if (!getWorldLandmark(kpTo,   _to))   continue;

    _dir.subVectors(_to, _from).normalize();
    bone.updateWorldMatrix(true, false);
    setBoneFromWorldDir(bone, _dir, lerpAlpha);
    bone.updateMatrixWorld();
  }
}

// ── AR anchor: position + scale in screen space ───────────────────────

/**
 * Translate and scale the character root so it appears anchored to the user's
 * detected body position on screen.
 *
 * The camera is an OrthographicCamera where 1 Three.js unit = 1 CSS pixel,
 * with origin at the canvas centre.
 *
 * @param characterRoot  The top-level Group/Object3D returned by GLTFLoader
 * @param userKps        User's 2D keypoints (pixel space, mirror-corrected)
 * @param charRestHeight Character's hip-to-head height in model units (from measureCharacterHeight)
 * @param canvasW        Canvas width in pixels
 * @param canvasH        Canvas height in pixels
 */
export function anchorCharacterToUser(
  characterRoot: THREE.Object3D,
  userKps: Keypoint[],
  charRestHeight: number,
  canvasW: number,
  canvasH: number
): void {
  const lHip = userKps[23];
  const rHip = userKps[24];
  const nose = userKps[0];

  if (
    !lHip || !rHip ||
    (lHip.score ?? 0) < 0.25 ||
    (rHip.score ?? 0) < 0.25
  ) return; // no pose data — keep last position

  // Hip centre in pixel space, centred on canvas
  const hipX = (lHip.x + rHip.x) / 2 - canvasW / 2;
  const hipY = -((lHip.y + rHip.y) / 2 - canvasH / 2); // y-up

  characterRoot.position.set(hipX, hipY, 0);

  // Scale: user's apparent body height (hip → nose) / character rest height
  if (nose && (nose.score ?? 0) >= 0.3) {
    const hipMidY = (lHip.y + rHip.y) / 2;
    const userBodyHeight = Math.abs(hipMidY - nose.y) * 1.35; // nose ≈ 85% of full height
    if (userBodyHeight > 20 && charRestHeight > 0) {
      characterRoot.scale.setScalar(userBodyHeight / charRestHeight);
    }
  }
}
