import type { MovementEvent, EventType } from "./movementEventDetector";
import type { CountGrid, Accent } from "./countGrid";

/**
 * Choreo timeline: the scan-time product that practice-time plays back.
 * All timing decisions (beat quantization, density capping) happen here,
 * once, so the runtime is deterministic. This JSON is what scan_cache stores.
 */

// 2: scan sampling moved to a real video-time clock (was a fixed 100ms/frame
//    simulated clock), so cue density no longer varies with scan frame rate.
//    Timelines cached under v1 have different cue spacing and must be re-scanned.
export const SCAN_VERSION = 2;

export interface TimelineEntry {
  id: number;                    // stable index within timeline
  time: number;                  // quantized video time (s)
  rawTime: number;               // original event videoTime (s)
  count: number | null;          // 1–8, null when no BPM
  measureIndex: number | null;
  accent: Accent | null;
  type: EventType;
  jointIndex: number;
  jointName: string;
  x: number; y: number; anchorX: number; anchorY: number;
  dx: number; dy: number; magnitude: number;
  personBounds?: { x1: number; y1: number; x2: number; y2: number };
  crowded?: boolean;
  lowConfidence?: boolean;
}

export interface ChoreoTimeline {
  version: number;
  bpm: number | null;
  beatOneOffset: number;
  videoHeight: number;
  entries: TimelineEntry[];      // sorted by time asc
}

/** Cue priority — extremities and full-body motion outrank subtle joints. */
const PRIORITY: Record<EventType, number> = {
  step:       5,
  "arm-both": 4,
  move:       3,
  head:       2,
  hip:        2,
  elbow:      1,
  shoulder:   1,
};

const MAX_PER_BUCKET = 3;
const NO_BPM_GRID_S  = 0.1;

function quantize(time: number, grid: CountGrid | null): number {
  if (grid?.hasBpm && grid.bpm) {
    const half = 60 / grid.bpm / 2;
    return grid.beatOneOffset + Math.round((time - grid.beatOneOffset) / half) * half;
  }
  return Math.round(time / NO_BPM_GRID_S) * NO_BPM_GRID_S;
}

export function buildChoreoTimeline(
  events: MovementEvent[],
  grid: CountGrid | null,
  videoHeight: number,
): ChoreoTimeline {
  // Bucket events by quantized time (key rounded to µs to dodge float noise)
  const buckets = new Map<number, { time: number; events: MovementEvent[] }>();
  for (const e of events) {
    const t = quantize(e.videoTime, grid);
    const key = Math.round(t * 1e6);
    const b = buckets.get(key) ?? { time: t, events: [] };
    b.events.push(e);
    buckets.set(key, b);
  }

  const picked: { time: number; e: MovementEvent }[] = [];
  for (const { time, events: bucket } of Array.from(buckets.values())) {
    // Dedupe per joint, keeping the strongest movement
    const byJoint = new Map<number, MovementEvent>();
    for (const e of bucket) {
      const cur = byJoint.get(e.jointIndex);
      if (!cur || e.magnitude > cur.magnitude) byJoint.set(e.jointIndex, e);
    }
    const kept = Array.from(byJoint.values())
      .sort((a, b) =>
        (PRIORITY[b.type] - PRIORITY[a.type]) || (b.magnitude - a.magnitude))
      .slice(0, MAX_PER_BUCKET);
    for (const e of kept) picked.push({ time, e });
  }

  picked.sort((a, b) => a.time - b.time);

  const entries: TimelineEntry[] = picked.map(({ time, e }, i) => {
    const info = grid?.hasBpm ? grid.count(time) : null;
    return {
      id: i,
      time,
      rawTime: e.videoTime,
      count: info?.count ?? null,
      measureIndex: info?.measureIndex ?? null,
      accent: info?.accent ?? null,
      type: e.type,
      jointIndex: e.jointIndex,
      jointName: e.jointName,
      x: e.x, y: e.y, anchorX: e.anchorX, anchorY: e.anchorY,
      dx: e.dx, dy: e.dy, magnitude: e.magnitude,
      ...(e.personBounds ? { personBounds: e.personBounds } : {}),
      ...(e.crowded ? { crowded: true } : {}),
      ...(e.lowConfidence ? { lowConfidence: true } : {}),
    };
  });

  return {
    version: SCAN_VERSION,
    bpm: grid?.hasBpm ? grid.bpm : null,
    beatOneOffset: grid?.beatOneOffset ?? 0,
    videoHeight,
    entries,
  };
}

/**
 * Adapt a timeline entry to the MovementEvent shape the canvas renderers
 * consume. Rendering only reads coordinates/type/bounds — `videoTime` maps
 * from the quantized time.
 */
export function entryToEvent(entry: TimelineEntry): MovementEvent {
  return {
    type: entry.type,
    jointIndex: entry.jointIndex,
    jointName: entry.jointName,
    videoTime: entry.time,
    x: entry.x, y: entry.y,
    anchorX: entry.anchorX, anchorY: entry.anchorY,
    dx: entry.dx, dy: entry.dy,
    magnitude: entry.magnitude,
    ...(entry.personBounds ? { personBounds: entry.personBounds } : {}),
    ...(entry.crowded ? { crowded: true } : {}),
    ...(entry.lowConfidence ? { lowConfidence: true } : {}),
  };
}
