import type { Keypoint } from "./mediapipe";

/**
 * Which of several detected bodies is *the* one.
 *
 * The pose landmarker runs with `numPoses: 10` and every caller was taking
 * `landmarks[0]`. MediaPipe does not order results by size, confidence, or
 * anything else stable, so `[0]` is arbitrary — and, worse, it can change
 * between consecutive frames.
 *
 * On a reference video that meant being scored against a random member of the
 * group (fixed separately with DancerTracker, which has a locked identity to
 * follow). On the **user's own webcam** there is no identity to lock, and the
 * failure is just as real: a dancer practising at home is usually facing a
 * mirror, so the reflection is a second full-body pose in frame, roughly as
 * confident as the real one. Picking it — or alternating with it — produces a
 * pose stream that jitters between two bodies a metre apart.
 *
 * The heuristic: the dancer is the *nearest* person to the camera, so they
 * occupy the most of the frame. Bounding-box area is the dominant term, with a
 * mild centre bias to break ties toward whoever the camera is pointed at. A
 * mirror image is farther away and therefore smaller, which is exactly the
 * signal that separates it.
 */

const MIN_KP_SCORE = 0.3;
/** A pose needs this many confident points before it is a body at all. */
const MIN_POINTS = 6;
/** How much the centre bias can matter relative to area. */
const CENTRE_WEIGHT = 0.15;

interface Measured {
  area: number;
  centreX: number;
  confidence: number;
  points: number;
}

function measure(kps: Keypoint[]): Measured | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  let sum = 0, n = 0;
  for (const kp of kps) {
    if (!kp || (kp.score ?? 0) < MIN_KP_SCORE) continue;
    x1 = Math.min(x1, kp.x); y1 = Math.min(y1, kp.y);
    x2 = Math.max(x2, kp.x); y2 = Math.max(y2, kp.y);
    sum += kp.score ?? 0;
    n++;
  }
  if (n < MIN_POINTS) return null;
  return {
    area: Math.max(0, x2 - x1) * Math.max(0, y2 - y1),
    centreX: (x1 + x2) / 2,
    confidence: sum / n,
    points: n,
  };
}

/**
 * @param frameWidth used only for the centre bias; pass 0 to skip it.
 * @returns the chosen pose, or null when no candidate is a plausible body.
 */
export function pickPrimaryPose(
  poses: Keypoint[][] | null,
  frameWidth = 0,
): Keypoint[] | null {
  if (!poses || poses.length === 0) return null;
  if (poses.length === 1) return measure(poses[0]) ? poses[0] : null;

  let best: Keypoint[] | null = null;
  let bestScore = -Infinity;

  for (const pose of poses) {
    const m = measure(pose);
    if (!m) continue;
    // Area dominates; confidence breaks near-ties; centre nudges.
    let score = m.area * m.confidence;
    if (frameWidth > 0) {
      const offCentre = Math.abs(m.centreX - frameWidth / 2) / (frameWidth / 2);
      score *= 1 - CENTRE_WEIGHT * Math.min(1, offCentre);
    }
    if (score > bestScore) { bestScore = score; best = pose; }
  }
  return best;
}
