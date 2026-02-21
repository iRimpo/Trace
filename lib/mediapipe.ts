export interface Keypoint {
  x: number;
  y: number;
  z?: number;
  score?: number;
  name?: string;
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

  console.log("[Trace] Creating PoseLandmarker (lite model)...");
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numPoses: 1,
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

    // Convert normalized landmarks (0-1) to pixel coordinates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.landmarks[0].map((lm: any) => ({
      x: lm.x * width,
      y: lm.y * height,
      z: lm.z,
      score: lm.visibility ?? 0,
    }));
  } catch (e) {
    detectErrorCount++;
    if (detectErrorCount <= 3) {
      console.warn("[Trace] detectPose error:", e);
    }
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
  return curr.map((kp, i) => {
    const pk = prev[i];
    if (!pk || (kp.score ?? 0) < 0.3 || (pk.score ?? 0) < 0.3) return kp;
    return {
      ...kp,
      x: kp.x * alpha + pk.x * (1 - alpha),
      y: kp.y * alpha + pk.y * (1 - alpha),
    };
  });
}
