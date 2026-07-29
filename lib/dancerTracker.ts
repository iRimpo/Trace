import type { Keypoint } from "./mediapipe";

/**
 * Identity-preserving tracker for one dancer among many.
 *
 * The old approach — follow whoever is nearest to the last known center —
 * fails exactly when K-pop formations cross. This tracker predicts where
 * the locked dancer *should* be next frame (constant-velocity with EMA
 * smoothing) and scores candidates by predicted-position distance plus
 * bounding-box overlap, with an explicit confidence value so callers can
 * pause and ask the user to re-tap instead of silently swapping dancers.
 *
 * All coordinates are normalized (0–1) relative to video dimensions.
 */

export interface TrackStep {
  /** Keypoints of the matched pose, or null while coasting through occlusion. */
  kps: Keypoint[] | null;
  /** 0–1 match confidence for this frame (0 while coasting). */
  confidence: number;
  /** True when coasting exceeded the budget — caller should ask the user to re-tap. */
  needsReacquire: boolean;
}

interface Box { x1: number; y1: number; x2: number; y2: number; }
interface Vec { x: number; y: number; }

const L_HIP = 23, R_HIP = 24;
const MIN_KP_SCORE = 0.2;

/** EMA smoothing factor for velocity updates. */
const VELOCITY_ALPHA = 0.5;
/** Distances ≥ this (norm units) from the prediction score zero. */
const DIST_CEILING = 0.3;
const W_DIST = 0.6;
const W_IOU  = 0.4;
/** Another dancer's center within this radius of ours ⇒ swap risk, dock confidence. */
const CROWD_DIST = 0.1;
const CROWD_PENALTY = 0.15;

function hipCenter(kps: Keypoint[], vW: number, vH: number): Vec | null {
  const lh = kps[L_HIP], rh = kps[R_HIP];
  if (!lh || !rh || (lh.score ?? 0) < MIN_KP_SCORE || (rh.score ?? 0) < MIN_KP_SCORE) return null;
  return { x: (lh.x + rh.x) / 2 / vW, y: (lh.y + rh.y) / 2 / vH };
}

function bounds(kps: Keypoint[], vW: number, vH: number): Box | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, n = 0;
  for (const kp of kps) {
    if (!kp || (kp.score ?? 0) < MIN_KP_SCORE) continue;
    x1 = Math.min(x1, kp.x / vW); y1 = Math.min(y1, kp.y / vH);
    x2 = Math.max(x2, kp.x / vW); y2 = Math.max(y2, kp.y / vH);
    n++;
  }
  return n >= 3 ? { x1, y1, x2, y2 } : null;
}

function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

export class DancerTracker {
  private _center: Vec | null = null;
  private _velocity: Vec = { x: 0, y: 0 };
  private _bounds: Box | null = null;
  private _coasted = 0;
  /** Set once the caller stops asking the user to re-tap; see acknowledgeReacquire. */
  private _bestGuessOnly = false;
  private readonly maxCoastFrames: number;
  private readonly reacquireBelow: number;

  constructor(opts?: { maxCoastFrames?: number; reacquireBelow?: number }) {
    this.maxCoastFrames = opts?.maxCoastFrames ?? 8;
    this.reacquireBelow = opts?.reacquireBelow ?? 0.35;
  }

  /**
   * Tell the tracker a reacquire prompt has been handled, however it ended.
   *
   * `needsReacquire` is derived from the coast budget, and nothing but a
   * successful `lock()` used to reset it — so a declined prompt left the
   * budget blown and the very next frame asked again, forever. The caller
   * must call this after every prompt so one refusal doesn't become an
   * infinite one.
   *
   * `bestGuess` also drops the confidence bar for the rest of the scan:
   * coasting returns `kps: null`, so a tracker that never re-locks records no
   * frames at all and the scan completes with an empty timeline. Following a
   * doubtful dancer beats following nobody.
   */
  acknowledgeReacquire(opts?: { bestGuess?: boolean }): void {
    this._coasted = 0;
    if (opts?.bestGuess) this._bestGuessOnly = true;
  }

  get center(): Vec | null {
    return this._center;
  }

  /** Lock onto the dancer at a (user-tapped) normalized position. */
  lock(center: Vec): void {
    this._center = { ...center };
    this._velocity = { x: 0, y: 0 };
    this._bounds = null;
    this._coasted = 0;
  }

  step(allPoses: Keypoint[][], vW: number, vH: number): TrackStep {
    if (!this._center) {
      // Never locked: adopt the first plausible pose.
      const first = allPoses.find(k => hipCenter(k, vW, vH));
      if (!first) return { kps: null, confidence: 0, needsReacquire: false };
      this._center = hipCenter(first, vW, vH)!;
      this._bounds = bounds(first, vW, vH);
      return { kps: first, confidence: 1, needsReacquire: false };
    }

    const predicted: Vec = {
      x: this._center.x + this._velocity.x,
      y: this._center.y + this._velocity.y,
    };

    // Score every candidate against the prediction
    const candidates: { kps: Keypoint[]; c: Vec; b: Box | null; score: number }[] = [];
    for (const kps of allPoses) {
      const c = hipCenter(kps, vW, vH);
      if (!c) continue;
      const dist = Math.hypot(c.x - predicted.x, c.y - predicted.y);
      const distScore = 1 - Math.min(dist / DIST_CEILING, 1);
      const b = bounds(kps, vW, vH);
      const iouScore = this._bounds && b ? iou(this._bounds, b) : distScore;
      candidates.push({ kps, c, b, score: W_DIST * distScore + W_IOU * iouScore });
    }
    const best = candidates.reduce<typeof candidates[number] | null>(
      (acc, cand) => (!acc || cand.score > acc.score ? cand : acc), null);

    let confidence = best?.score ?? 0;
    const crowded = best !== null && candidates.some(cand =>
      cand !== best &&
      Math.hypot(cand.c.x - best.c.x, cand.c.y - best.c.y) < CROWD_DIST);
    if (crowded) confidence = Math.max(0, confidence - CROWD_PENALTY);

    // Once the user has declined to re-tap, take the best candidate going
    // rather than coasting on nulls and recording nothing for the rest of the
    // scan. Confidence is still reported honestly, so downstream marks these
    // events lowConfidence.
    const doubtful = !best || confidence < this.reacquireBelow;
    if (doubtful && !(this._bestGuessOnly && best)) {
      // Coast: keep the prediction moving, don't adopt a doubtful match.
      this._coasted++;
      this._center = predicted;
      return {
        kps: null,
        confidence: 0,
        // Ask once per blown budget, not once per frame — acknowledgeReacquire
        // resets the counter so the caller controls when it may ask again.
        needsReacquire: this._coasted > this.maxCoastFrames,
      };
    }

    if (!best) {
      // Unreachable: the guard above returns whenever `best` is null. Kept so
      // the narrowing is explicit rather than asserted.
      return { kps: null, confidence: 0, needsReacquire: false };
    }

    // Solid match (or accepted best guess) — update motion model.
    const dx = best.c.x - this._center.x;
    const dy = best.c.y - this._center.y;
    this._velocity = {
      x: VELOCITY_ALPHA * dx + (1 - VELOCITY_ALPHA) * this._velocity.x,
      y: VELOCITY_ALPHA * dy + (1 - VELOCITY_ALPHA) * this._velocity.y,
    };
    this._center = best.c;
    if (best.b) this._bounds = best.b;
    this._coasted = 0;

    return { kps: best.kps, confidence, needsReacquire: false };
  }
}
