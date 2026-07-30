import { describe, it, expect } from "vitest";
import { MovementEventDetector, movementOrigin, detectRoll } from "../movementEventDetector";
import { PoseFrameBuffer } from "../motionAnalyzer";
import type { PoseFrame } from "../motionAnalyzer";
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

// ── Travel origin ─────────────────────────────────────────────────────────

/** Frames at 10fps where the joint is still, then accelerates right. */
function stillThenMove(): PoseFrame[] {
  const xs = [50, 50, 50, 50, 60, 80, 110, 150];
  return xs.map((x, i) => ({
    kps: Array.from({ length: 33 }, () => ({ x, y: 100, score: 0.9 })),
    videoTime: i * 0.1,
    wallTime:  i * 100,
  })) as PoseFrame[];
}

describe("movementOrigin", () => {
  it("returns the position where the joint was at rest, not the newest frame", () => {
    const o = movementOrigin(stillThenMove(), 15)!;
    expect(o.x).toBeCloseTo(50, 5);
  });

  it("returns null when the joint is never confidently visible", () => {
    const frames = stillThenMove().map(f => ({
      ...f,
      kps: f.kps.map(() => ({ x: 0, y: 0, score: 0.05 })),
    })) as PoseFrame[];
    expect(movementOrigin(frames, 15)).toBeNull();
  });

  it("ignores frames older than the lookback window", () => {
    // With a 250ms lookback only the newest few frames are in scope, so the
    // rest position at x=50 is out of reach.
    const o = movementOrigin(stillThenMove(), 15, 250)!;
    expect(o.x).toBeGreaterThan(50);
  });
});

// ── Roll / wave detection ─────────────────────────────────────────────────

/** `n` frames tracing a circle of radius `r` — high path, ~zero net travel. */
function circleFrames(n: number, r: number): PoseFrame[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const x = 200 + r * Math.cos(a), y = 200 + r * Math.sin(a);
    return {
      kps: Array.from({ length: 33 }, () => ({ x, y, score: 0.9 })),
      videoTime: i * 0.05,
      wallTime:  i * 50,
    };
  }) as PoseFrame[];
}

/** `n` frames travelling in a straight line — path equals net travel. */
function lineFrames(n: number, span: number): PoseFrame[] {
  return Array.from({ length: n }, (_, i) => {
    const x = 200 + (span * i) / (n - 1);
    return {
      kps: Array.from({ length: 33 }, () => ({ x, y: 200, score: 0.9 })),
      videoTime: i * 0.05,
      wallTime:  i * 50,
    };
  }) as PoseFrame[];
}

describe("detectRoll", () => {
  it("fires on a circular path", () => {
    expect(detectRoll(circleFrames(10, 60), 11, 720)).not.toBeNull();
  });

  it("does not fire on a straight line of the same length", () => {
    expect(detectRoll(lineFrames(10, 240), 11, 720)).toBeNull();
  });

  it("does not fire on a circle too small to be a real gesture", () => {
    expect(detectRoll(circleFrames(10, 2), 11, 720)).toBeNull();
  });

  it("emits nothing below 3 samples in the window", () => {
    // 2 frames cannot describe a loop; the scan floors at 2fps on long videos,
    // where a beat is a single frame and circuity is unmeasurable.
    expect(detectRoll(circleFrames(2, 60), 11, 720)).toBeNull();
  });

  it("reports path length as the magnitude, not net displacement", () => {
    const roll = detectRoll(circleFrames(12, 60), 11, 720)!;
    // circumference ~ 2*pi*60 = 377; net displacement ~ 0
    expect(roll.magnitude).toBeGreaterThan(300);
  });
});
