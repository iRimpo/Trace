/**
 * ════════════════════════════════════════════════════════════════════════
 *  VERIFIER — READ ONLY. The improvement loop's agent may NOT edit this
 *  file, anything else under loop/, or vitest.config.ts.
 *
 *  These are the architectural claims the cue system makes about itself,
 *  written as properties over generated input rather than fixed examples.
 *  An example test passes because someone chose kind numbers. A property
 *  fails when *any* input in the space breaks the claim, which is why the
 *  loop cannot make progress by weakening its own target.
 *
 *  Every property below traces to a specific documented promise:
 *    - docs/HANDOFF.md §5  "one-cue-on-screen is structural, not a limiter"
 *    - docs/HANDOFF.md §5  "cueAt is a pure function of video time"
 *    - docs/HANDOFF.md §5  "composition is separate from scanning"
 *    - lib/cueScript.ts:19 "adjacent windows abut rather than overlap"
 *    - lib/cueScript.ts:43 "exactly the grid tick time — never a raw event time"
 *    - lib/cueScript.ts:65 "sorted by time ascending. At most one per beat index"
 * ════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  composeCueScript,
  cueAt,
  LEAD_BEATS,
  HOLD_BEATS,
  SCAN_VERSION,
  type CueScript,
} from "@/lib/cueScript";
import { CountGrid } from "@/lib/countGrid";
import type { MovementEvent, EventType } from "@/lib/movementEventDetector";

// ── Loop wiring ─────────────────────────────────────────────────────────

/**
 * The ratchet metric. Each cycle the loop raises LOOP_RUNS and supplies a
 * fresh LOOP_SEED, so every cycle explores input the previous cycles never
 * reached. A property that survived 300 runs is a weaker claim than the same
 * property surviving 20,000; the floor only rises.
 *
 * Per-property values below act as minimums for a plain `npm test` run.
 */
const envRuns = Number(process.env.LOOP_RUNS ?? 0);
const runs = (base: number) => ({
  numRuns: Number.isFinite(envRuns) && envRuns > base ? envRuns : base,
  ...(process.env.LOOP_SEED ? { seed: Number(process.env.LOOP_SEED) } : {}),
});

// ── Generators ──────────────────────────────────────────────────────────

const EVENT_TYPES: EventType[] = [
  "move", "step", "head", "hip", "elbow", "shoulder", "arm-both", "roll",
];

/** Joint indices MediaPipe actually emits, spanning every region branch. */
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 19, 20, 23, 24, 25, 26, 27, 28, 31, 32];

const arbEvent = (maxTime: number) =>
  fc.record({
    type:       fc.constantFrom(...EVENT_TYPES),
    jointIndex: fc.constantFrom(...JOINTS),
    videoTime:  fc.double({ min: 0, max: maxTime, noNaN: true }),
    x:          fc.double({ min: 0, max: 1080, noNaN: true }),
    y:          fc.double({ min: 0, max: 1920, noNaN: true }),
    dx:         fc.double({ min: -500, max: 500, noNaN: true }),
    dy:         fc.double({ min: -500, max: 500, noNaN: true }),
    // Magnitude spans both sides of SCORE_FLOOR so the loop exercises both
    // the "earns a cue" and the "silent count" paths.
    magnitude:  fc.double({ min: 0, max: 600, noNaN: true }),
    lowConfidence: fc.boolean(),
    crowded:       fc.boolean(),
  }).map((e): MovementEvent => ({
    ...e,
    jointName: `j${e.jointIndex}`,
    anchorX:   e.x - e.dx,
    anchorY:   e.y - e.dy,
  }));

const arbEvents = (maxTime = 60) =>
  fc.array(arbEvent(maxTime), { minLength: 0, maxLength: 60 });

/** Real-world dance tempo range, plus the pathological edges. */
const arbBpm = fc.double({ min: 40, max: 220, noNaN: true });
const arbOffset = fc.double({ min: 0, max: 5, noNaN: true });
const arbHeight = fc.double({ min: 1, max: 1920, noNaN: true });

const arbScriptInputs = fc.record({
  events: arbEvents(),
  bpm:    arbBpm,
  offset: arbOffset,
  height: arbHeight,
});

/** Only generate scripts that actually produced cues; empty ones prove nothing. */
const arbNonEmptyScript = arbScriptInputs
  .map(({ events, bpm, offset, height }) =>
    composeCueScript(events, new CountGrid(bpm, offset), height))
  .filter((s): s is CueScript => s !== null && s.cues.length > 0);

// ── §5 "one-cue-on-screen is structural, not a limiter" ─────────────────

describe("one cue on screen", () => {
  test("at most one cue window contains any given time", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      const beatS = 60 / script.bpm;
      const lead  = LEAD_BEATS * beatS;
      const hold  = HOLD_BEATS * beatS;

      // Probe the window boundaries themselves, where an off-by-one lives,
      // rather than only sampling the interior.
      const probes = script.cues.flatMap(c => [
        c.time - lead, c.time - lead + 1e-9, c.time,
        c.time + hold - 1e-9, c.time + hold,
      ]);

      for (const t of probes) {
        const containing = script.cues.filter(
          c => c.time - lead <= t && t < c.time + hold);
        expect(containing.length).toBeLessThanOrEqual(1);
      }
    }), runs(300));
  });

  test("cueAt returns exactly the cue whose window contains the time", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      const beatS = 60 / script.bpm;
      const lead  = LEAD_BEATS * beatS;
      const hold  = HOLD_BEATS * beatS;

      const probes = script.cues.flatMap(c => [
        c.time - lead, c.time - lead * 0.5, c.time, c.time + hold * 0.5,
        c.time + hold, c.time + hold + 1e-6,
      ]);

      for (const t of probes) {
        const expected = script.cues.find(
          c => c.time - lead <= t && t < c.time + hold) ?? null;
        const actual = cueAt(script, t);

        if (expected === null) {
          expect(actual).toBeNull();
        } else {
          expect(actual).not.toBeNull();
          expect(actual!.cue.beatIndex).toBe(expected.beatIndex);
        }
      }
    }), runs(300));
  });

  test("LEAD_BEATS + HOLD_BEATS === 1, or windows stop abutting", () => {
    // lib/cueScript.ts:19 — the entire no-density-cap argument rests on this.
    expect(LEAD_BEATS + HOLD_BEATS).toBeCloseTo(1, 12);
  });
});

// ── §5 "cueAt is a pure function of video time" ─────────────────────────

describe("cueAt purity and seek safety", () => {
  test("same time yields an identical result regardless of call order", () => {
    fc.assert(fc.property(
      arbNonEmptyScript,
      fc.array(fc.double({ min: -10, max: 120, noNaN: true }), { minLength: 1, maxLength: 40 }),
      (script, times) => {
        // Forward pass, then the same times shuffled — a scrub. A cursor or a
        // wall clock anywhere in the path makes these disagree.
        const forward = times.map(t => cueAt(script, t));
        const shuffled = times
          .map((t, i) => ({ t, i }))
          .sort((a, b) => (a.t * 7919 % 1) - (b.t * 7919 % 1));
        const out: (ReturnType<typeof cueAt>)[] = new Array(times.length);
        for (const { t, i } of shuffled) out[i] = cueAt(script, t);

        for (let i = 0; i < times.length; i++) {
          expect(out[i]?.cue.beatIndex ?? null).toBe(forward[i]?.cue.beatIndex ?? null);
          expect(out[i]?.progress ?? null).toBe(forward[i]?.progress ?? null);
        }
      }), runs(200));
  });

  test("progress is always within [0, 1)", () => {
    fc.assert(fc.property(
      arbNonEmptyScript,
      fc.double({ min: -10, max: 120, noNaN: true }),
      (script, t) => {
        const r = cueAt(script, t);
        if (r === null) return;
        expect(r.progress).toBeGreaterThanOrEqual(0);
        expect(r.progress).toBeLessThan(1);
      }), runs(500));
  });

  test("a cue is visible at its own tick time", () => {
    // The dancer must see the cue on the count it belongs to.
    fc.assert(fc.property(arbNonEmptyScript, script => {
      for (const c of script.cues) {
        const r = cueAt(script, c.time);
        expect(r).not.toBeNull();
        expect(r!.cue.beatIndex).toBe(c.beatIndex);
      }
    }), runs(200));
  });
});

// ── CueScript structural claims (lib/cueScript.ts:43, :65) ──────────────

describe("script structure", () => {
  test("cues are sorted by time ascending with at most one per beat index", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      const beats = script.cues.map(c => c.beatIndex);
      expect(new Set(beats).size).toBe(beats.length);
      for (let i = 1; i < script.cues.length; i++) {
        expect(script.cues[i].time).toBeGreaterThan(script.cues[i - 1].time);
        expect(beats[i]).toBeGreaterThan(beats[i - 1]);
      }
    }), runs(300));
  });

  test("every cue time is exactly its grid tick, never a raw event time", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      const beatS = 60 / script.bpm;
      for (const c of script.cues) {
        expect(c.time).toBeCloseTo(script.beatOneOffset + c.beatIndex * beatS, 9);
      }
    }), runs(300));
  });

  test("count agrees with beatIndex under the grid's own 8-count wrap", () => {
    // composeCueScript derives `count` by calling grid.count(time), which
    // floors a recomputed elapsed value. That is a different arithmetic path
    // from beatIndex, so float drift can put them one count apart.
    fc.assert(fc.property(arbNonEmptyScript, script => {
      for (const c of script.cues) {
        expect(c.count).toBe(((c.beatIndex % 8) + 8) % 8 + 1);
      }
    }), runs(500));
  });

  test("count is always 1-8 and measureIndex is consistent", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      for (const c of script.cues) {
        expect(c.count).toBeGreaterThanOrEqual(1);
        expect(c.count).toBeLessThanOrEqual(8);
        expect(c.measureIndex).toBe(Math.floor(c.beatIndex / 8));
      }
    }), runs(300));
  });

  test("label is non-empty, all-caps, and free of raw joint numbers", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      for (const c of script.cues) {
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.label).toBe(c.label.toUpperCase());
        expect(c.label).not.toMatch(/\d/);
      }
    }), runs(200));
  });

  test("version is stamped so the cache can invalidate", () => {
    fc.assert(fc.property(arbNonEmptyScript, script => {
      expect(script.version).toBe(SCAN_VERSION);
    }), runs(50));
  });
});

// ── §5 "composition is separate from scanning" ─────────────────────────

describe("recomposition without rescan", () => {
  test("composeCueScript never mutates the events it was given", () => {
    // This is what makes the cache safe to recompose from. A mutation here
    // corrupts the cached events for every later tempo correction.
    fc.assert(fc.property(arbScriptInputs, ({ events, bpm, offset, height }) => {
      const before = JSON.stringify(events);
      composeCueScript(events, new CountGrid(bpm, offset), height);
      expect(JSON.stringify(events)).toBe(before);
    }), runs(300));
  });

  test("composition is deterministic for identical inputs", () => {
    fc.assert(fc.property(arbScriptInputs, ({ events, bpm, offset, height }) => {
      const a = composeCueScript(events, new CountGrid(bpm, offset), height);
      const b = composeCueScript(events, new CountGrid(bpm, offset), height);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }), runs(300));
  });

  test("changing the tempo recomposes from the same events without error", () => {
    fc.assert(fc.property(
      arbEvents(), arbBpm, arbBpm, arbOffset, arbHeight,
      (events, bpm1, bpm2, offset, height) => {
        const first  = composeCueScript(events, new CountGrid(bpm1, offset), height);
        const second = composeCueScript(events, new CountGrid(bpm2, offset), height);
        // Both must be well-formed; the events survive to be reused.
        for (const s of [first, second]) {
          if (s === null) continue;
          expect(s.cues.every(c => Number.isFinite(c.time))).toBe(true);
          expect(s.bpm).toBeGreaterThan(0);
        }
        if (first && second) expect(second.bpm).toBeCloseTo(bpm2, 9);
      }), runs(300));
  });

  test("no BPM means no script, never a fabricated grid", () => {
    // The root cause of the original overwhelm bug was a 0.1s fallback grid
    // with no musical meaning. Composition must refuse instead.
    fc.assert(fc.property(arbEvents(), arbHeight, (events, height) => {
      expect(composeCueScript(events, new CountGrid(null, 0), height)).toBeNull();
      expect(composeCueScript(events, null, height)).toBeNull();
      expect(composeCueScript(events, new CountGrid(0, 0), height)).toBeNull();
    }), runs(100));
  });
});

// ── Degenerate input must degrade, not crash ───────────────────────────

describe("robustness", () => {
  test("zero video height yields no cues rather than a crash", () => {
    fc.assert(fc.property(arbEvents(), arbBpm, (events, bpm) => {
      const s = composeCueScript(events, new CountGrid(bpm, 0), 0);
      expect(s).not.toBeNull();
      expect(s!.cues).toEqual([]);
    }), runs(100));
  });

  test("an empty event list yields an empty script, not null", () => {
    fc.assert(fc.property(arbBpm, arbOffset, arbHeight, (bpm, offset, height) => {
      const s = composeCueScript([], new CountGrid(bpm, offset), height);
      expect(s).not.toBeNull();
      expect(s!.cues).toEqual([]);
    }), runs(100));
  });

  test("cueAt on an empty script is always null", () => {
    fc.assert(fc.property(
      arbBpm, fc.double({ min: -100, max: 1000, noNaN: true }),
      (bpm, t) => {
        const empty: CueScript = {
          version: SCAN_VERSION, bpm, beatOneOffset: 0, videoHeight: 1080, cues: [],
        };
        expect(cueAt(empty, t)).toBeNull();
      }), runs(200));
  });
});
