import { initPoseDetection, detectAllPosesFromFrame, smoothKeypoints } from "./mediapipe";
import type { Keypoint } from "./mediapipe";
import { PoseFrameBuffer } from "./motionAnalyzer";
import { MovementEventDetector } from "./movementEventDetector";
import type { MovementEvent } from "./movementEventDetector";
import { DancerTracker } from "./dancerTracker";
import { buildChoreoTimeline, type ChoreoTimeline } from "./choreoTimeline";
import type { CountGrid } from "./countGrid";

export interface PreScanResult {
  events:      MovementEvent[];
  videoHeight: number;
  /** Beat-quantized, density-capped timeline — the cacheable scan product. */
  timeline:    ChoreoTimeline;
}

export interface PreScanProgress {
  current: number;
  total:   number;
}

export interface PersonCenter {
  x: number;
  y: number;
}

// Adaptive FPS: aim for at most 300 frames per scan, minimum 4 fps.
// This keeps a 3-min clip at ~1.7 fps (180 frames) instead of 2700 frames.
// Movement detection still works because we simulate consistent wall-clock
// timing via SIM_FRAME_MS regardless of actual video FPS sampled.
const MAX_FRAMES     = 300;
const MIN_FPS        = 4;
const MAX_FPS        = 10;

function scanFps(spanSeconds: number): number {
  if (spanSeconds <= 0) return MAX_FPS;
  const fps = MAX_FRAMES / spanSeconds;
  return Math.max(MIN_FPS, Math.min(MAX_FPS, fps));
}

const SIM_FPS        = 10; // wall-clock simulation rate (constant for detector)
const SIM_FRAME_MS   = 1000 / SIM_FPS;

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    video.addEventListener("seeked", finish, { once: true });
    setTimeout(finish, 150);
  });
}

function waitForFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    video.addEventListener("canplay", finish, { once: true });
    setTimeout(finish, 250);
  });
}

/**
 * Pre-scan a video to extract all movement events up front.
 * Returns the events sorted by videoTime, ready for replay during playback.
 */
// Normalized hip-center of a pose (0–1 relative to video dimensions)
function poseCenter(kps: Keypoint[], vW: number, vH: number): { x: number; y: number } | null {
  const L_HIP = 23, R_HIP = 24;
  const lh = kps[L_HIP], rh = kps[R_HIP];
  if (!lh || !rh || (lh.score ?? 0) < 0.2 || (rh.score ?? 0) < 0.2) return null;
  return { x: (lh.x + rh.x) / 2 / vW, y: (lh.y + rh.y) / 2 / vH };
}

function kpsToBounds(
  kps: Keypoint[], vW: number, vH: number,
): { x1: number; y1: number; x2: number; y2: number } | undefined {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
  for (const kp of kps) {
    if (!kp || (kp.score ?? 0) < 0.25) continue;
    minX = Math.min(minX, kp.x / vW); minY = Math.min(minY, kp.y / vH);
    maxX = Math.max(maxX, kp.x / vW); maxY = Math.max(maxY, kp.y / vH);
    n++;
  }
  if (n < 3) return undefined;
  // No padding here — canvas-pixel padding is added at render time.
  return { x1: Math.max(0, minX), y1: Math.max(0, minY), x2: Math.min(1, maxX), y2: Math.min(1, maxY) };
}

export async function preScanVideo(
  videoUrl:      string,
  poseInitRef:   { current: boolean },
  onProgress?:   (p: PreScanProgress) => void,
  signal?:       AbortSignal,
  startTime?:    number,
  endTime?:      number,
  personCenter?: { x: number; y: number },
  onPersonChoice?: (persons: PersonCenter[]) => Promise<number>,
  grid?:         CountGrid | null,
): Promise<PreScanResult | null> {
  if (!poseInitRef.current) {
    const ok = await initPoseDetection();
    if (!ok) return null;
    poseInitRef.current = true;
  }

  const video = document.createElement("video");
  video.src         = videoUrl;
  video.crossOrigin = "anonymous";
  video.muted       = true;
  video.playsInline = true;
  video.preload     = "auto";

  await new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) { resolve(); return; }
    video.onloadedmetadata = () => resolve();
    video.onerror          = () => reject(new Error("Failed to load video"));
  });

  const duration    = video.duration;
  const videoHeight = video.videoHeight;
  if (!isFinite(duration) || duration <= 0 || videoHeight === 0) {
    video.src = "";
    return null;
  }

  const scanStart = Math.max(0, startTime ?? 0);
  const scanEnd   = Math.min(duration, endTime ?? duration);

  const span          = scanEnd - scanStart;
  const fps           = scanFps(span);
  const frameInterval = 1 / fps;

  const allEvents: MovementEvent[] = [];
  const frameBuffer = new PoseFrameBuffer(30);
  const detector    = new MovementEventDetector();
  const tracker     = new DancerTracker();
  if (personCenter) tracker.lock(personCenter);
  let choiceOffered = personCenter != null;
  let prevKps: Keypoint[] | null = null;
  let simTime = 0;

  /** Ask the caller (user tap) which person to track; returns false if unanswered. */
  async function askPersonChoice(allPoses: Keypoint[][]): Promise<boolean> {
    if (!onPersonChoice) return false;
    const centers: PersonCenter[] = [];
    for (const kps of allPoses) {
      const c = poseCenter(kps, video.videoWidth, video.videoHeight);
      if (c) centers.push(c);
    }
    if (centers.length === 0) return false;
    const idx = await onPersonChoice(centers).catch(() => -1);
    if (idx >= 0 && idx < centers.length) {
      tracker.lock(centers[idx]);
      return true;
    }
    return false;
  }

  for (let t = scanStart; t < scanEnd; t += frameInterval) {
    if (signal?.aborted) { video.src = ""; return null; }

    video.currentTime = t;
    await waitForSeek(video);
    await waitForFrame(video);

    if (video.videoWidth === 0) continue;

    const allPoses = detectAllPosesFromFrame(video);
    if (!allPoses || allPoses.length === 0) continue;

    // First multi-person frame with no lock yet: ask the user up front.
    if (!choiceOffered && allPoses.length > 1) {
      choiceOffered = true;
      await askPersonChoice(allPoses);
    }

    let track = tracker.step(allPoses, video.videoWidth, video.videoHeight);

    // Tracking lost past the coast budget (formation crossing / occlusion):
    // pause the scan on this frame and ask the user to re-tap their dancer.
    if (track.needsReacquire) {
      const relocked = await askPersonChoice(allPoses);
      if (relocked) {
        track = tracker.step(allPoses, video.videoWidth, video.videoHeight);
      }
      // Unanswered → continue coasting with best-guess tracking (spec).
    }

    const rawKps = track.kps;
    if (rawKps) {
      const kps    = smoothKeypoints(prevKps, rawKps);
      prevKps      = kps;
      simTime     += SIM_FRAME_MS;

      frameBuffer.push({ kps, videoTime: t, wallTime: simTime });

      const bounds = kpsToBounds(rawKps, video.videoWidth, video.videoHeight);

      // Detect crowding: is any OTHER person's hip-centre within 0.15 norm units?
      const CROWD_DIST = 0.15;
      const tc = tracker.center;
      const crowded = tc !== null && allPoses.length > 1 && allPoses.some(kps => {
        if (kps === rawKps) return false;
        const oc = poseCenter(kps, video.videoWidth, video.videoHeight);
        if (!oc) return false;
        return (oc.x - tc.x) ** 2 + (oc.y - tc.y) ** 2 < CROWD_DIST ** 2;
      });

      const events = detector.process(frameBuffer.frames, videoHeight, simTime);
      for (const ev of events) {
        if (bounds) ev.personBounds = bounds;
        if (crowded) ev.crowded = true;
        if (track.confidence < 0.5) ev.lowConfidence = true;
      }
      allEvents.push(...events);
    }

    onProgress?.({ current: t - scanStart, total: scanEnd - scanStart });
  }

  video.src = "";
  onProgress?.({ current: scanEnd - scanStart, total: scanEnd - scanStart });

  return {
    events: allEvents,
    videoHeight,
    timeline: buildChoreoTimeline(allEvents, grid ?? null, videoHeight),
  };
}
