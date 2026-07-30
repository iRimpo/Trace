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
## Cycle 1 — 20000 runs (human, 2026-07-29)

**Hypothesis:** the invariants that survived 2000 generated inputs will survive 20000.

**Change:** none to `lib/`. Raised `LOOP_RUNS` 2000 → 20000, fresh seed.

**Result:** 11 red tests. Two real, nine noise — and separating those two groups was
the whole cycle.

*The nine* were vitest's default 5000ms `testTimeout`; each property needs ~5.7s at
20000 runs. Not findings. Raised `testTimeout` in `loop/vitest.loop.config.ts`.

*The two* were the `one cue on screen` pair:

```
Counterexample: bpm 46.91730989308537, beatOneOffset 0
  cue window 0 closes at 3.19711424934247701035e-1
  cue window 1 opens  at 3.19711424934247645524e-1
  overlap: 5.551e-17 s  =  0.78 ULP
```

`LEAD_BEATS + HOLD_BEATS` is *exactly* 1 in binary, so the windows abut exactly in
real arithmetic. But `t_n + 0.25*beatS` and `t_(n+1) - 0.75*beatS` are two different
float expressions for the same real number, and they can land under 1 ULP apart. One
60fps frame is 1.67e-2 s — the sliver is 14 orders of magnitude below anything
observable.

**Decision: the property was wrong, not the code.** It asserted that float-computed
bounds partition the real line, which is unachievable in binary and was never
promised. `loop/program.md` names this case explicitly, and it is a human's call.

Rewrote both to assert the contract `cueAt` actually offers — whatever cue it returns
genuinely contains the time, and `null` only when nothing strictly does — plus a new
assertion on the *cause* of non-overlap: consecutive cues are ≥ 1 beat apart. A real
density regression breaks that by ~0.5 s, 8 orders of magnitude above the 1e-9
tolerance, so nothing real can hide in it.

**Result after fix:** `LOOP_RESULT verdict=pass runs=20000 seed=50083961 props=1`

**Lesson:** a red property is not automatically a bug. Two of eleven were real, and
the temptation — loosen the code until green — would have traded a correct
implementation for a badly-specified test. Sizing the tolerance against a real
physical quantity (one video frame) rather than against the failure is what keeps it
honest.

---

## Cycle 2 — 50000 runs, done condition (human, 2026-07-29)

**Hypothesis:** with the properties correctly specified, the invariants hold at the
loop's target of 50000 generated inputs with all five gates live.

**Change:** none. `FULL=1 LOOP_RUNS=50000`.

**Result:** `LOOP_RESULT verdict=pass runs=50000 seed=71620433 integrity=1 tsc=1 unit=1 props=1 build=1`

Ratchet floor: **50000**. Done condition in `loop/program.md` met.

**Lesson:** the two real findings both came from *disagreement between two derivations
of the same quantity* — count via floor vs via beat index, and window bounds via
addition vs subtraction. That is the shape worth pointing a property at next: anywhere
the code computes one value two ways.

---
## Cycles 3-6 — design ratchet (2026-07-29)

Four rules driven to their floor. Each cycle verified with tsc + 79 tests + 24
properties at 50000 runs + a production build, and the new Tailwind utilities
were checked against `.next-check` CSS rather than assumed — silent non-emission
is how the `/06` opacity bug shipped before.

| Rule | Before | After |
|---|---|---|
| transition_all | 74 | **0** |
| motion_no_reduce | 35 | **0** |
| small_touch_target | 8 | **0** |
| raw_hex | 332 | **56** |
| ease_in | 0 | 0 |

**Cycle 3 — transition_all.** `all` animates width/height/padding/margin too,
forcing layout and paint every frame. A `transition-ui` token names exactly the
composited properties. One mechanical swap, 74 sites.

**Cycle 4 — motion_no_reduce.** Spinners got `motion-reduce:animate-pulse`, not
`animate-none`: rotation is a vestibular trigger, opacity is not, and a loading
indicator that stops indicating is a worse outcome than one that pulses.

**Cycle 5 — small_touch_target.** A `.touch-target` utility expands the hit area
to 44px with a centred pseudo-element, leaving the visual alone. Enlarging small
icon buttons would make the dense practice control rows clumsy.

The rule then still counted all 8, because it keys on the `h-*` class — a proxy
for hit area, not hit area itself. Narrowed it to exempt elements carrying the
utility. Same judgement as cycle 1: the rule was measuring the wrong thing, and
an element with neither still fails.

**Cycle 6 — raw_hex.** 160 arbitrary values became token classes; 111 literals in
SVG attributes and data structures became imports. `lib/cuePalette.ts` already
existed for exactly this purpose and components had simply never migrated.

Mid-cycle the landing page rendered nearly blank and looked like a regression
from the automated rewrite. It was not: stashing the changes reproduced it
exactly. Pre-existing — framer entrance animations mid-flight plus a navbar
styled `text-white/70` for a dark hero that renders pale. **Recorded as a
separate finding, not fixed here.** The five minutes spent proving that beat
reverting a correct 271-site change on a hunch.

**Lesson:** three of the four rules were fixable mechanically once the right
token existed. The one that needed judgement — touch targets — needed it because
the rule measured a proxy. When a rule and a real fix disagree, check which one
is describing the actual goal before changing either.

---
