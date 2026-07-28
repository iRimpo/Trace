import { describe, it, expect } from "vitest";
import { MovementEventDetector } from "../movementEventDetector";
import { PoseFrameBuffer } from "../motionAnalyzer";
import type { Keypoint } from "../mediapipe";

const VIDEO_H = 1000;
const L_SHOULDER = 11;
const L_WRIST = 15;

/**
 * A 33-keypoint pose with a fixed shoulder and a wrist that oscillates
 * horizontally away from it. Displacement is measured relative to the parent
 * shoulder, so this is the joint-relative motion the detector fires on.
 */
function poseAt(videoTimeS: number, periodS: number, amplitudePx: number): Keypoint[] {
  const kps: Keypoint[] = Array.from({ length: 33 }, () => ({
    x: 500,
    y: 500,
    score: 0.9,
  }));
  kps[L_SHOULDER] = { x: 500, y: 400, score: 0.9 };
  kps[L_WRIST] = {
    x: 500 + amplitudePx * Math.sin((2 * Math.PI * videoTimeS) / periodS),
    y: 500,
    score: 0.9,
  };
  return kps;
}

/**
 * Replay the same choreography at a given scan rate.
 * Returns cue counts keyed by joint name — the moving wrist also drags its
 * child index finger, so per-joint counts are what the assertions need.
 */
function scanAtFps(
  fps: number,
  durationS = 20,
  periodS = 2,
  amplitudePx = 90,
): Record<string, number> {
  const detector = new MovementEventDetector();
  const buffer = new PoseFrameBuffer(30);
  const step = 1 / fps;
  const byJoint: Record<string, number> = {};

  for (let t = 0; t < durationS; t += step) {
    // Mirrors lib/videoPreScan.ts: wallTime and the detector clock are both
    // real video time, not a simulated fixed-rate clock.
    const videoTimeMs = t * 1000;
    buffer.push({ kps: poseAt(t, periodS, amplitudePx), videoTime: t, wallTime: videoTimeMs });
    for (const ev of detector.process(buffer.frames, VIDEO_H, videoTimeMs)) {
      byJoint[ev.jointName] = (byJoint[ev.jointName] ?? 0) + 1;
    }
  }
  return byJoint;
}

const wristCuesAtFps = (fps: number, durationS = 20) =>
  scanAtFps(fps, durationS)["L Wrist"] ?? 0;

describe("MovementEventDetector — scan-rate invariance", () => {
  it("fires cues on joint-relative motion", () => {
    expect(wristCuesAtFps(10)).toBeGreaterThan(0);
  });

  it("produces comparable cue density across scan rates", () => {
    // The scan samples anywhere from MAX_FPS (short clips) down to MIN_FPS
    // (long ones). The same choreography must yield roughly the same number of
    // cues regardless — otherwise scan speed silently trades away cue density.
    const counts = [10, 5, 4, 2].map(fps => wristCuesAtFps(fps));
    const min = Math.min(...counts);
    const max = Math.max(...counts);

    // Coarser sampling can miss a peak or two, but must stay in the same band.
    // Under the old fixed 100ms/frame clock the cooldown scaled with frame
    // count, so 2 fps stretched an 800ms cooldown across ~4s of video and
    // produced a fraction of the cues that 10 fps did.
    expect(min).toBeGreaterThan(0);
    expect(max / min).toBeLessThan(2);
  });

  it("respects the per-joint cooldown in video time, not frame count", () => {
    // Wrist cooldown is 800ms. Over 20s a single joint cannot fire more often
    // than once per cooldown window, however densely the video is sampled.
    for (const fps of [10, 4, 2]) {
      expect(wristCuesAtFps(fps, 20)).toBeLessThanOrEqual(Math.ceil(20 / 0.8));
    }
  });
});
