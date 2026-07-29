# Cue Feedback Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Trace's practice overlay feedback with a precomputed, beat-locked cue script that shows exactly one instruction per count.

**Architecture:** Split the expensive BPM-free scan (producing `MovementEvent[]`) from cheap BPM-dependent composition (producing a `CueScript` of one `BeatCue` per beat). Cue visibility windows are exactly one beat wide and abut, so "one cue on screen" is a property of the data structure rather than a runtime limiter. Playback is a pure function `cueAt(script, videoTime)` with no cursor and no wall clock, making it scrub-, loop- and playbackRate-exact.

**Tech Stack:** Next.js 14 App Router, TypeScript, Canvas 2D, MediaPipe Pose (on-device), Supabase (jsonb cache), vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-29-cue-feedback-redesign-design.md`

## Global Constraints

- **Never run `npm run build` while the dev server is up.** Use `npm run build:check` (writes to `.next-check`). Plain `build` clobbers the running dev server's chunks and produces `Cannot find module './948.js'`.
- Verification trio for every task: `npx tsc --noEmit`, `npm test`, and `npm run build:check` before the final commit of a UI task.
- Tests live in `lib/__tests__/**/*.test.ts` only — that is the sole vitest `include` glob. Component tests are not currently wired up; UI tasks are verified by type-check, build, and device check.
- All AI stays on-device. Infra budget is **$0/month**. Do not add dependencies that require a paid tier.
- Joint indices are MediaPipe Pose: **odd = left, even = right**, nose = 0.
- Canvas colours come from `lib/cuePalette.ts` (`CUE_PALETTE`). Never inline a hex value in a renderer.
- Tailwind silently emits nothing for invalid opacity suffixes (`/06`) and for interpolated class names (`` `bg-${x}-100` ``). Write class names as complete literals.
- Deadline context: KCON submissions close **Aug 7, 2026**. Tasks 1–6 are the ones that fix the reported problems; 7–9 are the ones that make it usable on a phone.

---

## File Structure

**Created**
- `lib/cueScript.ts` — cue script types, `composeCueScript`, `cueAt`, `SCAN_VERSION`. Replaces `choreoTimeline.ts`.
- `lib/__tests__/cueScript.test.ts`
- `components/practice/CountStrip.tsx` — the 8-count strip (DOM, not canvas).
- `components/practice/TapTempoSheet.tsx` — tap-tempo + mark-count-1 fallback.
- `components/practice/InstallGate.tsx` — iOS Add-to-Home-Screen walkthrough.
- `supabase/migrations/008_scan_cache_v3.sql`

**Modified**
- `lib/movementEventDetector.ts` — `roll` event type, `movementOrigin`, circuity detection.
- `lib/overlayRenderer.ts` — collapse 7 renderers into `renderCue`.
- `lib/cuePalette.ts` — add `body` region.
- `lib/videoPreScan.ts` — return raw events; stop composing a timeline.
- `lib/scanCache.ts` — store/read `ScanPayload` (events + videoHeight) instead of a composed timeline.
- `components/practice/FeedbackCanvas.tsx` — consume `CueScript`; drop `judgeCue` and the wall-clock `beatPhase`.
- `components/practice/TraceTab.tsx` — script state, recomposition on BPM change, BPM gate, mount `CountStrip`.

**Deleted**
- `lib/choreoTimeline.ts`, `lib/__tests__/choreoTimeline.test.ts`, `lib/__tests__/cueRuntime.test.ts`
- `lib/cueRuntime.ts` keeps only `judgeCue` + `JUDGE_TOLERANCE_MS` for the Test tab; `CueRuntime` and `DEFAULT_LEAD_MS` go.

---

### Task 1: Cue script — types, composition, and lookup

The load-bearing task. Pure TypeScript, no UI, no DOM. Everything else depends on the types defined here.

**Files:**
- Create: `lib/cueScript.ts`
- Create: `lib/__tests__/cueScript.test.ts`

**Interfaces:**
- Consumes: `MovementEvent`, `EventType` from `lib/movementEventDetector.ts`; `CountGrid`, `Accent` from `lib/countGrid.ts`; `CueRegion` from `lib/cuePalette.ts`.
- Produces: `SCAN_VERSION`, `LEAD_BEATS`, `HOLD_BEATS`, `SCORE_FLOOR`, `CueMotion`, `BeatCue`, `CueScript`, `composeCueScript(events, grid, videoHeight)`, `cueAt(script, videoTime)`.

- [ ] **Step 1: Add the `body` region to the palette**

`lib/cuePalette.ts` — add one key to `CUE_PALETTE` and one to `CUE_LABELS`. Do **not** add it to `CUE_ORDER`: `CUE_COLORS` derives from that order and feeds decorative swatch rows in onboarding and marketing, so an eighth entry there would be an unrelated visual change.

```ts
export const CUE_PALETTE = {
  hand:     "#00D4FF", // Cyan     — wrists, fingers
  foot:     "#34D399", // Teal     — knees, ankles, heels, toes
  head:     "#FBBF24", // Amber    — nose/head
  elbow:    "#F97316", // Orange   — elbows
  hip:      "#A78BFA", // Purple   — hips
  shoulder: "#60A5FA", // Sky blue — shoulders
  armBoth:  "#F472B6", // Pink     — both-arms compound
  body:     "#E879F9", // Fuchsia  — torso rolls and waves
} as const;
```

```ts
export const CUE_LABELS: Record<CueRegion, string> = {
  hand:     "Hands",
  foot:     "Feet",
  head:     "Head",
  elbow:    "Elbows",
  hip:      "Hips",
  shoulder: "Shoulders",
  armBoth:  "Arms",
  body:     "Body",
};
```

Note the `foot` comment now claims knees; that is intentional and Task 1 Step 3 implements it.

- [ ] **Step 2: Write the failing tests**

Create `lib/__tests__/cueScript.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  composeCueScript, cueAt, SCAN_VERSION, LEAD_BEATS, HOLD_BEATS,
} from "../cueScript";
import { CountGrid } from "../countGrid";
import type { MovementEvent, EventType } from "../movementEventDetector";

function ev(over: Partial<MovementEvent> & { videoTime: number }): MovementEvent {
  return {
    type: "move" as EventType,
    jointIndex: 15,
    jointName: "L Wrist",
    x: 100, y: 100, anchorX: 90, anchorY: 90,
    dx: 10, dy: 10, magnitude: 60,
    ...over,
  } as MovementEvent;
}

const grid120 = new CountGrid(120, 0); // beat = 0.5s

describe("composeCueScript", () => {
  it("returns null without a BPM grid", () => {
    expect(composeCueScript([ev({ videoTime: 1 })], new CountGrid(null, 0), 720)).toBeNull();
    expect(composeCueScript([ev({ videoTime: 1 })], null, 720)).toBeNull();
  });

  it("places a cue exactly on the beat tick, not the raw event time", () => {
    const s = composeCueScript([ev({ videoTime: 0.53 })], grid120, 720)!;
    expect(s.cues).toHaveLength(1);
    expect(s.cues[0].time).toBeCloseTo(0.5, 5);
    expect(s.cues[0].count).toBe(2);
    expect(s.cues[0].beatIndex).toBe(1);
  });

  it("emits at most one cue per beat", () => {
    const s = composeCueScript(
      [
        ev({ videoTime: 0.50, jointIndex: 15, type: "move",  magnitude: 60 }),
        ev({ videoTime: 0.52, jointIndex: 27, type: "step",  magnitude: 60 }),
        ev({ videoTime: 0.48, jointIndex: 0,  type: "head",  magnitude: 60 }),
      ],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(1);
    // step (priority 5) outranks move (3) and head (2) at equal magnitude
    expect(s.cues[0].region).toBe("foot");
  });

  it("leaves a beat empty when nothing clears the score floor", () => {
    // shoulder priority 1 x (2/720) normalized magnitude = 0.0028, well under floor
    const s = composeCueScript(
      [ev({ videoTime: 0.5, jointIndex: 11, type: "shoulder", magnitude: 2 })],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(0);
  });

  it("suppresses the same joint continuing in the same direction", () => {
    const s = composeCueScript(
      [
        ev({ videoTime: 0.5, jointIndex: 15, dx: 30, dy: 0, magnitude: 60 }),
        ev({ videoTime: 1.0, jointIndex: 15, dx: 30, dy: 0, magnitude: 60 }),
      ],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(1);
    expect(s.cues[0].time).toBeCloseTo(0.5, 5);
  });

  it("keeps the same joint when it reverses direction", () => {
    const s = composeCueScript(
      [
        ev({ videoTime: 0.5, jointIndex: 15, dx:  30, dy: 0, magnitude: 60 }),
        ev({ videoTime: 1.0, jointIndex: 15, dx: -30, dy: 0, magnitude: 60 }),
      ],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(2);
  });

  it("maps joints to regions and side-aware labels", () => {
    const cases: [number, EventType, string, string][] = [
      [0,  "head",     "head",     "HEAD"],
      [16, "move",     "hand",     "R HAND"],
      [13, "elbow",    "elbow",    "L ARM"],
      [24, "hip",      "hip",      "HIPS"],
      [25, "move",     "foot",     "L KNEE"],
      [28, "step",     "foot",     "R FOOT"],
      [11, "shoulder", "shoulder", "L SHOULDER"],
    ];
    for (const [jointIndex, type, region, label] of cases) {
      const s = composeCueScript(
        [ev({ videoTime: 0.5, jointIndex, type, magnitude: 200 })], grid120, 720,
      )!;
      expect(s.cues[0].region, `joint ${jointIndex}`).toBe(region);
      expect(s.cues[0].label,  `joint ${jointIndex}`).toBe(label);
    }
  });

  it("maps a roll event to the body region with roll motion", () => {
    const s = composeCueScript(
      [ev({ videoTime: 0.5, jointIndex: 11, type: "roll", magnitude: 200 })],
      grid120, 720,
    )!;
    expect(s.cues[0].region).toBe("body");
    expect(s.cues[0].motion).toBe("roll");
    expect(s.cues[0].label).toBe("CHEST");
  });

  it("maps bilateral arm events to armBoth", () => {
    const s = composeCueScript(
      [ev({ videoTime: 0.5, jointIndex: 15, type: "arm-both", magnitude: 200 })],
      grid120, 720,
    )!;
    expect(s.cues[0].region).toBe("armBoth");
    expect(s.cues[0].label).toBe("BOTH ARMS");
  });

  it("stamps version, bpm, offset and videoHeight", () => {
    const s = composeCueScript([], new CountGrid(96, 0.2), 1080)!;
    expect(s.version).toBe(SCAN_VERSION);
    expect(s.bpm).toBe(96);
    expect(s.beatOneOffset).toBeCloseTo(0.2, 5);
    expect(s.videoHeight).toBe(1080);
    expect(s.cues).toEqual([]);
  });

  it("survives a JSON round-trip (the cache stores this)", () => {
    const s = composeCueScript([ev({ videoTime: 0.5 })], grid120, 720)!;
    const back = JSON.parse(JSON.stringify(s));
    expect(cueAt(back, 0.5)).not.toBeNull();
    expect(back.cues[0].jointIndex).toBe(15);
  });
});

describe("recomposition", () => {
  // The whole point of separating scan output from composition: correcting the
  // tempo after a scan must move every cue, without rescanning the video.
  const events = [
    ev({ videoTime: 0.50, jointIndex: 15, magnitude: 60 }),
    ev({ videoTime: 1.02, jointIndex: 27, type: "step", magnitude: 60 }),
  ];

  it("moves cue times onto a new grid when the BPM changes", () => {
    const at120 = composeCueScript(events, new CountGrid(120, 0), 720)!;
    const at90  = composeCueScript(events, new CountGrid(90,  0), 720)!;
    // beat is 0.5s at 120 and 0.6667s at 90, so the ticks differ
    expect(at120.cues[0].time).toBeCloseTo(0.5, 5);
    expect(at90.cues[0].time).toBeCloseTo(0.6667, 3);
    expect(at90.bpm).toBe(90);
  });

  it("re-labels counts when beat one moves", () => {
    const zero    = composeCueScript(events, new CountGrid(120, 0),   720)!;
    const shifted = composeCueScript(events, new CountGrid(120, 0.5), 720)!;
    expect(zero.cues[0].count).toBe(2);
    expect(shifted.cues[0].count).toBe(1);
  });

  it("is deterministic — same inputs give an identical script", () => {
    const a = composeCueScript(events, new CountGrid(120, 0), 720);
    const b = composeCueScript(events, new CountGrid(120, 0), 720);
    expect(a).toEqual(b);
  });
});

describe("cueAt", () => {
  const script = composeCueScript(
    [
      ev({ videoTime: 0.5, jointIndex: 15, dx: 30, dy: 0,  magnitude: 60 }),
      ev({ videoTime: 1.0, jointIndex: 16, dx: 0,  dy: 30, magnitude: 60 }),
    ],
    grid120, 720,
  )!;

  it("returns nothing before the first window opens", () => {
    // beat 0.5s, lead 0.75 beats x 0.5s = 0.375s -> opens at 0.125s
    expect(cueAt(script, 0.12)).toBeNull();
  });

  it("returns the cue inside its window", () => {
    expect(cueAt(script, 0.13)?.cue.time).toBeCloseTo(0.5, 5);
    expect(cueAt(script, 0.5)?.cue.time).toBeCloseTo(0.5, 5);
    expect(cueAt(script, 0.6)?.cue.time).toBeCloseTo(0.5, 5);
  });

  it("windows never overlap — adjacent cues hand off cleanly", () => {
    // cue A closes at 0.5 + 0.25*0.5 = 0.625; cue B opens at 1.0 - 0.375 = 0.625
    expect(cueAt(script, 0.624)?.cue.time).toBeCloseTo(0.5, 5);
    expect(cueAt(script, 0.626)?.cue.time).toBeCloseTo(1.0, 5);
  });

  it("reports progress with the hit moment at LEAD_BEATS", () => {
    const at = cueAt(script, 0.5)!;
    expect(at.progress).toBeCloseTo(LEAD_BEATS, 5);
    expect(LEAD_BEATS + HOLD_BEATS).toBeCloseTo(1, 5);
  });

  it("is pure — order and direction of calls do not matter", () => {
    const forward = [0.2, 0.4, 0.6, 0.8, 1.0].map(t => cueAt(script, t)?.cue.time ?? null);
    const back    = [1.0, 0.8, 0.6, 0.4, 0.2].map(t => cueAt(script, t)?.cue.time ?? null);
    expect(back.reverse()).toEqual(forward);
  });

  it("returns nothing after the last window closes", () => {
    expect(cueAt(script, 5)).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/cueScript.test.ts`
Expected: FAIL — `Failed to resolve import "../cueScript"`.

- [ ] **Step 4: Implement `lib/cueScript.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/cueScript.test.ts`
Expected: PASS, 18 tests.

If the region/label test fails on joint 11 with `"body"` instead of `"shoulder"`, check that `regionFor` gates the `body` branch on `e.type === "roll"` — a plain shoulder shift must stay `shoulder`.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `roll` does not exist on `EventType` yet, so `PRIORITY` and `MOTION` will error — add `| "roll"` to the `EventType` union in `lib/movementEventDetector.ts:120` now (the detector logic lands in Task 3):

```ts
export type EventType =
  | "move"       // wrist / finger / knee — directional arrow
  | "step"       // ankle / heel / toe    — expanding ring pulse
  | "head"       // nose                  — pulsing halo + direction tick
  | "hip"        // hip                   — diamond sway indicator
  | "elbow"      // elbow                 — arc bracket
  | "shoulder"   // shoulder              — T-bar shift indicator
  | "arm-both"   // both wrists together  — mirrored wing arcs
  | "roll";      // oscillatory / rotational motion — looping arrow
```

Adding this member will break the exhaustive `PRIORITY` map in `lib/choreoTimeline.ts:41`. Add `roll: 3` there as a stopgap; the whole file is deleted in Task 4.

- [ ] **Step 7: Commit**

```bash
git add lib/cueScript.ts lib/__tests__/cueScript.test.ts lib/cuePalette.ts lib/movementEventDetector.ts lib/choreoTimeline.ts
git commit -m "feat: beat-locked cue script with one cue per count

Composition walks the beat grid rather than the event list, so at most one
cue exists per beat by construction. Visibility windows are exactly one beat
wide (lead 0.75 + hold 0.25), which makes them abut rather than overlap and
removes the need for any runtime density cap.

cueAt() is a pure function of video time with no cursor, so scrubbing,
looping and playbackRate changes are exact."
```

---

### Task 2: Truthful travel origin

Today an arrow starts at a *cooldown-reset anchor* — wherever the joint happened to sit when its 800–1200ms cooldown last expired ([movementEventDetector.ts:231-239](../../../lib/movementEventDetector.ts)). That is why arrow length does not represent how far an arm travels.

**Files:**
- Modify: `lib/movementEventDetector.ts`
- Test: `lib/__tests__/movementEventDetector.test.ts`

**Interfaces:**
- Consumes: `PoseFrame` from `lib/motionAnalyzer.ts`.
- Produces: `movementOrigin(frames, jointIdx, lookbackMs?): { x: number; y: number } | null`.

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/movementEventDetector.test.ts`:

```ts
import { movementOrigin } from "../movementEventDetector";
import type { PoseFrame } from "../motionAnalyzer";

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
    // With a 250ms lookback only the last 3 frames (110,150 and one before)
    // are in scope, so the rest position at x=50 is out of reach.
    const o = movementOrigin(stillThenMove(), 15, 250)!;
    expect(o.x).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/__tests__/movementEventDetector.test.ts -t movementOrigin`
Expected: FAIL — `movementOrigin is not a function`.

- [ ] **Step 3: Implement `movementOrigin`**

Add to `lib/movementEventDetector.ts`, after the `PARENT_JOINT` map:

```ts
/** How far back to look for the start of the current gesture. */
const ORIGIN_LOOKBACK_MS = 600;

/**
 * Where the current movement actually began: the slowest point within the
 * lookback window.
 *
 * The detector's own `anchorX/anchorY` cannot answer this. That anchor is
 * reset when a joint's cooldown expires, so it marks an arbitrary moment up
 * to 1.2s before the gesture — which is why arrow length never represented
 * how far a limb travels. Walking back to the velocity minimum finds the rest
 * position the limb actually left from.
 */
export function movementOrigin(
  frames:     PoseFrame[],
  jointIdx:   number,
  lookbackMs: number = ORIGIN_LOOKBACK_MS,
  minConf:    number = 0.3,
): { x: number; y: number } | null {
  if (frames.length < 2) return null;
  const newest = frames[frames.length - 1];
  const cutoff = newest.wallTime - lookbackMs;

  let best: { x: number; y: number } | null = null;
  let bestSpeed = Infinity;

  for (let i = 0; i < frames.length - 1; i++) {
    const f = frames[i], next = frames[i + 1];
    if (f.wallTime < cutoff) continue;
    const a = f.kps[jointIdx], b = next.kps[jointIdx];
    if (!a || !b || (a.score ?? 0) < minConf || (b.score ?? 0) < minConf) continue;

    const dtS   = Math.max(0.001, (next.wallTime - f.wallTime) / 1000);
    const speed = Math.hypot(b.x - a.x, b.y - a.y) / dtS;
    if (speed < bestSpeed) { bestSpeed = speed; best = { x: a.x, y: a.y }; }
  }

  return best;
}
```

- [ ] **Step 4: Use it when emitting events**

In `MovementEventDetector.process`, replace the `anchorX` / `anchorY` fields of the pushed event so the emitted origin is the true movement start, falling back to the old anchor when the lookback finds nothing:

```ts
      if (dispPx / videoHeight >= effectiveFrac) {
        const origin = movementOrigin(frames, idx) ?? { x: st.anchorX, y: st.anchorY };
        rawEvents.push({
          type:       eventTypeFor(idx),
          jointIndex: idx,
          jointName:  name,
          videoTime:  lastFrame.videoTime,
          x:          kp.x,
          y:          kp.y,
          anchorX:    origin.x,
          anchorY:    origin.y,
          dx,
          dy,
          magnitude:  dispPx,
```

Leave `dx` / `dy` alone: they are the parent-relative displacement the threshold test uses, and rewriting them would change which events fire. `anchorX/anchorY` are purely for rendering.

- [ ] **Step 5: Run the full test file**

Run: `npx vitest run lib/__tests__/movementEventDetector.test.ts`
Expected: PASS. If a pre-existing test asserts an exact `anchorX`, update it to the rest position — that is the point of this change.

- [ ] **Step 6: Commit**

```bash
git add lib/movementEventDetector.ts lib/__tests__/movementEventDetector.test.ts
git commit -m "fix: arrow origin is the movement start, not a cooldown artifact

anchorX/anchorY was whatever position the joint held when its 800-1200ms
cooldown last expired, so arrow length encoded nothing a dancer could use.
Walk back to the velocity minimum within 600ms instead."
```

---

### Task 3: Roll and wave detection

A chest roll's net displacement is ≈ 0, so the displacement-threshold detector cannot see it at all. Detect *circuity* — high path length over low net displacement — instead.

**Files:**
- Modify: `lib/movementEventDetector.ts`
- Test: `lib/__tests__/movementEventDetector.test.ts`

**Interfaces:**
- Consumes: `PoseFrame`, `movementOrigin` from Task 2.
- Produces: `detectRoll(frames, jointIdx, videoHeight)`, and `roll` events emitted from `MovementEventDetector.process`.

- [ ] **Step 1: Write the failing test**

```ts
import { detectRoll } from "../movementEventDetector";

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/__tests__/movementEventDetector.test.ts -t detectRoll`
Expected: FAIL — `detectRoll is not a function`.

- [ ] **Step 3: Implement `detectRoll`**

```ts
// ── Roll / wave detection ─────────────────────────────────────────────────
//
// A chest roll, hip circle, arm wave or head roll is not a translation: the
// limb returns near where it started, so net displacement is ~0 and the
// displacement-threshold path above is blind to it. What distinguishes them
// is circuity — how much path is travelled per unit of net progress.
//
// Window is one beat at 120bpm. The detector has no BPM, and picking the
// window from the grid would make scan output depend on the count grid,
// which is exactly the coupling this redesign removes.
const ROLL_WINDOW_MS   = 500;
/** Below this many samples in the window a loop is indistinguishable from noise. */
const ROLL_MIN_FRAMES  = 3;
/** pathLength / netDisplacement above which motion reads as rotational. */
const ROLL_CIRCUITY    = 2.5;
/** Minimum path length, as a fraction of video height, to be a real gesture. */
const ROLL_MIN_PATH_FRAC = 0.06;

/** Joints whose oscillation reads as a roll: head, shoulders, wrists, hips. */
const ROLL_JOINTS = [0, 11, 12, 15, 16, 23, 24];

export interface RollSignal {
  magnitude: number;   // path length, video px
  x: number; y: number;        // newest position
  fromX: number; fromY: number; // oldest position in the window
}

/**
 * Detect rotational / oscillatory motion for one joint over the trailing
 * window. Returns null when the joint translates instead of loops, when the
 * gesture is too small, or when the scan sampled too few frames to tell.
 */
export function detectRoll(
  frames:      PoseFrame[],
  jointIdx:    number,
  videoHeight: number,
  minConf:     number = 0.3,
): RollSignal | null {
  if (frames.length < ROLL_MIN_FRAMES) return null;

  const newest = frames[frames.length - 1];
  const cutoff = newest.wallTime - ROLL_WINDOW_MS;

  const pts: { x: number; y: number }[] = [];
  for (const f of frames) {
    if (f.wallTime < cutoff) continue;
    const kp = f.kps[jointIdx];
    if (!kp || (kp.score ?? 0) < minConf) continue;
    pts.push({ x: kp.x, y: kp.y });
  }
  if (pts.length < ROLL_MIN_FRAMES) return null;

  let pathLength = 0;
  for (let i = 1; i < pts.length; i++) {
    pathLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  if (videoHeight <= 0 || pathLength / videoHeight < ROLL_MIN_PATH_FRAC) return null;

  const first = pts[0], last = pts[pts.length - 1];
  const net   = Math.hypot(last.x - first.x, last.y - first.y);
  const circuity = pathLength / Math.max(net, 1e-6);
  if (circuity < ROLL_CIRCUITY) return null;

  return { magnitude: pathLength, x: last.x, y: last.y, fromX: first.x, fromY: first.y };
}
```

- [ ] **Step 4: Emit roll events from `process`**

Inside `MovementEventDetector`, add a per-joint cooldown for rolls so one long roll does not fire every frame, then check rolls before the displacement loop's result is returned. Add to the class:

```ts
  private _rollFiredAt = new Map<number, number>();
```

Reset it in `reset()`:

```ts
  reset(): void { this._states.clear(); this._rollFiredAt.clear(); }
```

And in `process`, immediately before the final `return`:

```ts
    // Rolls are checked independently of the displacement thresholds above —
    // by definition they do not clear them.
    const ROLL_COOLDOWN_MS = 900;
    for (const idx of ROLL_JOINTS) {
      const firedAt = this._rollFiredAt.get(idx) ?? -Infinity;
      if (_now - firedAt < ROLL_COOLDOWN_MS) continue;

      const roll = detectRoll(frames, idx, videoHeight);
      if (!roll) continue;

      this._rollFiredAt.set(idx, _now);
      rawEvents.push({
        type:       "roll",
        jointIndex: idx,
        jointName:  TRACKED_JOINTS.find(j => j.idx === idx)?.name ?? `Joint ${idx}`,
        videoTime:  lastFrame.videoTime,
        x:          roll.x,     y:       roll.y,
        anchorX:    roll.fromX, anchorY: roll.fromY,
        dx:         roll.x - roll.fromX,
        dy:         roll.y - roll.fromY,
        magnitude:  roll.magnitude,
      });
    }

    return this._groupBilateral(this._deduplicateFeet(rawEvents));
```

`_groupBilateral` only merges joints 15/16 and 19/20 whose `type` it does not inspect, so a bilateral wrist *roll* could be merged into an `arm-both`. Guard it by skipping roll events:

```ts
      const left  = events.find(e => e.jointIndex === leftIdx  && e.type !== "roll");
      const right = events.find(e => e.jointIndex === rightIdx && e.type !== "roll");
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS across all files.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit` — expected clean.

```bash
git add lib/movementEventDetector.ts lib/__tests__/movementEventDetector.test.ts
git commit -m "feat: detect rolls and waves by circuity

A chest roll returns to where it started, so net displacement is ~0 and the
displacement-threshold detector is structurally blind to it. Measure path
length against net travel instead: high path, low net means rotation.

Emits nothing below 3 samples per window rather than guessing, so long
videos scanned at the 2fps floor stay silent instead of noisy."
```

---

### Task 4: Cache raw events, not a composed timeline

Recomposition on BPM change is only possible if the cache holds events. This also deletes `choreoTimeline.ts` and `cueRuntime.ts`'s `CueRuntime`.

**Files:**
- Modify: `lib/scanCache.ts`, `lib/videoPreScan.ts`, `lib/cueRuntime.ts`
- Delete: `lib/choreoTimeline.ts`, `lib/__tests__/choreoTimeline.test.ts`, `lib/__tests__/cueRuntime.test.ts`
- Create: `supabase/migrations/008_scan_cache_v3.sql`
- Test: `lib/__tests__/scanCache.test.ts`

**Interfaces:**
- Consumes: `SCAN_VERSION` from `lib/cueScript.ts` (Task 1).
- Produces: `ScanPayload { events: MovementEvent[]; videoHeight: number }`; `getCachedScan(key)`, `putCachedScan(key, payload, isUpload)`; `PreScanResult.events` and `.videoHeight` with `.timeline` removed.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/008_scan_cache_v3.sql`:

```sql
-- Scan cache v3: rows now store raw movement events instead of a composed
-- timeline, so a timeline can be recomposed when the BPM is detected or
-- corrected after the scan, without rescanning the video.
--
-- Nothing has ever purged superseded versions, so v1 and v2 rows are already
-- dead weight against the 500MB free-tier database limit. Drop them.
delete from scan_cache where scan_version < 3;
```

- [ ] **Step 2: Rewrite `lib/scanCache.ts`**

```ts
import { supabase } from "./supabase";
import { SCAN_VERSION } from "./cueScript";
import type { MovementEvent } from "./movementEventDetector";
import { identityKey, type VideoIdentity } from "./videoIdentity";

/**
 * Supabase-backed cache of scan output, keyed by video identity + practice
 * segment + scan version. Link-sourced scans are shared across users (a public
 * video's choreography is not private data); uploads are RLS-scoped to their
 * owner. Writes are best-effort: a failed put never breaks practice.
 *
 * v3 stores raw events rather than a composed timeline. Composition depends on
 * the BPM, which is often unknown or wrong at scan time; keeping the cache
 * BPM-free means correcting the tempo later recomposes instantly instead of
 * forcing a rescan. The `timeline` jsonb column is reused as-is to avoid a
 * schema change.
 */

export interface ScanCacheKey {
  identity: VideoIdentity;
  segmentStart: number;
  segmentEnd: number;
}

export interface ScanPayload {
  events: MovementEvent[];
  videoHeight: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function cacheRowKey(k: ScanCacheKey): {
  video_identity: string;
  segment_start: number;
  segment_end: number;
  scan_version: number;
} {
  return {
    video_identity: identityKey(k.identity),
    segment_start: round1(k.segmentStart),
    segment_end: round1(k.segmentEnd),
    scan_version: SCAN_VERSION,
  };
}

export async function getCachedScan(k: ScanCacheKey): Promise<ScanPayload | null> {
  try {
    const key = cacheRowKey(k);
    const { data, error } = await supabase
      .from("scan_cache")
      .select("timeline")
      .eq("video_identity", key.video_identity)
      .eq("segment_start", key.segment_start)
      .eq("segment_end", key.segment_end)
      .eq("scan_version", key.scan_version)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const payload = (data as { timeline: ScanPayload }).timeline;
    return payload?.events ? payload : null;
  } catch {
    return null; // offline / RLS miss — just rescan
  }
}

export async function putCachedScan(
  k: ScanCacheKey,
  payload: ScanPayload,
  isUpload: boolean,
): Promise<void> {
  try {
    let ownerId: string | null = null;
    if (isUpload) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return; // private row needs an owner — skip
      ownerId = data.user.id;
    }
    await supabase.from("scan_cache").insert({
      ...cacheRowKey(k),
      timeline: payload,
      is_upload: isUpload,
      owner_id: ownerId,
    });
  } catch {
    // Best-effort — cache misses are always recoverable by rescanning.
  }
}
```

- [ ] **Step 3: Update `lib/__tests__/scanCache.test.ts`**

The file stubs Supabase with a module-level `state.rows` array and a chainable `from()` mock; keep that stub exactly as it is. Change only the imports, the fixture, and the function names:

```ts
import { cacheRowKey, getCachedScan, putCachedScan, type ScanPayload } from "../scanCache";
import { SCAN_VERSION } from "../cueScript";
```

```ts
const payload: ScanPayload = { events: [], videoHeight: 720 };
```

Then rename every `getCachedTimeline` → `getCachedScan` and `putCachedTimeline` → `putCachedScan`, and replace the `timeline` fixture with `payload` at every call site and in every `state.rows` entry. Add one test, pushing a row onto `state.rows` the same way the existing tests do:

```ts
it("treats a pre-v3 payload as a miss", async () => {
  // A v2 row's jsonb has `entries`, not `events`. Returning it would render
  // nothing; a miss just costs one rescan.
  state.rows = [{
    ...cacheRowKey(key),
    timeline: { entries: [], version: 2 },
  }];
  expect(await getCachedScan(key)).toBeNull();
});
```

Reuse whatever `key` fixture the file already defines rather than creating another.

- [ ] **Step 4: Update `lib/videoPreScan.ts`**

Remove the `buildChoreoTimeline` and `CountGrid` imports, drop the `grid` parameter (it is the last positional argument), and change the result type:

```ts
export interface PreScanResult {
  events:      MovementEvent[];
  videoHeight: number;
  timings:     PreScanTimings;
}
```

The final return becomes:

```ts
  return {
    events: allEvents,
    videoHeight,
    timings: { /* unchanged */ },
  };
```

The scan no longer knows about the beat grid at all — that is the point of the split.

- [ ] **Step 5: Strip `lib/cueRuntime.ts` to just the judge**

Delete the `CueRuntime` class, `CueState`, `RuntimeCue`, `DEFAULT_LEAD_MS`, `DEFAULT_ACTIVE_MS` and `RESOLVED_LINGER_MS`. Keep `judgeCue`, `JUDGE_TOLERANCE_MS`, `HIT_RATIO` and `PARTIAL_RATIO`, and change `judgeCue`'s first parameter from `TimelineEntry` to `BeatCue`:

```ts
import type { BeatCue } from "./cueScript";
import type { PoseFrame } from "./poseRecorder";

/**
 * Judge one cue against the user's recorded pose frames. Retained for the
 * Test tab; the Trace overlay no longer scores, because live judgment is the
 * one thing that stopped its feedback from being fully precomputed.
 *
 * NOTE: not currently called from anywhere. Wiring it into TestTab is
 * deliberately out of scope for this change.
 */
export function judgeCue(
  cue: BeatCue,
  refVideoHeight: number,
  userFrames: PoseFrame[],
  userVideoHeight: number,
  toleranceMs: number = JUDGE_TOLERANCE_MS,
): "hit" | "partial" | "miss" {
```

Inside the body, `entry.jointIndex` becomes `cue.jointIndex` and `entry.time` becomes `cue.time` — both already exist on `BeatCue` from Task 1. `entry.magnitude` becomes `cue.magnitude`. No other changes to the judging maths.

- [ ] **Step 6: Delete the superseded modules**

```bash
git rm lib/choreoTimeline.ts lib/__tests__/choreoTimeline.test.ts lib/__tests__/cueRuntime.test.ts
```

- [ ] **Step 7: Run everything**

Run: `npm test` then `npx tsc --noEmit`
Expected: tests pass. `tsc` will still report errors in `FeedbackCanvas.tsx` and `TraceTab.tsx`, which Tasks 5–8 fix. Confirm every remaining error is in one of those two files before continuing.

- [ ] **Step 8: Commit**

```bash
git add -A lib supabase/migrations
git commit -m "refactor: cache raw scan events so tempo changes recompose

The cache stored a BPM-baked timeline, so detecting or correcting the tempo
after a scan could never take effect - which is why a null BPM on mobile
produced cues on a meaningless 0.1s grid and no counts at all.

Storing events instead makes recomposition free. Migration 008 also purges
v1/v2 rows, which nothing has ever cleaned up."
```

---

### Task 5: One cue renderer

Collapse seven bespoke renderers into ring + glyph + label + numeral.

**Files:**
- Modify: `lib/overlayRenderer.ts`

**Interfaces:**
- Consumes: `BeatCue`, `CueMotion` from `lib/cueScript.ts`; `CUE_PALETTE` from `lib/cuePalette.ts`.
- Produces: `renderCue(ctx, cue, progress, transform, beatPhase)`. `renderEvent` and `entryToEvent` are removed.

- [ ] **Step 1: Replace the renderers**

Keep `TransformParams`, `toCanvas`, `easeOut`, `curveControl`, `quadBezierAt`, `quadBezierTangent`, `drawDottedTrail`, `applyPersonClip` and `centeredTransform` exactly as they are. Delete `renderMoveArrow`, `renderStepPulse`, `renderHeadNod`, `renderElbowArc`, `renderHipSway`, `renderShoulderShift`, `renderBothArms`, `renderEvent` and `MAX_ARROW_PX`. Add:

```ts
import type { BeatCue } from "./cueScript";

/**
 * Progress at which the cue's moment arrives. Before this the cue is a
 * warning; after it, a confirmation. Must match LEAD_BEATS in cueScript.ts.
 */
const HIT_AT = 0.75;

/** Alpha envelope across the one-beat window: fade in, hold, fade out. */
function cueAlpha(progress: number): number {
  if (progress < 0.12) return progress / 0.12;
  if (progress < 0.85) return 1;
  return Math.max(0, 1 - (progress - 0.85) / 0.15);
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, color: string, progress: number, alpha: number,
): void {
  // Contracts toward the joint as the moment approaches, then pops on the hit.
  const approach = Math.min(1, progress / HIT_AT);
  const r = progress < HIT_AT
    ? 34 - 14 * easeOut(approach)
    : 20 + 16 * easeOut((progress - HIT_AT) / (1 - HIT_AT));

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle   = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.lineWidth   = progress >= HIT_AT ? 3.4 : 2.4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

/** Straight arrow along the true travel vector, clamped to the person's box. */
function drawTravelGlyph(
  ctx: CanvasRenderingContext2D,
  fx: number, fy: number, tx: number, ty: number,
  color: string, progress: number, alpha: number, maxLen: number,
): void {
  const rawLen = Math.hypot(tx - fx, ty - fy);
  if (rawLen < 6) return;

  const s = Math.min(1, maxLen / rawLen);
  const ex = fx + (tx - fx) * s, ey = fy + (ty - fy) * s;
  const [qx, qy] = curveControl(fx, fy, ex, ey, 0.18);
  const frac = Math.min(1, easeOut(progress / HIT_AT));

  drawDottedTrail(ctx, fx, fy, qx, qy, ex, ey, frac, color, alpha);

  const [tipX, tipY] = quadBezierAt(fx, fy, qx, qy, ex, ey, frac);
  const [ux,   uy]   = quadBezierTangent(fx, fy, qx, qy, ex, ey, frac);
  const head = Math.max(8, Math.min(rawLen, maxLen) * 0.28);

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 10;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";

  ctx.beginPath();
  ctx.moveTo(fx, fy);
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const [sx, sy] = quadBezierAt(fx, fy, qx, qy, ex, ey, (frac * i) / steps);
    ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  for (const sign of [1, -1]) {
    const a = 0.4 * sign;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - head * (ux * Math.cos(a) - uy * Math.sin(a)),
      tipY - head * (uy * Math.cos(a) + ux * Math.sin(a)),
    );
    ctx.stroke();
  }
}

/** Looping arrow: the roll / wave indicator. */
function drawRollGlyph(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, color: string, progress: number, alpha: number,
): void {
  const r     = 26;
  const sweep = Math.PI * 1.6 * Math.min(1, easeOut(progress / HIT_AT));
  const start = -Math.PI / 2;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.arc(x, y, r, start, start + sweep);
  ctx.stroke();

  // Arrowhead tangent to the loop's leading edge.
  const a  = start + sweep;
  const hx = x + r * Math.cos(a), hy = y + r * Math.sin(a);
  const tx = -Math.sin(a),        ty = Math.cos(a);
  for (const sign of [1, -1]) {
    const ang = 0.5 * sign;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(
      hx - 11 * (tx * Math.cos(ang) - ty * Math.sin(ang)),
      hy - 11 * (ty * Math.cos(ang) + tx * Math.sin(ang)),
    );
    ctx.stroke();
  }
}

/** Expanding pulse for foot contact. */
function drawStepGlyph(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, color: string, progress: number, alpha: number,
): void {
  if (progress < HIT_AT) return; // the pulse IS the landing
  const t = (progress - HIT_AT) / (1 - HIT_AT);
  ctx.globalAlpha = alpha * (1 - t);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 16;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20 + 30 * easeOut(t), 0, Math.PI * 2);
  ctx.stroke();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string, count: number,
  color: string, alpha: number,
): void {
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 6;
  ctx.textAlign   = "center";
  ctx.textBaseline = "middle";

  ctx.globalAlpha = alpha;
  ctx.fillStyle   = "#FFFFFF";
  ctx.font        = "700 15px system-ui, sans-serif";
  ctx.fillText(text, x, y - 46);

  ctx.fillStyle = color;
  ctx.font      = "800 30px system-ui, sans-serif";
  ctx.fillText(String(count), x, y + 52);
}

/**
 * Draw the single cue visible at this moment. One grammar for every body
 * part: a ring locating it, a glyph describing the motion, a label naming it,
 * and the count it lands on. Seven bespoke shapes were unreadable on a phone
 * and gave no way to tell which move belonged to which count.
 */
export function renderCue(
  ctx:       CanvasRenderingContext2D,
  cue:       BeatCue,
  progress:  number,
  transform: TransformParams,
  beatPhase: number,
): void {
  const p = cue.crowded && cue.personBounds
    ? centeredTransform(transform, cue.personBounds)
    : transform;

  ctx.save();
  applyPersonClip(ctx, cue.personBounds, p, !!cue.crowded);

  const color   = CUE_PALETTE[cue.region];
  const alpha   = cueAlpha(progress);
  const [tx, ty] = toCanvas(cue.toX,   cue.toY,   p);
  const [fx, fy] = toCanvas(cue.fromX, cue.fromY, p);

  // Arrows are clamped to a third of the dancer's height rather than a fixed
  // pixel count, so length stays meaningful at any zoom.
  const boxH   = cue.personBounds
    ? Math.abs(toCanvas(0, cue.personBounds.y2 * p.pvH, p)[1]
             - toCanvas(0, cue.personBounds.y1 * p.pvH, p)[1])
    : p.cH;
  const maxLen = Math.max(40, boxH / 3);

  switch (cue.motion) {
    case "travel": drawTravelGlyph(ctx, fx, fy, tx, ty, color, progress, alpha, maxLen); break;
    case "roll":   drawRollGlyph(ctx, tx, ty, color, progress, alpha);                   break;
    case "step":   drawStepGlyph(ctx, tx, ty, color, progress, alpha);                   break;
    case "hold":   break;
  }

  drawRing(ctx, tx, ty, color, progress, alpha * (0.85 + 0.15 * beatPhase));
  drawLabel(ctx, tx, ty, cue.label, cue.count, color, alpha);

  ctx.restore();
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `FeedbackCanvas.tsx` (still importing `renderEvent`). That is Task 6.

- [ ] **Step 3: Commit**

```bash
git add lib/overlayRenderer.ts
git commit -m "refactor: one cue grammar instead of seven bespoke shapes

Ring locates the body part, glyph describes the motion, label names it, and
the count says when. Seven distinct abstract shapes carried no body-part name
and no count, which is exactly what a dancer needs to read at a glance.

Arrow length is clamped to a third of the dancer's height rather than a flat
56px, so it stays meaningful at any zoom."
```

---

### Task 6: Rewire FeedbackCanvas to the script

**Files:**
- Modify: `components/practice/FeedbackCanvas.tsx`

**Interfaces:**
- Consumes: `CueScript`, `cueAt` from `lib/cueScript.ts`; `renderCue` from `lib/overlayRenderer.ts`; `CountGrid`.
- Produces: `FeedbackCanvasProps` with `script: CueScript | null` replacing `timeline`, and `userFramesRef` / `userVideoHeightRef` / `leadMs` / `showCounts` removed.

- [ ] **Step 1: Rewrite the component**

The count HUD moves out of canvas into `CountStrip` (Task 7), so this file draws cues only.

```tsx
"use client";

import { useRef, useEffect } from "react";
import type { RefObject } from "react";
import { renderCue } from "@/lib/overlayRenderer";
import type { TransformParams } from "@/lib/overlayRenderer";
import { cueAt } from "@/lib/cueScript";
import type { CueScript } from "@/lib/cueScript";

export interface FeedbackCanvasProps {
  proVideoRef: RefObject<HTMLVideoElement | null>;
  enabled:     boolean;
  proOffsetX:  number;
  proOffsetY:  number;
  proZoom:     number;
  mirrored:    boolean;
  script:      CueScript | null;
  /** Manual nudge (s) applied to the lookup time. */
  feedbackOffset?: number;
}

/**
 * Draws the one cue visible at the reference video's current time.
 *
 * Every frame is a pure lookup: `cueAt(script, t)` with no cursor and no wall
 * clock. Scrubbing, looping, skipping and playbackRate changes therefore land
 * on exactly the cue that belongs at that moment, rather than whatever the
 * previous frame happened to leave behind.
 */
export default function FeedbackCanvas({
  proVideoRef,
  enabled,
  proOffsetX,
  proOffsetY,
  proZoom,
  mirrored,
  script,
  feedbackOffset = 0,
}: FeedbackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const transformRef = useRef({ offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored });
  transformRef.current = { offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored };

  const scriptRef = useRef(script);
  scriptRef.current = script;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const offsetRef = useRef(feedbackOffset);
  offsetRef.current = feedbackOffset;

  useEffect(() => {
    let running = true;
    let rafId = 0;

    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);

      const canvas   = canvasRef.current;
      const proVideo = proVideoRef.current;
      if (!canvas || !proVideo) return;

      const parent = canvas.parentElement;
      if (parent && (canvas.width !== parent.offsetWidth || canvas.height !== parent.offsetHeight)) {
        canvas.width  = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const s = scriptRef.current;
      if (!enabledRef.current || !s) return;

      const pvW = proVideo.videoWidth, pvH = proVideo.videoHeight;
      if (pvW === 0 || pvH === 0) return;

      const t   = proVideo.currentTime + offsetRef.current;
      const hit = cueAt(s, t);
      if (!hit) return;

      // Beat phase from video time, never performance.now(). A wall-clock
      // oscillator made cues keep pulsing while the video was paused or
      // scrubbed, which is what made precomputed feedback feel live.
      const beatS     = 60 / s.bpm;
      const elapsed   = t - s.beatOneOffset;
      const beatPhase = ((elapsed % beatS) + beatS) % beatS / beatS;

      const transform: TransformParams = {
        pvW, pvH, cW: canvas.width, cH: canvas.height,
        ...transformRef.current,
      };
      renderCue(ctx, hit.cue, hit.progress, transform, beatPhase);
    }

    rafId = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [proVideoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 20 }}
    />
  );
}
```

Note the effect's dependency array is now just `[proVideoRef]` — `enabled` and `script` are read through refs, so toggling feedback no longer tears down and restarts the render loop.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `TraceTab.tsx`, which still passes `timeline`, `showCounts`, `leadMs`, `countGrid`, `userFramesRef` and `userVideoHeightRef`. Task 8 fixes those.

- [ ] **Step 3: Commit**

```bash
git add components/practice/FeedbackCanvas.tsx
git commit -m "fix: overlay feedback is now purely precomputed

Removes the two things that made a deterministic timeline feel live: the
wall-clock beatPhase oscillator (cues pulsed off performance.now(), so they
kept animating while paused) and live webcam hit/miss judging (whose verdicts
were sticky per cue and only cleared on backward seeks, so forward skips
showed stale results).

Every frame is now cueAt(script, videoTime) and nothing else."
```

---

### Task 7: The 8-count strip

The reported problem is "I can't tell what move is what count." This is the fix. DOM rather than canvas, so it can use safe-area insets and real type rendering.

**Files:**
- Create: `components/practice/CountStrip.tsx`

**Interfaces:**
- Consumes: `CountGrid` from `lib/countGrid.ts`; `CueScript`, `BeatCue` from `lib/cueScript.ts`; `CUE_PALETTE` from `lib/cuePalette.ts`.
- Produces: default-exported `CountStrip` taking `{ proVideoRef, grid, script, visible }`.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { CUE_PALETTE } from "@/lib/cuePalette";
import type { CountGrid } from "@/lib/countGrid";
import type { CueScript } from "@/lib/cueScript";

interface CountStripProps {
  proVideoRef: RefObject<HTMLVideoElement | null>;
  grid:        CountGrid | null;
  script:      CueScript | null;
  visible:     boolean;
}

/**
 * The 1-8 count, always on screen during practice.
 *
 * The previous indicator was a 14px violet circle at 0.35 alpha drawn onto the
 * cue canvas, and it only rendered when a BPM existed - so on a phone with no
 * detected tempo there was no way to tell which move belonged to which count.
 *
 * Cells carrying a cue show a dot in that body region's colour, so the shape
 * of the measure is readable before it arrives. Driven by rAF against the
 * video clock rather than React state: this updates every frame and re-rendering
 * the practice tree at 60fps would cost more than the strip is worth.
 */
export default function CountStrip({ proVideoRef, grid, script, visible }: CountStripProps) {
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef = useRef(grid);   gridRef.current = grid;
  const scriptRef = useRef(script); scriptRef.current = script;

  useEffect(() => {
    let running = true;
    let rafId = 0;
    let lastCount = -1;
    let lastMeasure = -1;

    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);

      const g = gridRef.current;
      const v = proVideoRef.current;
      if (!g?.hasBpm || !v) return;

      const info = g.count(v.currentTime);
      if (!info) return;
      if (info.count === lastCount && info.measureIndex === lastMeasure) return;
      lastCount = info.count;
      lastMeasure = info.measureIndex;

      // Which counts in THIS measure carry a cue.
      const s = scriptRef.current;
      const dots = new Array<string | null>(8).fill(null);
      if (s) {
        for (const cue of s.cues) {
          if (cue.measureIndex !== info.measureIndex) continue;
          dots[cue.count - 1] = CUE_PALETTE[cue.region];
        }
      }

      for (let i = 0; i < 8; i++) {
        const el = cellRefs.current[i];
        if (!el) continue;
        const active = i + 1 === info.count;
        el.dataset.active = active ? "1" : "0";
        const dot = el.querySelector<HTMLSpanElement>("[data-dot]");
        if (dot) {
          dot.style.background = dots[i] ?? "transparent";
          dot.style.opacity = dots[i] ? "1" : "0";
        }
      }
    }

    rafId = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [proVideoRef]);

  if (!visible || !grid?.hasBpm) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-30 flex justify-center px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <div className="flex w-full max-w-sm gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
          <div
            key={n}
            data-active="0"
            ref={el => { cellRefs.current[i] = el; }}
            className="group flex h-10 flex-1 flex-col items-center justify-center rounded-lg bg-black/35 backdrop-blur-sm transition-transform duration-100 data-[active='1']:scale-110 data-[active='1']:bg-white"
          >
            <span className="text-[13px] font-extrabold leading-none text-white/45 group-data-[active='1']:text-black">
              {n}
            </span>
            <span
              data-dot
              className="mt-1 h-1.5 w-1.5 rounded-full transition-opacity duration-100"
              style={{ opacity: 0 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Two Tailwind cautions from this codebase's history: `data-[active='1']:` variants must be written as complete literal class names (never interpolated), and the dot's colour is set via inline `style` because it is dynamic — a `bg-${color}` class would emit no CSS at all.

- [ ] **Step 2: Verify the build compiles the new variants**

Run: `npm run build:check`
Expected: build succeeds. Then confirm the arbitrary-variant classes actually emitted CSS:

```bash
grep -c "data-\[active" .next-check/static/css/*.css
```

Expected: a non-zero count. A zero here means Tailwind dropped the variant and the strip will never highlight.

- [ ] **Step 3: Commit**

```bash
git add components/practice/CountStrip.tsx
git commit -m "feat: always-visible 1-8 count strip

Replaces a 14px violet dot at 0.35 alpha that only drew when a BPM existed.
Cells carrying a cue show a dot in that region's colour, so the shape of the
measure is readable before it arrives.

Driven by rAF against the video clock rather than React state - it updates
every frame and re-rendering the practice tree at 60fps would cost more than
the strip is worth."
```

---

### Task 8: BPM gate, tap tempo, and recomposition in TraceTab

The largest UI task. Wires everything together and makes a count grid mandatory for feedback.

**Files:**
- Create: `components/practice/TapTempoSheet.tsx`
- Modify: `components/practice/TraceTab.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: no new exports; `TraceTab` holds `scanEvents` + derived `script` state.

- [ ] **Step 1: Create `TapTempoSheet.tsx`**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TapTempoSheetProps {
  onConfirm: (bpm: number) => void;
  onCancel:  () => void;
  detecting: boolean;
}

const MIN_TAPS = 4;
/** Taps further apart than this start a new measurement. */
const TAP_RESET_MS = 2500;

/**
 * Manual tempo entry, shown when auto-detection has not produced a BPM.
 *
 * Auto-detection fetches and decodes the entire video, which fails on iOS for
 * large files. Rather than silently composing cues against no grid - which
 * produced instructions on a meaningless 0.1s spacing and no counts at all -
 * feedback now requires a tempo, and this is how you supply one.
 */
export default function TapTempoSheet({ onConfirm, onCancel, detecting }: TapTempoSheetProps) {
  const tapsRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);

  const tap = useCallback(() => {
    const now = performance.now();
    const list = tapsRef.current;
    if (list.length > 0 && now - list[list.length - 1] > TAP_RESET_MS) list.length = 0;
    list.push(now);
    if (list.length > 12) list.shift();
    setTaps(list.length);

    if (list.length >= MIN_TAPS) {
      const spans: number[] = [];
      for (let i = 1; i < list.length; i++) spans.push(list[i] - list[i - 1]);
      const mean = spans.reduce((a, b) => a + b, 0) / spans.length;
      if (mean > 0) setBpm(Math.round(60000 / mean));
    }
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <p className="text-sm font-bold text-ink">Set the tempo</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/50">
          {detecting
            ? "Still listening to the track — or tap it out yourself."
            : "Cues land on counts, so Trace needs the tempo. Tap along with the beat."}
        </p>

        <button
          onClick={tap}
          className="mt-4 h-28 w-full rounded-xl bg-ink text-white transition-transform active:scale-[0.98]"
        >
          <span className="block text-3xl font-extrabold tabular-nums">
            {bpm ?? "–"}
          </span>
          <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            {taps < MIN_TAPS ? `Tap ${MIN_TAPS - taps} more` : "BPM · keep tapping to refine"}
          </span>
        </button>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/[0.06] py-2.5 text-xs font-semibold text-ink/60"
          >
            Cancel
          </button>
          <button
            disabled={bpm === null}
            onClick={() => bpm !== null && onConfirm(bpm)}
            className="flex-1 rounded-full bg-ink py-2.5 text-xs font-semibold text-white disabled:opacity-30"
          >
            Use this tempo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Replace timeline state with events + derived script in `TraceTab.tsx`**

Swap the imports:

```tsx
import { composeCueScript } from "@/lib/cueScript";
import type { CueScript } from "@/lib/cueScript";
import type { MovementEvent } from "@/lib/movementEventDetector";
import CountStrip from "@/components/practice/CountStrip";
import TapTempoSheet from "@/components/practice/TapTempoSheet";
import { getCachedScan, putCachedScan } from "@/lib/scanCache";
```

Delete the `ChoreoTimeline`, `DEFAULT_LEAD_MS`, `cueLeadMs` / `setCueLeadMs`, `CUE_LEAD_KEY`, `userFramesRef` and `userVideoHeightRef` declarations, plus the `timeline` state. Replace with:

```tsx
  const [scanEvents,     setScanEvents]     = useState<MovementEvent[] | null>(null);
  const [scanVideoHeight, setScanVideoHeight] = useState(0);
  const [showTapTempo,   setShowTapTempo]   = useState(false);

  /**
   * The script is derived, never stored. Recomposing when the tempo or the
   * count-1 offset changes is what makes correcting the beat instant instead
   * of a rescan — the scan output itself is tempo-free.
   */
  const script: CueScript | null = useMemo(
    () => (scanEvents ? composeCueScript(scanEvents, countGrid, scanVideoHeight) : null),
    [scanEvents, countGrid, scanVideoHeight],
  );
```

Add `useMemo` to the React import if it is not already there.

- [ ] **Step 3: Update `adoptTimeline` and `runScan`**

`adoptTimeline` becomes:

```tsx
  const adoptScan = useCallback((events: MovementEvent[], videoHeight: number) => {
    setScanEvents(events);
    setScanVideoHeight(videoHeight);
    setFeedbackEnabled(true);
    setScanCompleteCount(events.length);
    setScanCompleteFlash(true);
    setTimeout(() => setScanCompleteFlash(false), 2000);
  }, []);
```

The BPM-adoption branch is gone: the cache no longer carries a tempo, because it no longer bakes one in.

In `runScan`, replace every `adoptTimeline(...)` call with `adoptScan(result.events, result.videoHeight)`, drop the trailing `countGridRef.current` argument to `preScanVideo`, change `getCachedTimeline`/`putCachedTimeline` to `getCachedScan`/`putCachedScan` passing `{ events: result.events, videoHeight: result.videoHeight }`, and change the telemetry field:

```tsx
              cueCount: result.events.length,
```

`countGridRef` is now unused in `runScan` — delete the ref and its assignment.

- [ ] **Step 4: Gate the Feedback pill on a tempo**

Replace the Feedback button's `onClick` ([TraceTab.tsx:1171](../../../components/practice/TraceTab.tsx)):

```tsx
                onClick={() => {
                  // Cues land on counts, so a grid is a hard prerequisite. Without
                  // one the old code silently composed against a 0.1s spacing and
                  // showed no counts at all.
                  if (!countGrid?.hasBpm) { setShowTapTempo(true); return; }
                  if (scanEvents === null && scanProgress === null) { runScan("feedback"); return; }
                  if (scanEvents !== null) setFeedbackEnabled(f => !f);
                }}
```

and its label:

```tsx
                {!countGrid?.hasBpm
                  ? "Set tempo"
                  : feedbackEnabled ? "Feedback"
                  : scanEvents === null ? "Scan & Feedback" : "Feedback"}
```

Replace the two other `timeline === null` / `timeline !== null` reads in the file with `scanEvents`.

- [ ] **Step 5: Mount the new components**

Update the `FeedbackCanvas` element ([TraceTab.tsx:780](../../../components/practice/TraceTab.tsx)) and add the strip beside it:

```tsx
          <FeedbackCanvas
            proVideoRef={proVideoRef} enabled={feedbackEnabled}
            proOffsetX={proOffsetX} proOffsetY={proOffsetY} proZoom={proZoom}
            mirrored={mirrored} script={script} feedbackOffset={feedbackOffset}
          />
          <CountStrip
            proVideoRef={proVideoRef} grid={countGrid} script={script}
            visible={countsEnabled}
          />
```

And near the other overlays, inside the same positioned container:

```tsx
          {showTapTempo && (
            <TapTempoSheet
              detecting={beatDetecting}
              onCancel={() => setShowTapTempo(false)}
              onConfirm={(v) => {
                setBpm(v);
                setBeatOneOffset(proVideoRef.current?.currentTime ?? 0);
                setShowTapTempo(false);
              }}
            />
          )}
```

Confirming the tempo also marks count 1 at the current playhead — the user has just been tapping along, so this is the moment they know where "1" is.

The old canvas count indicator is gone, so drop `topOffset={64}` and the `countsEnabled` gate on the desktop count readout can stay as-is.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm test
npm run build:check
```

Expected: all three clean. This is the first point in the plan where `tsc` should report zero errors.

- [ ] **Step 7: Commit**

```bash
git add components/practice/TraceTab.tsx components/practice/TapTempoSheet.tsx
git commit -m "feat: require a tempo for feedback, and recompose instead of rescanning

The count grid is now a hard prerequisite: pressing Feedback without one opens
tap-tempo rather than silently composing cues against a meaningless 0.1s
spacing with no counts.

The script is derived state, so correcting the BPM or re-marking count 1
recomposes every cue instantly - previously the tempo was baked in at scan
time and could never be changed without a full rescan."
```

---

### Task 9: iOS install gate

iOS Safari exposes no Fullscreen API on iPhone, so Add to Home Screen is the only way to lose the browser chrome. The existing prompt fires 12s in and writes a permanent dismissal.

**Files:**
- Create: `components/practice/InstallGate.tsx`
- Modify: `components/InstallPrompt.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: default-exported `InstallGate`, mounted by the practice page.

- [ ] **Step 1: Create the gate**

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const SESSION_KEY = "trace_install_gate_bypassed";
const LEGACY_KEY  = "trace_install_prompt_dismissed";

function isIos(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Full-screen Add-to-Home-Screen walkthrough on the practice route.
 *
 * iPhone Safari has no Fullscreen API, so requestFullscreen is dead code
 * there and installing is the only way to practise without the address bar
 * eating the bottom of the frame. The previous nudge was a 12-second toast
 * that wrote a permanent localStorage dismissal, so a single tap silenced it
 * forever. This one is bypassable but session-scoped.
 */
export default function InstallGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // The old permanent flag would otherwise keep suppressing the nudge for
    // anyone who dismissed it once.
    localStorage.removeItem(LEGACY_KEY);
    if (!isIos() || isStandalone() || sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080808] px-6 text-center"
      style={{
        paddingTop:    "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
      <h2 className="mt-5 text-lg font-bold text-white">Add Trace to your Home Screen</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/55">
        Safari&apos;s address bar covers the bottom of the frame while you dance.
        Installing removes it — same app, full screen.
      </p>

      <ol className="mt-7 w-full max-w-xs space-y-3 text-left">
        {[
          "Tap the Share button in Safari's toolbar",
          "Scroll down and tap Add to Home Screen",
          "Open Trace from your Home Screen",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black">
              {i + 1}
            </span>
            <span className="text-sm leading-snug text-white/80">{step}</span>
          </li>
        ))}
      </ol>

      <button
        onClick={() => { sessionStorage.setItem(SESSION_KEY, "1"); setShow(false); }}
        className="mt-8 text-xs font-semibold text-white/35 underline underline-offset-4"
      >
        Continue in browser
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Mount it in `PracticeView`**

Two routes render practice — `app/practice/[videoId]/page.tsx:85` and `app/practice/session/page.tsx:63` — and both go through `components/practice/PracticeView.tsx`. Mount it there once rather than in both pages:

```tsx
import InstallGate from "@/components/practice/InstallGate";
```

and render `<InstallGate />` as the first child of `PracticeView`'s root element.

Do **not** mount it in `app/layout.tsx`. A full-screen takeover on the landing page or dashboard would be hostile, and it would fire before the user has any reason to want the app installed.

- [ ] **Step 3: Stop the global prompt double-nudging**

In `components/InstallPrompt.tsx`, leave the Android/desktop `beforeinstallprompt` path alone and remove the iOS branch, since `InstallGate` now owns that case. Delete the `isIosSafari` helper, the `ios` state, and the `if (isIosSafari())` block in the effect, along with the `{ios ? ... : ...}` conditional in the markup (keep the non-iOS copy).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm run build:check
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add components/practice/InstallGate.tsx components/practice/PracticeView.tsx components/InstallPrompt.tsx
git commit -m "feat: install walkthrough on the practice route

iPhone Safari has no Fullscreen API, so installing is the only way to practise
without the address bar covering the bottom of the frame. The old toast fired
12s in and wrote a permanent dismissal, so one tap silenced it forever; this
is session-scoped and clears that legacy flag."
```

---

### Task 10: Device verification

Everything above is reasoned from source. Nothing in Tasks 5–9 has been seen running.

- [ ] **Step 1: Full local verification**

```bash
npx tsc --noEmit && npm test && npm run build:check
```

- [ ] **Step 2: Push and let Vercel build a preview**

```bash
git push -u origin feedback-redesign
```

- [ ] **Step 3: Apply the migration**

Run `supabase/migrations/008_scan_cache_v3.sql` against project `rnmnusnhkomiypjzmcbw` (the "Trace" project — *not* "Trace-Fresh"). Confirm afterwards:

```sql
select scan_version, count(*) from scan_cache group by scan_version;
```

Expected: no rows with `scan_version < 3`.

- [ ] **Step 4: Check on a real iPhone**

The service worker caches `/_next/static/` cache-first and has survived every clearing strategy tried before. **If the phone looks stale, delete the PWA from the Home Screen and re-add it.**

Walk the list:

1. Open the preview URL in Safari → the install gate appears. Tap "Continue in browser", reload → it appears again (session-scoped, not permanent).
2. Install to Home Screen → gate is gone, no Safari chrome, video fills the frame top to bottom.
3. Load a video, press **Feedback** with no BPM → tap-tempo sheet opens rather than producing cues.
4. Tap out a tempo, confirm → count strip appears at the top and advances 1→8 in time with the music.
5. Run a scan → cues appear. **Count them: there must never be more than one on screen.**
6. Read a cue without moving: it should name a body part, show the count, and point where the limb travels.
7. Scrub the timeline back and forth to the same moment repeatedly → the identical cue appears every time, with no leftovers from where you scrubbed from.
8. Set an A–B loop over one 8-count and let it run several times → cues repeat identically each pass.
9. Change the BPM after scanning → cues re-land on the new grid **without a rescan**.
10. Find a section with a body roll → confirm a looping arrow appears rather than nothing.

- [ ] **Step 5: Record what the device actually showed**

Update `docs/HANDOFF.md`: replace the "THE CURRENT WORK" section with the outcome, noting anything from step 4 that did not behave as designed. Do not mark this work complete on the strength of a clean `tsc` — the last session's mobile fixes were reasoned from code and never confirmed.

```bash
git add docs/HANDOFF.md
git commit -m "docs: record device verification of the cue redesign"
```

---

## Notes for whoever executes this

- **Tasks 1–4 are pure `lib/` work** and fully covered by vitest. If you are dispatching subagents, these are safe to run with minimal supervision.
- **Tasks 5–9 have no automated coverage** — vitest only includes `lib/__tests__/`. Their gate is `tsc` + `build:check` + the device walkthrough in Task 10.
- **`tsc` will be red from the end of Task 4 until Step 6 of Task 8.** That is expected and the plan says so at each point. Do not "fix" the intermediate errors by patching `TraceTab.tsx` early — Task 8 rewrites those call sites wholesale.
- **The score floor (`SCORE_FLOOR = 0.08`) and the roll thresholds are the two things most likely to need tuning on real footage.** Both are named constants with comments explaining their derivation. Tune them against the TXT clip during Task 10, not by guessing earlier.
