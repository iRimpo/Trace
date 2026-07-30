# Cue-invariant loop — experiment log

Agent-writable memory. Append one entry per cycle, newest last. Never rewrite history:
a failed experiment is the most valuable line in this file.

Format per cycle: hypothesis → change → `LOOP_RESULT` → lesson.

---

## Cycle 0 — baseline (human, 2026-07-29)

**Hypothesis:** the cue system's three documented invariants — one cue on screen,
`cueAt` pure in video time, composition separable from scanning — hold, since `cueScript.ts`
sits at 98% line coverage with 79 example tests green.

**Change:** none to `lib/` yet. Wrote `loop/properties/cueScript.props.test.ts`: 19
properties over generated `MovementEvent[]`, BPM 40–220, beat-one offsets 0–5s, video
heights 1–1920, probing window boundaries rather than interiors.

**Result:** the hypothesis was wrong on the **first run**, at 300 runs.

```
Property failed after 31 tests
Counterexample: bpm 40.000000000000085, beatOneOffset 3.749999999999993, beatIndex -3
  expected count 6, received 5
Shrunk 94 time(s)
```

**Root cause:** `composeCueScript` stamped each cue with a `beatIndex` *and* a `count`
derived through a second, different arithmetic path — it rebuilt the tick time as
`beatOneOffset + beatIndex * beatS`, then handed that time back to `grid.count()`, which
recomputes `Math.floor(elapsed / beatDuration)`. The round trip is not exact:

```
elapsed / beatS = -3.0000000000000004   ->  Math.floor -> -4  ->  count 5
beatIndex       = -3                    ->                       count 6
```

So a cue could carry the wrong count number, highlight the wrong box in the 8-count
strip, and get the wrong `accent` — which drives its visual weight, downbeat vs snare.
Invisible to example tests because it needs a BPM and an offset that are both inexact.

**Fix:** added `CountGrid.tickAt(beatIndex)`, deriving time, count, measure and accent
from the integer index alone, and switched `composeCueScript` to it. `grid.count()` is
untouched and still correct for its two live-playhead callers, where flooring continuous
time is the intended behaviour.

**Result after fix:** `LOOP_RESULT verdict=pass runs=400 props=1 unit=1 tsc=1`

**Lesson:** 98% line coverage said the lines ran, not that the claims held. The bug lived
in the *agreement between two fields of the same object*, which no single-path example
test was ever going to probe. Any value derived twice by different arithmetic is a place
to point a property.

---
