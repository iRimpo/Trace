import { analyzeJointMotion } from "./motionAnalyzer";
import type { PoseFrame } from "./motionAnalyzer";

// ── Joint categories & thresholds ─────────────────────────────────────────

type JointCategory =
  | "head" | "wrist" | "finger" | "elbow"
  | "shoulder" | "hip" | "knee" | "ankle" | "heel" | "toe";

interface CategoryThresholds {
  /** Displacement threshold as a fraction of videoHeight */
  dispFrac:   number;
  /** Min ms between consecutive events on the same joint */
  cooldownMs: number;
}

const CATEGORY_THRESHOLDS: Record<JointCategory, CategoryThresholds> = {
  head:     { dispFrac: 0.03, cooldownMs: 1000 },
  wrist:    { dispFrac: 0.05, cooldownMs:  800 },
  finger:   { dispFrac: 0.05, cooldownMs:  800 },
  elbow:    { dispFrac: 0.06, cooldownMs:  900 },
  shoulder: { dispFrac: 0.08, cooldownMs: 1000 },
  hip:      { dispFrac: 0.04, cooldownMs:  900 },
  knee:     { dispFrac: 0.09, cooldownMs: 1000 },
  ankle:    { dispFrac: 0.07, cooldownMs: 1200 },
  heel:     { dispFrac: 0.07, cooldownMs: 1200 },
  toe:      { dispFrac: 0.07, cooldownMs: 1200 },
};

function getCategory(idx: number): JointCategory {
  if (idx === 0)                return "head";
  if (idx === 15 || idx === 16) return "wrist";
  if (idx === 19 || idx === 20) return "finger";
  if (idx === 13 || idx === 14) return "elbow";
  if (idx === 11 || idx === 12) return "shoulder";
  if (idx === 23 || idx === 24) return "hip";
  if (idx === 25 || idx === 26) return "knee";
  if (idx === 27 || idx === 28) return "ankle";
  if (idx === 29 || idx === 30) return "heel";
  return "toe"; // 31, 32
}

// ── Parent joint for relative displacement ────────────────────────────────
//
// Measuring displacement relative to a parent joint cancels out whole-body
// translation — e.g. a wrist cue only fires when the wrist moves relative
// to its shoulder, not when the whole body sways left.

const PARENT_JOINT: Readonly<Record<number, number | null>> = {
  0:  null,  // Nose      — absolute (head IS the body-center indicator)
  11: null,  // L Shoulder — absolute
  12: null,  // R Shoulder — absolute
  13: 11,    // L Elbow   relative to L Shoulder
  14: 12,    // R Elbow   relative to R Shoulder
  15: 11,    // L Wrist   relative to L Shoulder
  16: 12,    // R Wrist   relative to R Shoulder
  19: 15,    // L Index   relative to L Wrist
  20: 16,    // R Index   relative to R Wrist
  23: null,  // L Hip     — absolute
  24: null,  // R Hip     — absolute
  25: 23,    // L Knee    relative to L Hip
  26: 24,    // R Knee    relative to R Hip
  27: 23,    // L Ankle   relative to L Hip
  28: 24,    // R Ankle   relative to R Hip
  29: 27,    // L Heel    relative to L Ankle
  30: 28,    // R Heel    relative to R Ankle
  31: 27,    // L Foot Index relative to L Ankle
  32: 28,    // R Foot Index relative to R Ankle
};

// ── Joints tracked ────────────────────────────────────────────────────────

/** Priority order — extremities first, then core. */
export const TRACKED_JOINTS: { idx: number; name: string }[] = [
  // Head
  { idx:  0, name: "Nose"          },
  // Hands
  { idx: 15, name: "L Wrist"       },
  { idx: 16, name: "R Wrist"       },
  { idx: 19, name: "L Index"       },
  { idx: 20, name: "R Index"       },
  // Arms
  { idx: 13, name: "L Elbow"       },
  { idx: 14, name: "R Elbow"       },
  // Shoulders
  { idx: 11, name: "L Shoulder"    },
  { idx: 12, name: "R Shoulder"    },
  // Hips
  { idx: 23, name: "L Hip"         },
  { idx: 24, name: "R Hip"         },
  // Legs
  { idx: 25, name: "L Knee"        },
  { idx: 26, name: "R Knee"        },
  // Feet
  { idx: 27, name: "L Ankle"       },
  { idx: 28, name: "R Ankle"       },
  { idx: 29, name: "L Heel"        },
  { idx: 30, name: "R Heel"        },
  { idx: 31, name: "L Foot Index"  },
  { idx: 32, name: "R Foot Index"  },
];

// ── Event types ───────────────────────────────────────────────────────────

export type EventType =
  | "move"       // wrist / finger / knee — directional arrow
  | "step"       // ankle / heel / toe    — expanding ring pulse
  | "head"       // nose                  — pulsing halo + direction tick
  | "hip"        // hip                   — diamond sway indicator
  | "elbow"      // elbow                 — arc bracket
  | "shoulder"   // shoulder              — T-bar shift indicator
  | "arm-both";  // both wrists together  — mirrored wing arcs

export interface MovementEvent {
  type:       EventType;
  jointIndex: number;
  jointName:  string;
  videoTime:  number;
  /** Current (destination) position in video pixels */
  x: number;
  y: number;
  /** Anchor (origin) position in video pixels */
  anchorX: number;
  anchorY: number;
  /** Displacement from anchor to current (video pixels) */
  dx: number;
  dy: number;
  /** Euclidean displacement magnitude (video pixels) */
  magnitude: number;
  /** Parent joint index used for relative displacement (if any) */
  parentJointIndex?: number;
  /** Current parent position in video pixels */
  parentX?: number;
  parentY?: number;
  /** Normalised (0–1) bounding box of the tracked person at this frame. */
  personBounds?: { x1: number; y1: number; x2: number; y2: number };
  /** True when another dancer's hip-centre is within 0.15 normalised units. */
  crowded?: boolean;
}

// ── Event type assignment ─────────────────────────────────────────────────

function eventTypeFor(idx: number): EventType {
  if (idx === 0)                                                                    return "head";
  if (idx === 27 || idx === 28 || idx === 29 || idx === 30 || idx === 31 || idx === 32) return "step";
  if (idx === 13 || idx === 14)                                                     return "elbow";
  if (idx === 11 || idx === 12)                                                     return "shoulder";
  if (idx === 23 || idx === 24)                                                     return "hip";
  return "move"; // wrists (15,16), fingers (19,20), knees (25,26)
}

// ── Internal per-joint state ──────────────────────────────────────────────

interface AnchorState {
  anchorX:       number;
  anchorY:       number;
  parentAnchorX: number;
  parentAnchorY: number;
  initialized:   boolean;
  inCooldown:    boolean;
  lastFireAt:    number;
  lowConfCount:  number;
}

// ── Detector ─────────────────────────────────────────────────────────────

export class MovementEventDetector {
  private _states = new Map<number, AnchorState>();

  reset(): void { this._states.clear(); }

  /**
   * Process the latest frame buffer and return any new movement events.
   * Called on every pose-detection tick (~15 fps).
   */
  process(frames: PoseFrame[], videoHeight: number, now?: number): MovementEvent[] {
    if (frames.length < 1) return [];

    const _now      = now ?? performance.now();
    const lastFrame = frames[frames.length - 1];
    const rawEvents: MovementEvent[] = [];

    for (const { idx, name } of TRACKED_JOINTS) {
      const kp  = lastFrame.kps[idx];
      const st  = this._getState(idx);
      const cat = getCategory(idx);
      const thr = CATEGORY_THRESHOLDS[cat];

      const conf = kp?.score ?? 0;

      if (conf < 0.3) {
        st.lowConfCount++;
        if (st.lowConfCount >= 3) st.initialized = false;
        continue;
      }
      st.lowConfCount = 0;

      // Resolve parent joint
      const parentIdx = PARENT_JOINT[idx] ?? null;
      const parentKp  = parentIdx !== null ? lastFrame.kps[parentIdx] : null;
      // Skip if we need a parent but it's invisible
      if (parentIdx !== null && (!parentKp || (parentKp.score ?? 0) < 0.3)) continue;

      if (!st.initialized) {
        st.anchorX       = kp.x;
        st.anchorY       = kp.y;
        st.parentAnchorX = parentKp ? parentKp.x : 0;
        st.parentAnchorY = parentKp ? parentKp.y : 0;
        st.initialized   = true;
        st.inCooldown    = false;
        continue;
      }

      if (st.inCooldown) {
        if (_now - st.lastFireAt >= thr.cooldownMs) {
          st.anchorX       = kp.x;
          st.anchorY       = kp.y;
          st.parentAnchorX = parentKp ? parentKp.x : 0;
          st.parentAnchorY = parentKp ? parentKp.y : 0;
          st.inCooldown    = false;
        }
        continue;
      }

      // Compute displacement — relative when parent exists, absolute otherwise
      let dx: number, dy: number;
      if (parentKp !== null) {
        const relNowX = kp.x - parentKp.x;
        const relNowY = kp.y - parentKp.y;
        const relAncX = st.anchorX - st.parentAnchorX;
        const relAncY = st.anchorY - st.parentAnchorY;
        dx = relNowX - relAncX;
        dy = relNowY - relAncY;
      } else {
        dx = kp.x - st.anchorX;
        dy = kp.y - st.anchorY;
      }

      const dispPx = Math.sqrt(dx * dx + dy * dy);

      // Velocity-weighted threshold scaling:
      // Fast intentional movements fire at a reduced threshold; slow drift needs 100%.
      // Foot joints use a smaller discount (20%) to avoid firing on general leg motion.
      const motion         = frames.length >= 2 ? analyzeJointMotion(frames, idx) : null;
      const vel            = motion?.velocity ?? 0;
      const normalizedVel  = Math.min(vel / 400, 1);
      const isFootJoint    = cat === "ankle" || cat === "heel" || cat === "toe";
      const maxDiscount    = isFootJoint ? 0.2 : 0.4;
      const velocityScale  = 1.0 - maxDiscount * normalizedVel;
      const effectiveFrac  = thr.dispFrac * velocityScale;

      if (dispPx / videoHeight >= effectiveFrac) {
        rawEvents.push({
          type:       eventTypeFor(idx),
          jointIndex: idx,
          jointName:  name,
          videoTime:  lastFrame.videoTime,
          x:          kp.x,
          y:          kp.y,
          anchorX:    st.anchorX,
          anchorY:    st.anchorY,
          dx,
          dy,
          magnitude:  dispPx,
          ...(parentIdx !== null && parentKp !== null && {
            parentJointIndex: parentIdx,
            parentX:          parentKp.x,
            parentY:          parentKp.y,
          }),
        });
        st.inCooldown = true;
        st.lastFireAt = _now;
      }
    }

    return this._groupBilateral(this._deduplicateFeet(rawEvents));
  }

  /**
   * When ankle + heel + toe on the same foot all fire together, keep only
   * the highest-magnitude one to avoid 3 stacked step pulses.
   */
  private _deduplicateFeet(events: MovementEvent[]): MovementEvent[] {
    const FOOT_GROUPS: number[][] = [[27, 29, 31], [28, 30, 32]];
    const result: MovementEvent[] = [];
    const consumed = new Set<number>();

    for (const group of FOOT_GROUPS) {
      const footEvents = events.filter(e => group.includes(e.jointIndex));
      if (footEvents.length > 1) {
        footEvents.sort((a, b) => b.magnitude - a.magnitude);
        result.push(footEvents[0]);
        for (const fe of footEvents) consumed.add(fe.jointIndex);
      }
    }
    for (const ev of events) {
      if (!consumed.has(ev.jointIndex)) result.push(ev);
    }
    return result;
  }

  /**
   * When L and R wrists (or L and R index fingers) both fire in the same
   * process() call AND they're moving in roughly the same direction,
   * merge them into a single "arm-both" event positioned at the midpoint.
   */
  private _groupBilateral(events: MovementEvent[]): MovementEvent[] {
    const BILATERAL_PAIRS: [number, number][] = [[15, 16], [19, 20]];
    const grouped: MovementEvent[] = [];
    const consumed = new Set<number>();

    for (const [leftIdx, rightIdx] of BILATERAL_PAIRS) {
      const left  = events.find(e => e.jointIndex === leftIdx);
      const right = events.find(e => e.jointIndex === rightIdx);
      if (!left || !right) continue;

      const leftLen  = Math.sqrt(left.dx  * left.dx  + left.dy  * left.dy);
      const rightLen = Math.sqrt(right.dx * right.dx + right.dy * right.dy);
      if (leftLen < 1 || rightLen < 1) continue;

      const dot = (left.dx / leftLen) * (right.dx / rightLen)
                + (left.dy / leftLen) * (right.dy / rightLen);

      if (dot > 0.3) {
        consumed.add(leftIdx);
        consumed.add(rightIdx);
        grouped.push({
          type:       "arm-both",
          jointIndex: leftIdx,
          jointName:  "Both Arms",
          videoTime:  left.videoTime,
          x:          (left.x       + right.x)       / 2,
          y:          (left.y       + right.y)       / 2,
          anchorX:    (left.anchorX + right.anchorX) / 2,
          anchorY:    (left.anchorY + right.anchorY) / 2,
          dx:         (left.dx + right.dx) / 2,
          dy:         (left.dy + right.dy) / 2,
          magnitude:  (left.magnitude + right.magnitude) / 2,
        });
      }
    }

    for (const ev of events) {
      if (!consumed.has(ev.jointIndex)) grouped.push(ev);
    }
    return grouped;
  }

  private _getState(idx: number): AnchorState {
    if (!this._states.has(idx)) {
      this._states.set(idx, {
        anchorX: 0, anchorY: 0,
        parentAnchorX: 0, parentAnchorY: 0,
        initialized:  false,
        inCooldown:   false,
        lastFireAt:   0,
        lowConfCount: 0,
      });
    }
    return this._states.get(idx)!;
  }
}
