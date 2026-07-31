import type { PoseFrame } from "./poseRecorder";

/**
 * How a run is scored.
 *
 * This existed twice — inline in `SyncTab.tsx` and again, byte for byte, in
 * `public/workers/sync-scorer.js` as untyped, untested JavaScript. Two copies
 * of the arithmetic that decides the number the whole app builds up to, and
 * neither had a single test. It is one implementation now, and the worker is
 * gone: scoring three minutes at 15fps is ~135k `acos` calls, which is a few
 * milliseconds once, at the end of a run. A worker was never buying anything
 * that justified a second copy of the maths.
 *
 * ── What was wrong ───────────────────────────────────────────────────────
 *
 * **Angles were measured in a sheared space.** `jointAngle` divided x by the
 * video width and y by the video height *separately*. That is a non-uniform
 * scale and it does not preserve angles. Worse, the two sides were divided by
 * different constants — the caller passed a hardcoded 640x480 for the webcam
 * and 1920x1080 for the reference, neither of which was measured from the
 * actual media. So a dancer copying the reference *exactly* still scored
 * wrong, by an amount that varied with which way their limbs pointed.
 *
 * Angles are invariant under uniform scale, so the fix is to stop normalising
 * at all: compare in raw pixel space, where pixels are square. The video
 * dimensions are not needed and are no longer passed.
 *
 * **Frame matching was biased late.** The binary search was a `lower_bound` —
 * it returned the first reference frame at or after the user's timestamp, so
 * every comparison was up to a full frame interval late, always in the same
 * direction.
 *
 * **Unmeasurable frames were scored 50.** When fewer than two joints were
 * visible the old code returned a hardcoded 50, which is indistinguishable
 * from a genuine mediocre pose. Every frame where the dancer turned away, left
 * the shot or was backlit quietly pulled the average toward the middle. That
 * is what "the scores feel random" looks like from the outside. Those frames
 * are now excluded, and the fraction that *could* be compared is reported as
 * `coverage`, so the UI can say "we only saw 40% of that run" instead of
 * printing a confident number built mostly out of filler.
 */

export type ScoreRegion = "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

export const REGION_ORDER: ScoreRegion[] = ["torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];

/** [outer, vertex, outer] — the angle is measured at the vertex. */
const JOINT_TRIPLETS: [number, number, number][] = [
  [11, 13, 15], // left elbow
  [12, 14, 16], // right elbow
  [23, 11, 13], // left shoulder
  [24, 12, 14], // right shoulder
  [23, 25, 27], // left knee
  [24, 26, 28], // right knee
  [11, 23, 25], // left hip
  [12, 24, 26], // right hip
];

const REGION_TRIPLETS: Record<ScoreRegion, [number, number, number][]> = {
  leftArm:  [[23, 11, 13], [11, 13, 15]],
  rightArm: [[24, 12, 14], [12, 14, 16]],
  leftLeg:  [[11, 23, 25], [23, 25, 27]],
  rightLeg: [[12, 24, 26], [24, 26, 28]],
  torso:    [[23, 11, 13], [24, 12, 14], [11, 23, 25], [12, 24, 26]],
};

/** Below this, MediaPipe is guessing and the point should not be trusted. */
const MIN_CONFIDENCE = 0.3;

/**
 * Fewest comparable joints before an overall frame score means anything.
 *
 * One joint is a coin flip — an elbow can match by accident while the rest of
 * the body is somewhere else entirely.
 */
export const MIN_JOINTS = 2;

/**
 * How far a user frame may reach for a reference frame, in milliseconds.
 *
 * Beyond this the comparison is against a pose from a different part of the
 * song, which manufactures a confident-looking number out of nothing. 250ms is
 * a little over three frames at 15fps — enough to bridge a dropped frame,
 * not enough to bridge a gap in the recording.
 */
export const MAX_MATCH_MS = 250;

/**
 * The angle error, in degrees, that scores zero.
 *
 * 90° is a quarter turn: a limb pointing up versus a limb pointing sideways.
 * Anything at or past that is simply a different move, and squeezing more
 * resolution out of the top of the range matters more than distinguishing
 * degrees of wrong.
 */
const ZERO_AT_DEGREES = 90;

/**
 * Angle at `v` between the rays to `p1` and `p2`, in degrees. `null` when the
 * points are missing, low-confidence, or coincident.
 *
 * No video dimensions: angle is invariant under uniform scale, pixels are
 * square, and the old normalisation by width and height separately was the
 * source of the scoring bug this module exists to fix.
 */
export function jointAngle(
  kps: number[][],
  p1: number, v: number, p2: number,
): number | null {
  const k1 = kps[p1], kv = kps[v], k2 = kps[p2];
  if (!k1 || !kv || !k2) return null;
  if ((k1[2] ?? 0) < MIN_CONFIDENCE) return null;
  if ((kv[2] ?? 0) < MIN_CONFIDENCE) return null;
  if ((k2[2] ?? 0) < MIN_CONFIDENCE) return null;

  const dx1 = k1[0] - kv[0], dy1 = k1[1] - kv[1];
  const dx2 = k2[0] - kv[0], dy2 = k2[1] - kv[1];
  const mag1 = Math.hypot(dx1, dy1);
  const mag2 = Math.hypot(dx2, dy2);
  if (mag1 < 1e-6 || mag2 < 1e-6) return null;

  const cos = (dx1 * dx2 + dy1 * dy2) / (mag1 * mag2);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

function scoreFromMeanError(totalDiff: number, count: number): number {
  const avg = totalDiff / count;
  return Math.max(0, Math.min(100, Math.round((1 - avg / ZERO_AT_DEGREES) * 100)));
}

/**
 * How closely one pose matches another, 0–100, or `null` when too little of
 * the body was measurable on both sides to say.
 */
export function comparePoseScore(userKps: number[][], refKps: number[][]): number | null {
  let totalDiff = 0, count = 0;
  for (const [p1, v, p2] of JOINT_TRIPLETS) {
    const ua = jointAngle(userKps, p1, v, p2);
    if (ua === null) continue;
    const ra = jointAngle(refKps, p1, v, p2);
    if (ra === null) continue;
    totalDiff += Math.abs(ua - ra);
    count++;
  }
  if (count < MIN_JOINTS) return null;
  return scoreFromMeanError(totalDiff, count);
}

/**
 * Per-region match, 0–100 each, or **-1 for "no data"**.
 *
 * -1 and 0 are different facts and the UI must be able to tell them apart:
 * telling a dancer their legs scored zero when the camera never saw their legs
 * is worse than telling them nothing.
 */
export function compareRegionScores(
  userKps: number[][],
  refKps: number[][],
): Record<ScoreRegion, number> {
  const result = {} as Record<ScoreRegion, number>;
  for (const region of REGION_ORDER) {
    let totalDiff = 0, count = 0;
    for (const [p1, v, p2] of REGION_TRIPLETS[region]) {
      const ua = jointAngle(userKps, p1, v, p2);
      if (ua === null) continue;
      const ra = jointAngle(refKps, p1, v, p2);
      if (ra === null) continue;
      totalDiff += Math.abs(ua - ra);
      count++;
    }
    result[region] = count > 0 ? scoreFromMeanError(totalDiff, count) : -1;
  }
  return result;
}

/**
 * The reference frame closest in time to `t`. Genuinely nearest, not the next
 * one at or after — see the module note.
 *
 * `sorted` must be ascending by `t`.
 */
export function nearestFrame(sorted: PoseFrame[], t: number): PoseFrame | null {
  if (sorted.length === 0) return null;
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].t < t) lo = mid + 1; else hi = mid;
  }
  const after = sorted[lo];
  const before = lo > 0 ? sorted[lo - 1] : null;
  if (!before) return after;
  return Math.abs(after.t - t) < Math.abs(t - before.t) ? after : before;
}

export interface ScoredFrame {
  /** Milliseconds from the start of the take, in the user's timeline. */
  t: number;
  score: number;
}

export interface RunScore {
  /** Only the frames that could actually be compared. */
  frames: ScoredFrame[];
  /** Mean of `frames`, or null when nothing was comparable. */
  overall: number | null;
  regions: Record<ScoreRegion, number>;
  /** How many user frames produced a real comparison. */
  comparedFrames: number;
  /** `comparedFrames / totalFrames`, 0–1. The honesty dial for the UI. */
  coverage: number;
}

const EMPTY_REGIONS = (): Record<ScoreRegion, number> => ({
  torso: -1, leftArm: -1, rightArm: -1, leftLeg: -1, rightLeg: -1,
});

/** Score a whole take. Pure — no DOM, no timers, no video dimensions. */
export function scoreRun(userFrames: PoseFrame[], refFrames: PoseFrame[]): RunScore {
  const empty: RunScore = {
    frames: [], overall: null, regions: EMPTY_REGIONS(),
    comparedFrames: 0, coverage: 0,
  };
  if (userFrames.length === 0 || refFrames.length === 0) return empty;

  const sortedRef = [...refFrames].sort((a, b) => a.t - b.t);
  const frames: ScoredFrame[] = [];
  const accum: Record<ScoreRegion, number[]> = {
    torso: [], leftArm: [], rightArm: [], leftLeg: [], rightLeg: [],
  };

  for (const frame of userFrames) {
    const ref = nearestFrame(sortedRef, frame.t);
    if (!ref) continue;
    // A match from a different part of the song is worse than no match.
    if (Math.abs(ref.t - frame.t) > MAX_MATCH_MS) continue;

    const score = comparePoseScore(frame.kps, ref.kps);
    if (score === null) continue;

    frames.push({ t: frame.t, score });
    const regions = compareRegionScores(frame.kps, ref.kps);
    for (const r of REGION_ORDER) {
      if (regions[r] >= 0) accum[r].push(regions[r]);
    }
  }

  const regions = EMPTY_REGIONS();
  for (const r of REGION_ORDER) {
    const arr = accum[r];
    if (arr.length > 0) {
      regions[r] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
  }

  return {
    frames,
    overall: frames.length > 0
      ? Math.round(frames.reduce((s, f) => s + f.score, 0) / frames.length)
      : null,
    regions,
    comparedFrames: frames.length,
    coverage: userFrames.length > 0 ? frames.length / userFrames.length : 0,
  };
}
