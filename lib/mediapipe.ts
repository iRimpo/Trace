export interface Keypoint {
  x: number;       // pixel space (0 → videoWidth)
  y: number;       // pixel space (0 → videoHeight)
  z?: number;      // image-space depth (normalized, relative to hip)
  score?: number;  // visibility confidence 0–1
  name?: string;
  // World-landmark coordinates in meters, origin at hip midpoint, z away from camera
  wx?: number;
  wy?: number;
  wz?: number;
}

/** Which model format — always blazepose with MediaPipe Tasks Vision */
export type ModelFormat = "blazepose" | "movenet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseLandmarker: any | null = null;
let initError: string | null = null;

export function getInitError(): string | null {
  return initError;
}

export function getModelFormat(): ModelFormat {
  return "blazepose"; // MediaPipe Tasks Vision always uses 33-point BlazePose
}

async function loadPoseLandmarker() {
  const { PoseLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );

  console.log("[Trace] Loading MediaPipe WASM runtime...");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
  );

  console.log("[Trace] Creating PoseLandmarker (full model)...");
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numPoses: 10,
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence:  0.3,
    minTrackingConfidence:      0.3,
  });

  return poseLandmarker;
}

/** Pre-warm the model so first detection is fast */
export async function initPoseDetection(): Promise<boolean> {
  try {
    initError = null;
    await loadPoseLandmarker();
    console.log("[Trace] PoseLandmarker ready");
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    initError = msg;
    console.error("[Trace] Pose detection init failed:", msg);
    poseLandmarker = null;
    return false;
  }
}

/** Retry model loading after a failure */
export async function retryPoseDetection(): Promise<boolean> {
  poseLandmarker = null;
  initError = null;
  return initPoseDetection();
}

/** Detect pose from a video or canvas element. Returns pixel-space keypoints or null. */
let detectErrorCount = 0;
export function detectPose(
  source: HTMLVideoElement | HTMLCanvasElement
): Keypoint[] | null {
  if (!poseLandmarker) return null;

  if (source instanceof HTMLVideoElement) {
    if (source.readyState < 2) return null;
    if (source.videoWidth === 0) return null;
  }

  try {
    const result = poseLandmarker.detect(source);

    if (!result.landmarks || !result.landmarks[0] || result.landmarks[0].length === 0) {
      return null;
    }

    const width =
      source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const height =
      source instanceof HTMLVideoElement ? source.videoHeight : source.height;

    // Convert normalized landmarks (0-1) to pixel coordinates, augment with
    // world landmarks (metric 3D in meters, origin at hip midpoint)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const world: any[] = result.worldLandmarks?.[0] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.landmarks[0].map((lm: any, i: number) => ({
      x: lm.x * width,
      y: lm.y * height,
      z: lm.z,
      score: lm.visibility ?? 0,
      wx: world[i]?.x,
      wy: world[i]?.y,
      wz: world[i]?.z,
    }));
  } catch (e) {
    detectErrorCount++;
    if (detectErrorCount <= 3) {
      console.warn("[Trace] detectPose error:", e);
    }
    return null;
  }
}

/** Detect all poses in a frame. Returns one keypoint array per person, or null. */
export function detectAllPoses(
  source: HTMLVideoElement | HTMLCanvasElement
): Keypoint[][] | null {
  if (!poseLandmarker) return null;
  if (source instanceof HTMLVideoElement) {
    if (source.readyState < 2 || source.videoWidth === 0) return null;
  }
  try {
    const result = poseLandmarker.detect(source);
    if (!result.landmarks || result.landmarks.length === 0) return null;
    const width  = source instanceof HTMLVideoElement ? source.videoWidth  : source.width;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.landmarks.map((landmarks: any[], personIdx: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const world: any[] = result.worldLandmarks?.[personIdx] ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return landmarks.map((lm: any, i: number) => ({
        x: lm.x * width, y: lm.y * height, z: lm.z,
        score: lm.visibility ?? 0,
        wx: world[i]?.x, wy: world[i]?.y, wz: world[i]?.z,
      }));
    });
  } catch {
    return null;
  }
}

/**
 * Detect all poses from a video frame via an intermediate canvas.
 * - Caps resolution at 1920px on the longest side for stable GPU processing
 * - Returns pixel-space keypoints in the original video coordinate space
 * - Use this for group scenes instead of detectAllPoses() on the raw video
 */
export function detectAllPosesFromFrame(
  video: HTMLVideoElement,
): Keypoint[][] | null {
  if (!poseLandmarker) return null;
  if (video.readyState < 2 || video.videoWidth === 0) return null;

  const vW = video.videoWidth, vH = video.videoHeight;

  // Cap at 1920px on longest dimension — prevents GPU timeouts on 4K footage
  // and gives BlazePose a consistent scale without shrinking small people too much
  const maxDim = 1920;
  const scale  = Math.min(1, maxDim / Math.max(vW, vH));
  const cW = Math.round(vW * scale), cH = Math.round(vH * scale);

  const canvas = document.createElement("canvas");
  canvas.width  = cW;
  canvas.height = cH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cW, cH);

  try {
    const result = poseLandmarker.detect(canvas);
    if (!result.landmarks || result.landmarks.length === 0) return null;

    // Landmarks are normalized (0-1 relative to canvas); since we scaled uniformly,
    // lm.x * vW gives the correct pixel x in the original video space.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.landmarks.map((landmarks: any[], personIdx: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const world: any[] = result.worldLandmarks?.[personIdx] ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return landmarks.map((lm: any, i: number) => ({
        x:  lm.x * vW, y: lm.y * vH, z: lm.z,
        score: lm.visibility ?? 0,
        wx: world[i]?.x, wy: world[i]?.y, wz: world[i]?.z,
      }));
    });
  } catch {
    return null;
  }
}

/** Smooth keypoints with exponential moving average to reduce jitter */
export function smoothKeypoints(
  prev: Keypoint[] | null,
  curr: Keypoint[],
  alpha = 0.6
): Keypoint[] {
  if (!prev || prev.length !== curr.length) return curr;
  const a = alpha;
  const b = 1 - alpha;
  return curr.map((kp, i) => {
    const pk = prev[i];
    if (!pk || (kp.score ?? 0) < 0.3 || (pk.score ?? 0) < 0.3) return kp;
    return {
      ...kp,
      x:  kp.x  * a + pk.x  * b,
      y:  kp.y  * a + pk.y  * b,
      wx: kp.wx != null && pk.wx != null ? kp.wx * a + pk.wx * b : kp.wx,
      wy: kp.wy != null && pk.wy != null ? kp.wy * a + pk.wy * b : kp.wy,
      wz: kp.wz != null && pk.wz != null ? kp.wz * a + pk.wz * b : kp.wz,
    };
  });
}
