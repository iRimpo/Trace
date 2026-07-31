import { describe, it, expect } from "vitest";
import {
  jointAngle, comparePoseScore, compareRegionScores,
  nearestFrame, scoreRun, MAX_MATCH_MS, MIN_JOINTS,
} from "@/lib/poseScore";
import type { PoseFrame } from "@/lib/poseRecorder";

/* ── helpers ───────────────────────────────────────────────────────────── */

/** A keypoint array with the given indices placed, everything else absent. */
function kps(points: Record<number, [number, number, number?]>): number[][] {
  const out: number[][] = new Array(33).fill(null);
  for (const [i, p] of Object.entries(points)) {
    out[Number(i)] = [p[0], p[1], p[2] ?? 1];
  }
  return out;
}

/**
 * A whole standing skeleton, so every joint triplet is measurable. Scoring
 * needs at least MIN_JOINTS comparable triplets, so a fixture with one arm in
 * it is correctly rejected — the fixture has to be a body.
 *
 * `s` scales and `(ox, oy)` translates, which is how the invariance tests get
 * "the same shape, bigger and somewhere else".
 */
function pose(s = 1, ox = 0, oy = 0, armsUp = false): number[][] {
  const P = (x: number, y: number): [number, number] => [x * s + ox, y * s + oy];
  return kps({
    11: P(40, 40),  12: P(60, 40),                        // shoulders
    13: armsUp ? P(28, 22) : P(30, 60),
    14: armsUp ? P(72, 22) : P(70, 60),                   // elbows
    15: armsUp ? P(30, 4)  : P(30, 80),
    16: armsUp ? P(70, 4)  : P(70, 80),                   // wrists
    23: P(45, 80),  24: P(55, 80),                        // hips
    25: P(45, 110), 26: P(55, 110),                       // knees
    27: P(45, 140), 28: P(55, 140),                       // ankles
  });
}

const POSE         = pose();
const POSE_SCALED  = pose(3, 400, 250);
const POSE_ARMS_UP = pose(1, 0, 0, true);

/** A right angle at vertex 13: 11 above, 15 to the right. */
const RIGHT_ANGLE = kps({ 11: [100, 0], 13: [100, 100], 15: [200, 100] });

/** The same right angle, scaled and shifted — the same *shape*. */
const RIGHT_ANGLE_SCALED = kps({ 11: [400, 100], 13: [400, 400], 15: [700, 400] });

/** A straight arm at vertex 13 — 180°. */
const STRAIGHT = kps({ 11: [100, 100], 13: [200, 100], 15: [300, 100] });

const frame = (t: number, k: number[][]): PoseFrame => ({ t, kps: k });

/* ── the geometry ──────────────────────────────────────────────────────── */

describe("jointAngle", () => {
  it("measures a right angle as 90°", () => {
    expect(jointAngle(RIGHT_ANGLE, 11, 13, 15)!).toBeCloseTo(90, 5);
  });

  it("measures a straight limb as 180°", () => {
    expect(jointAngle(STRAIGHT, 11, 13, 15)!).toBeCloseTo(180, 5);
  });

  /**
   * The bug this test exists for: the old implementation divided x by the video
   * width and y by the video height *separately*. That is a non-uniform scale,
   * which does not preserve angles — so the same physical pose measured in a
   * 640x480 webcam and a 1920x1080 reference produced different numbers, and
   * the score was wrong even for a perfect copy.
   */
  it("is invariant under uniform scale and translation", () => {
    const a = jointAngle(RIGHT_ANGLE, 11, 13, 15)!;
    const b = jointAngle(RIGHT_ANGLE_SCALED, 11, 13, 15)!;
    expect(b).toBeCloseTo(a, 5);
  });

  it("returns null when any of the three points is missing", () => {
    expect(jointAngle(kps({ 11: [0, 0], 13: [1, 1] }), 11, 13, 15)).toBeNull();
  });

  it("returns null when any point is below the confidence floor", () => {
    const low = kps({ 11: [100, 0, 0.1], 13: [100, 100], 15: [200, 100] });
    expect(jointAngle(low, 11, 13, 15)).toBeNull();
  });

  it("returns null on a degenerate (zero-length) limb", () => {
    const same = kps({ 11: [100, 100], 13: [100, 100], 15: [200, 100] });
    expect(jointAngle(same, 11, 13, 15)).toBeNull();
  });
});

/* ── frame matching ────────────────────────────────────────────────────── */

describe("nearestFrame", () => {
  const sorted = [frame(0, POSE), frame(100, POSE), frame(200, POSE)];

  it("picks the genuinely nearest frame, not the next one after", () => {
    // The old binary search was a lower_bound: it returned the first frame at
    // or after t, so t=99 matched the frame at 100 and t=101 also matched 100.
    // Every comparison was biased late by up to a full frame interval.
    expect(nearestFrame(sorted, 99)!.t).toBe(100);
    expect(nearestFrame(sorted, 60)!.t).toBe(100);
    expect(nearestFrame(sorted, 40)!.t).toBe(0);
    expect(nearestFrame(sorted, 149)!.t).toBe(100);
    expect(nearestFrame(sorted, 151)!.t).toBe(200);
  });

  it("clamps to the ends", () => {
    expect(nearestFrame(sorted, -500)!.t).toBe(0);
    expect(nearestFrame(sorted, 9999)!.t).toBe(200);
  });

  it("returns null for an empty reference", () => {
    expect(nearestFrame([], 10)).toBeNull();
  });
});

/* ── pose comparison ───────────────────────────────────────────────────── */

describe("comparePoseScore", () => {
  it("scores an identical pose 100", () => {
    expect(comparePoseScore(POSE, POSE)).toBe(100);
  });

  it("scores a scaled copy of the same shape 100", () => {
    // The whole point: the dancer is a different size, at a different distance,
    // in a differently-shaped frame. Shape is what is being compared.
    expect(comparePoseScore(POSE, POSE_SCALED)).toBe(100);
  });

  it("scores a different pose well below a match", () => {
    const same = comparePoseScore(POSE, POSE)!;
    const diff = comparePoseScore(POSE, POSE_ARMS_UP)!;
    expect(diff).toBeLessThan(same);
    expect(diff).toBeLessThan(80);
  });

  /**
   * The old code returned a hardcoded 50 when fewer than two joints were
   * visible. That is indistinguishable from a genuine mediocre pose, so every
   * frame where the dancer was turned away, out of shot or backlit quietly
   * dragged the average toward 50 — which is exactly what "the scores feel
   * random" looks like from the outside.
   */
  it("returns null rather than a fabricated 50 when too few joints are visible", () => {
    const bare = kps({ 11: [100, 0], 13: [100, 100], 15: [200, 100] });
    // One usable triplet only — below MIN_JOINTS.
    expect(MIN_JOINTS).toBeGreaterThan(1);
    expect(comparePoseScore(bare, bare)).toBeNull();
  });

  it("returns null when the two poses share no measurable joint", () => {
    const armOnly = kps({ 11: [100, 0], 13: [100, 100], 15: [200, 100] });
    const legOnly = kps({ 23: [100, 0], 25: [100, 100], 27: [200, 100] });
    expect(comparePoseScore(armOnly, legOnly)).toBeNull();
  });
});

describe("compareRegionScores", () => {
  it("marks regions with no measurable joints as -1, not 0", () => {
    // -1 means "no data"; 0 means "you were wrong". Conflating them tells a
    // dancer their legs were terrible when the camera simply never saw them.
    const armOnly = kps({ 23: [100, 0], 11: [100, 100], 13: [200, 100], 15: [250, 150] });
    const r = compareRegionScores(armOnly, armOnly);
    expect(r.leftLeg).toBe(-1);
    expect(r.rightLeg).toBe(-1);
  });

  it("scores a matching region 100", () => {
    const pose = kps({ 23: [100, 0], 11: [100, 100], 13: [200, 100], 15: [250, 150] });
    expect(compareRegionScores(pose, pose).leftArm).toBe(100);
  });
});

/* ── the run ───────────────────────────────────────────────────────────── */

describe("scoreRun", () => {
  const ref = [frame(0, POSE), frame(100, POSE), frame(200, POSE)];

  it("scores a perfect run 100 with full coverage", () => {
    const user = [frame(0, POSE), frame(100, POSE), frame(200, POSE)];
    const out = scoreRun(user, ref);
    expect(out.overall).toBe(100);
    expect(out.coverage).toBe(1);
    expect(out.comparedFrames).toBe(3);
  });

  it("reports zero coverage and a null overall when nothing could be compared", () => {
    // Not a zero score. "We could not see you" and "you danced badly" are
    // different facts and the UI has to be able to tell them apart.
    const blind = [frame(0, kps({})), frame(100, kps({}))];
    const out = scoreRun(blind, ref);
    expect(out.overall).toBeNull();
    expect(out.coverage).toBe(0);
    expect(out.frames).toHaveLength(0);
  });

  it("excludes unmeasurable frames from the average instead of scoring them 50", () => {
    const user = [frame(0, POSE), frame(100, kps({})), frame(200, POSE)];
    const out = scoreRun(user, ref);
    expect(out.overall).toBe(100);          // the two good frames, not (100+50+100)/3
    expect(out.comparedFrames).toBe(2);
    expect(out.coverage).toBeCloseTo(2 / 3, 5);
  });

  it("refuses to match a user frame to a reference frame too far away in time", () => {
    // A stale match compares you against a pose from a different part of the
    // song, which produces a confident-looking number from nothing.
    const user = [frame(60_000, POSE)];
    const out = scoreRun(user, ref);
    expect(out.comparedFrames).toBe(0);
    expect(out.overall).toBeNull();
    expect(MAX_MATCH_MS).toBeGreaterThan(0);
  });

  it("returns an empty result for an empty reference rather than throwing", () => {
    // The old inline path indexed sortedRef[0] on an empty array and then read
    // .kps off undefined.
    const out = scoreRun([frame(0, POSE)], []);
    expect(out.overall).toBeNull();
    expect(out.frames).toHaveLength(0);
  });

  it("keeps per-frame timestamps in the user's timeline", () => {
    const user = [frame(0, POSE), frame(200, POSE)];
    expect(scoreRun(user, ref).frames.map(f => f.t)).toEqual([0, 200]);
  });

  it("never emits a score outside 0-100", () => {
    const user = [frame(0, POSE), frame(100, POSE_ARMS_UP), frame(200, POSE)];
    for (const f of scoreRun(user, ref).frames) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
    }
  });
});
