import type { Keypoint } from "./mediapipe";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PoseFrame {
  kps:       Keypoint[];
  videoTime: number;   // seconds (video.currentTime)
  wallTime:  number;   // ms (performance.now())
}

export interface JointMotion {
  /** Instantaneous velocity between the last two frames, video px/s */
  velocity:     number;
  /** Unit direction of net displacement over analysis window */
  direction:    { x: number; y: number };
  /** Net displacement vector over analysis window, video px */
  displacement: { x: number; y: number };
  /** Cumulative signed angular change over analysis window, radians */
  angleChange:  number;
  /** Recent positions oldest→newest, video px */
  positions:    { x: number; y: number }[];
}

// ── Config ────────────────────────────────────────────────────────────────

/** Duration of the sliding window used for displacement / angle analysis. */
const WINDOW_MS = 400;

// ── Frame buffer helper ───────────────────────────────────────────────────

/** Maintain a fixed-size ring buffer of PoseFrames. */
export class PoseFrameBuffer {
  private _buf: PoseFrame[] = [];
  constructor(private _maxFrames = 30) {}

  push(frame: PoseFrame): void {
    this._buf.push(frame);
    if (this._buf.length > this._maxFrames) this._buf.shift();
  }

  get frames(): PoseFrame[] { return this._buf; }
  get latest(): PoseFrame | null { return this._buf[this._buf.length - 1] ?? null; }
  get length(): number { return this._buf.length; }

  reset(): void { this._buf = []; }
}

// ── Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyse joint motion from the frame buffer.
 * Returns null if insufficient data.
 */
export function analyzeJointMotion(
  frames:   PoseFrame[],
  jointIdx: number,
  minConf   = 0.3,
): JointMotion | null {
  if (frames.length < 2) return null;

  // ── Instantaneous velocity (last 2 frames) ────────────────────────
  const f1 = frames[frames.length - 2];
  const f2 = frames[frames.length - 1];
  const k1 = f1.kps[jointIdx], k2 = f2.kps[jointIdx];
  let velocity = 0;

  if (k1 && k2 && (k1.score ?? 0) >= minConf && (k2.score ?? 0) >= minConf) {
    const ddx = k2.x - k1.x, ddy = k2.y - k1.y;
    const dtS  = Math.max(0.001, (f2.wallTime - f1.wallTime) / 1000);
    velocity   = Math.sqrt(ddx * ddx + ddy * ddy) / dtS;
  }

  // ── Windowed displacement + angular change ────────────────────────
  const windowStart = f2.wallTime - WINDOW_MS;
  const positions: { x: number; y: number }[] = [];
  let firstWall = Infinity, lastWall = -Infinity;

  for (const f of frames) {
    if (f.wallTime < windowStart) continue;
    const kp = f.kps[jointIdx];
    if (!kp || (kp.score ?? 0) < minConf) continue;
    positions.push({ x: kp.x, y: kp.y });
    if (f.wallTime < firstWall) firstWall = f.wallTime;
    if (f.wallTime > lastWall)  lastWall  = f.wallTime;
  }

  if (positions.length < 2) {
    return {
      velocity,
      direction:    { x: 0, y: 0 },
      displacement: { x: 0, y: 0 },
      angleChange:  0,
      positions:    [],
    };
  }

  const first = positions[0];
  const last  = positions[positions.length - 1];
  const dx    = last.x - first.x;
  const dy    = last.y - first.y;
  const dist  = Math.sqrt(dx * dx + dy * dy);
  const mag   = dist || 1;

  // Cumulative signed angular change (cross-product method)
  let angleChange = 0;
  for (let i = 1; i < positions.length - 1; i++) {
    const p0 = positions[i - 1], p1 = positions[i], p2 = positions[i + 1];
    const ax = p1.x - p0.x, ay = p1.y - p0.y;
    const bx = p2.x - p1.x, by = p2.y - p1.y;
    const lenA = Math.sqrt(ax * ax + ay * ay);
    const lenB = Math.sqrt(bx * bx + by * by);
    if (lenA > 1 && lenB > 1) {
      const cross = ax * by - ay * bx;
      const dot   = ax * bx + ay * by;
      angleChange += Math.atan2(cross, dot);
    }
  }

  return {
    velocity,
    direction:    { x: dx / mag, y: dy / mag },
    displacement: { x: dx, y: dy },
    angleChange,
    positions,
  };
}
