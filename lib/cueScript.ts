import type { MovementEvent, EventType } from "./movementEventDetector";
import type { CountGrid, Accent } from "./countGrid";
import type { CueRegion } from "./cuePalette";

/**
 * The cue script: what to show, on which count. Composition is a pure,
 * cheap function of (scan events, count grid), deliberately separated from
 * the expensive scan so that detecting or correcting the BPM afterwards
 * recomposes instantly instead of forcing a rescan.
 *
 * Version 3 is the first version where the cache stores raw events rather
 * than a composed product, which is what makes that recomposition possible.
 */
export const SCAN_VERSION = 3;

/**
 * Cue lifetime, in beats. These must sum to exactly 1: adjacent windows then
 * abut rather than overlap, which is what guarantees a single cue on screen
 * without any runtime density cap. Do not change one without the other.
 */
export const LEAD_BEATS = 0.75;
export const HOLD_BEATS = 0.25;

/**
 * Minimum `priority x normalizedMagnitude` for a beat to earn a cue. A beat
 * below this shows nothing, which is information too — a silent count is part
 * of the choreography. Calibrated so a wrist move at its detection threshold
 * (0.05 x videoHeight, priority 3 -> 0.15) passes comfortably while a shoulder
 * twitch at its threshold (0.08, priority 1 -> 0.08) sits right at the line.
 */
export const SCORE_FLOOR = 0.08;

/** Direction agreement above which a repeated joint counts as the same gesture. */
const SAME_GESTURE_DOT = 0.7;

export type CueMotion = "travel" | "roll" | "step" | "hold";

export interface BeatCue {
  /** Absolute beat index since beatOne. Negative before beat one. */
  beatIndex:    number;
  count:        number;   // 1–8
  measureIndex: number;
  /** Exactly the grid tick time (s) — never a raw event time. */
  time:         number;
  accent:       Accent;
  region:       CueRegion;
  /** Short, all-caps, side-aware: "R HAND", "CHEST", "L FOOT". */
  label:        string;
  motion:       CueMotion;
  /** MediaPipe joint index — kept so `judgeCue` can score this cue in the Test tab. */
  jointIndex:   number;
  /** True movement start and end, in reference-video pixels. */
  fromX: number; fromY: number;
  toX:   number; toY:   number;
  magnitude:    number;
  personBounds?: { x1: number; y1: number; x2: number; y2: number };
  crowded?:      boolean;
}

export interface CueScript {
  version:       number;
  bpm:           number;
  beatOneOffset: number;
  videoHeight:   number;
  /** Sorted by time ascending. At most one per beat index. */
  cues:          BeatCue[];
}

/**
 * Cue priority. `roll` outranks everything: rolls are rare, hard to see in a
 * reference video, and are exactly what a dancer is most likely to miss.
 */
const PRIORITY: Record<EventType, number> = {
  roll:       6,
  step:       5,
  "arm-both": 4,
  move:       3,
  head:       2,
  hip:        2,
  elbow:      1,
  shoulder:   1,
};

const MOTION: Record<EventType, CueMotion> = {
  roll:       "roll",
  step:       "step",
  "arm-both": "travel",
  move:       "travel",
  head:       "travel",
  hip:        "travel",
  elbow:      "travel",
  shoulder:   "travel",
};

/** Odd joint indices are left, even are right. Nose (0) has no side. */
function sidePrefix(jointIndex: number): string {
  if (jointIndex === 0) return "";
  return jointIndex % 2 === 1 ? "L " : "R ";
}

function regionFor(e: MovementEvent): CueRegion {
  const i = e.jointIndex;
  if (e.type === "roll" && (i === 11 || i === 12 || i === 23 || i === 24)) return "body";
  if (e.type === "arm-both")                                              return "armBoth";
  if (i === 0)                                                            return "head";
  if (i === 11 || i === 12)                                               return "shoulder";
  if (i === 13 || i === 14)                                               return "elbow";
  if (i === 15 || i === 16 || i === 19 || i === 20)                       return "hand";
  if (i === 23 || i === 24)                                               return "hip";
  return "foot"; // knees (25,26) and the whole foot chain (27–32)
}

function labelFor(e: MovementEvent, region: CueRegion): string {
  const side = sidePrefix(e.jointIndex);
  switch (region) {
    case "head":     return "HEAD";
    case "body":     return e.jointIndex === 23 || e.jointIndex === 24 ? "HIPS" : "CHEST";
    case "armBoth":  return "BOTH ARMS";
    case "hip":      return "HIPS";
    case "shoulder": return `${side}SHOULDER`;
    case "elbow":    return `${side}ARM`;
    case "hand":     return `${side}HAND`;
    case "foot":     return e.jointIndex === 25 || e.jointIndex === 26
                       ? `${side}KNEE` : `${side}FOOT`;
  }
}

function score(e: MovementEvent, videoHeight: number): number {
  const normalized = videoHeight > 0 ? e.magnitude / videoHeight : 0;
  return PRIORITY[e.type] * normalized * (e.lowConfidence ? 0.5 : 1);
}

/** Unit direction of an event's displacement; zero vector when static. */
function unit(e: MovementEvent): { x: number; y: number } {
  const len = Math.hypot(e.dx, e.dy);
  return len < 1e-6 ? { x: 0, y: 0 } : { x: e.dx / len, y: e.dy / len };
}

export function composeCueScript(
  events:      MovementEvent[],
  grid:        CountGrid | null,
  videoHeight: number,
): CueScript | null {
  if (!grid?.hasBpm || !grid.bpm) return null;

  const beatS = 60 / grid.bpm;
  const half  = beatS / 2;

  // Bucket every event onto its nearest beat. Walking the grid rather than the
  // event list is what makes "one cue per count" structural.
  const byBeat = new Map<number, MovementEvent[]>();
  for (const e of events) {
    const beatIndex = Math.round((e.videoTime - grid.beatOneOffset) / beatS);
    const tick      = grid.beatOneOffset + beatIndex * beatS;
    if (Math.abs(e.videoTime - tick) > half) continue; // defensive; rounding makes this unreachable
    const list = byBeat.get(beatIndex) ?? [];
    list.push(e);
    byBeat.set(beatIndex, list);
  }

  const cues: BeatCue[] = [];
  let prev: { jointIndex: number; dir: { x: number; y: number } } | null = null;

  for (const beatIndex of Array.from(byBeat.keys()).sort((a, b) => a - b)) {
    const candidates = byBeat.get(beatIndex)!
      .slice()
      .sort((a, b) => score(b, videoHeight) - score(a, videoHeight));

    const winner = candidates[0];
    if (!winner || score(winner, videoHeight) < SCORE_FLOOR) continue;

    // A held pose is not a new instruction: skip a joint that carried the
    // previous cue and is still travelling the same way.
    const dir = unit(winner);
    if (prev && prev.jointIndex === winner.jointIndex) {
      const dot = prev.dir.x * dir.x + prev.dir.y * dir.y;
      if (dot > SAME_GESTURE_DOT) continue;
    }

    const time = grid.beatOneOffset + beatIndex * beatS;
    const info = grid.count(time);
    if (!info) continue;

    const region = regionFor(winner);
    cues.push({
      beatIndex,
      count:        info.count,
      measureIndex: info.measureIndex,
      time,
      accent:       info.accent,
      region,
      label:        labelFor(winner, region),
      motion:       MOTION[winner.type],
      jointIndex:   winner.jointIndex,
      fromX:        winner.anchorX, fromY: winner.anchorY,
      toX:          winner.x,       toY:   winner.y,
      magnitude:    winner.magnitude,
      ...(winner.personBounds ? { personBounds: winner.personBounds } : {}),
      ...(winner.crowded      ? { crowded: true }                     : {}),
    });
    prev = { jointIndex: winner.jointIndex, dir };
  }

  return {
    version:       SCAN_VERSION,
    bpm:           grid.bpm,
    beatOneOffset: grid.beatOneOffset,
    videoHeight,
    cues,
  };
}

/**
 * Which cue is visible at `videoTime`, and how far through its window.
 * A free function rather than a method because a CueScript round-trips
 * through JSON in the Supabase cache, and methods do not survive that.
 *
 * Pure: no cursor, no wall clock, no memory of previous calls. The same time
 * always yields the same result, which is what makes scrubbing, looping and
 * playbackRate changes exact.
 */
export function cueAt(
  script:    CueScript,
  videoTime: number,
): { cue: BeatCue; progress: number } | null {
  const beatS = 60 / script.bpm;
  const lead  = LEAD_BEATS * beatS;
  const hold  = HOLD_BEATS * beatS;

  // Binary search for the last cue whose window has already opened.
  let lo = 0, hi = script.cues.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (script.cues[mid].time - lead <= videoTime) { found = mid; lo = mid + 1; }
    else                                            { hi = mid - 1; }
  }
  if (found < 0) return null;

  const cue = script.cues[found];
  if (videoTime >= cue.time + hold) return null;

  return { cue, progress: (videoTime - (cue.time - lead)) / beatS };
}
