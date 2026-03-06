/**
 * Three.js GLTF character renderer for AR pose overlay.
 *
 * Architecture:
 * - OrthographicCamera whose frustum matches canvas pixel dimensions exactly
 *   (1 Three.js unit = 1 CSS pixel), origin at canvas centre.
 * - A rigged GLTF humanoid character (Mixamo Vanguard) loaded at startup.
 * - Per-frame: professional's world landmarks drive bone rotations (angles
 *   only); user's 2D keypoints anchor the character to the user's body
 *   position on screen.
 * - Rendered to a transparent WebGLRenderer canvas overlaid on the webcam.
 * - CSS scaleX(-1) on the canvas handles the webcam-mirror flip; no manual
 *   x-mirroring is needed in scene coordinates.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Keypoint } from "./mediapipe";
import {
  collectBones,
  measureCharacterHeight,
  applyPoseToRig,
  applyHandPose,
  anchorCharacterToUser,
} from "./characterRig";

// ── Scene state ───────────────────────────────────────────────────────

export interface MeshScene {
  renderer:       THREE.WebGLRenderer;
  scene:          THREE.Scene;
  camera:         THREE.OrthographicCamera;
  character:      THREE.Group | null;
  bones:          Record<string, THREE.Bone>;
  charRestHeight: number;
  loaded:         boolean;
  loadError:      string | null;
}

// ── Model URL ────────────────────────────────────────────────────────

const MODEL_URL = "/models/character.glb";

// ── Scene creation (async) ────────────────────────────────────────────

/**
 * Initialise a Three.js scene on the given canvas and asynchronously load
 * the GLTF character model.
 *
 * Returns a MeshScene immediately (loaded=false) then mutates it in place
 * when the GLB finishes loading.
 */
export function createMeshScene(canvas: HTMLCanvasElement): MeshScene {
  const w = canvas.width  || 640;
  const h = canvas.height || 480;

  // ── Renderer ───────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha:     true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = false;

  // ── Camera ─────────────────────────────────────────────────────
  const camera = new THREE.OrthographicCamera(
    -w / 2, w / 2,
     h / 2, -h / 2,
    -2000,  2000
  );
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);

  // ── Scene + Lights ─────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(0.5, 1, 1);
  scene.add(dirLight);

  // ── Shared state ───────────────────────────────────────────────
  const meshScene: MeshScene = {
    renderer,
    scene,
    camera,
    character:      null,
    bones:          {},
    charRestHeight: 1,
    loaded:         false,
    loadError:      null,
  };

  // ── Async GLB load ─────────────────────────────────────────────
  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      const character = gltf.scene;
      scene.add(character);

      // Make materials transparent so opacity can be controlled
      character.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of mats) {
            const m = mat as THREE.MeshStandardMaterial;
            m.transparent = true;
            m.depthWrite  = false;
          }
        }
      });

      const bones = collectBones(character);
      const charRestHeight = measureCharacterHeight(bones);

      meshScene.character      = character;
      meshScene.bones          = bones;
      meshScene.charRestHeight = charRestHeight;
      meshScene.loaded         = true;

      console.log(
        `[Trace] Character loaded. Rest height: ${charRestHeight.toFixed(3)} units. Bones: ${Object.keys(bones).length}`
      );
    },
    undefined,
    (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      meshScene.loadError = msg;
      console.error("[Trace] GLTF load failed:", msg);
    }
  );

  return meshScene;
}

// ── Per-frame update ──────────────────────────────────────────────────

/**
 * Update the character's pose and AR anchor each frame.
 *
 * @param scene        The MeshScene returned by createMeshScene()
 * @param proKps       Professional's raw keypoints (world landmarks used for bone angles)
 * @param userKps      User's 2D keypoints (pixel space, for AR screen anchoring)
 * @param regionColors Per-region hex colors (drives emissive tint)
 * @param canvasW      Canvas width in pixels
 * @param canvasH      Canvas height in pixels
 * @param opacity      Overall character opacity 0–1
 */
export function updateMeshScene(
  scene:        MeshScene,
  proKps:       Keypoint[],
  userKps:      Keypoint[],
  regionColors: Record<string, string>,
  canvasW:      number,
  canvasH:      number,
  opacity:      number
): void {
  if (!scene.loaded || !scene.character) return;

  // 1. Anchor character to user's body on screen
  anchorCharacterToUser(
    scene.character,
    userKps,
    scene.charRestHeight,
    canvasW,
    canvasH
  );

  // 2. Apply professional's pose to character bones
  applyPoseToRig(scene.bones, proKps);

  // 3. Apply finger poses from professional's fingertip keypoints
  applyHandPose(scene.bones, proKps, "Left");
  applyHandPose(scene.bones, proKps, "Right");

  // 4. Tint + opacity from color feedback
  // MVP: use torso color as overall proxy emissive tint
  const tintHex = regionColors["torso"] ?? "#EC4899";
  const tintColor = new THREE.Color(tintHex);
  // Scale emissive down so it doesn't blow out the texture
  const emissiveColor = tintColor.clone().multiplyScalar(0.35);

  scene.character.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial;
        m.opacity = opacity;
        if (m.emissive) m.emissive.copy(emissiveColor);
      }
    }
  });
}

/** Render the scene. Call once per animation frame after updateMeshScene. */
export function renderMeshScene(scene: MeshScene): void {
  scene.renderer.render(scene.scene, scene.camera);
}

/** Resize the renderer and camera to match new canvas dimensions. */
export function resizeMeshScene(
  scene: MeshScene,
  w: number,
  h: number
): void {
  const { renderer, camera } = scene;
  renderer.setSize(w, h, false);
  camera.left   = -w / 2;
  camera.right  =  w / 2;
  camera.top    =  h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}

/** Dispose all Three.js resources. Call on unmount. */
export function disposeMeshScene(scene: MeshScene): void {
  scene.renderer.dispose();
  if (scene.character) {
    scene.character.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) (mat as THREE.Material).dispose();
      }
    });
  }
}
