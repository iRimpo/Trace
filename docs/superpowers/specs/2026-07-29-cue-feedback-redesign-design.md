# Cue feedback redesign — design

**Date:** 2026-07-29
**Branch:** `feedback-redesign`
**Context:** Phone session on `trace-app-rho.vercel.app` practising a TXT / KCON routine surfaced five problems with the practice overlay. This spec covers all five.

---

## Problems, and what actually causes each

| # | Reported | Actual cause |
|---|---|---|
| 1 | Cues are overwhelming (~10 on screen at once) | `MAX_PER_BUCKET = 3` caps cues *per time bucket*, not per screen. Cue lifetime is `lead 600ms + active 700ms` = 1.3s. With no BPM, buckets are 0.1s wide → up to 39 concurrent cues. Nothing caps on-screen count. |
| 2 | Cues aren't on the 8-count | `quantize()` snaps to *half*-beats when BPM exists (16 slots per 8-count) and to a 0.1s grid when it doesn't. On the phone BPM is `null`, so there is no musical grid at all. |
| 3 | Feedback feels dynamic, not precomputed | `CueRuntime.cuesAt(t)` is already pure and seek-safe. Three other things break the illusion: (a) `beatPhase` falls back to a **wall-clock** `sin(2π·2·performance.now())` oscillator when BPM is null, so cues pulse off real time; (b) hit/miss badges are **live webcam judgments**, sticky per cue id, cleared only on backward seeks > 0.5s, so forward skips show stale results; (c) the timeline is composed once at scan time and never rebuilt, so BPM detected later never re-quantizes it. |
| 4 | Counts invisible | Both count displays are gated on `bpm !== null`. Same root cause as #2. The indicator is also a 14px violet circle at 0.35–0.55 alpha — unreadable on a phone even when it does draw. |
| 5 | Rolls / waves unrepresentable | All 7 event types are point-A→point-B displacement from an anchor. A chest roll's net displacement is ≈ 0, so the detector either never fires or fires as noise. |

**Bonus defect found during the audit:** arrow length does not represent an arm's travel. `anchorX/anchorY` is a *cooldown-reset anchor* — wherever the joint sat when its 800–1200ms cooldown last expired — then clamped to a flat `MAX_ARROW_PX = 56`.

**Fullscreen:** the PWA manifest, `viewportFit: cover`, and `apple-mobile-web-app-capable` are all already correct. iOS Safari exposes no Fullscreen API on iPhone, so Add to Home Screen is the only path; `toggleFullscreen` in `TraceTab` is dead code on that device. The existing nudge fires 12s in and writes a **permanent** `trace_install_prompt_dismissed` flag.

---

## Decisions taken

1. **The 8-count grid is required.** No BPM → no feedback. All fallback paths are deleted rather than tuned.
2. **One cue per count, one on screen.**
3. **Rolls are detected *and* represented**, as one body-region family — not named individually.
4. **Hit/miss scoring leaves the Trace overlay** and belongs to the Test tab. Trace becomes purely instructional and 100% precomputed.
5. **Practice is gated behind an install walkthrough on iOS**, with a bypass.

---

## Architecture

The load-bearing change: **separate "what the reference did" from "what to show."** Today `buildChoreoTimeline` fuses both at scan time with whatever BPM happened to exist.

```
scan  →  MovementEvent[]              BPM-free, cached        ← the expensive part
            ↓  composeCueScript(events, grid)                 ← pure, instant, re-runnable
         CueScript                    one entry per beat
            ↓  script.at(t)                                   ← pure lookup, binary search
         render
```

### `lib/cueScript.ts` (new — replaces `choreoTimeline.ts`'s role)

`composeCueScript(events: MovementEvent[], grid: CountGrid): CueScript | null`

- Returns `null` unless `grid.hasBpm`. Feedback is gated on a grid existing.
- **Walks the beat grid, not the event list.** For each beat tick, gathers events within ±½ beat.
- Scores candidates by `priority(type) × normalizedMagnitude × confidence`, reusing the existing `PRIORITY` map from `choreoTimeline.ts` with `roll` added. The score floor is a single tunable constant, calibrated on the TXT clip so that a typical 8-count yields roughly 4–6 cues rather than 8.
- Emits **exactly one** `BeatCue` per beat, or none when the winner falls below a score floor. A beat where nothing happens shows nothing — that is information.
- Suppresses a beat whose winner is the same joint moving in substantially the same direction as the previous beat's winner. A held pose is not a new instruction.

```ts
// CueRegion already exists in lib/cuePalette.ts and is reused as-is, with a
// single new key `body` added for torso rolls. Inventing a parallel taxonomy
// would desync the overlay from the marketing/onboarding illustrations that
// deliberately echo the same palette.
type CueRegion = "hand" | "foot" | "head" | "elbow" | "hip" | "shoulder"
               | "armBoth" | "body";   // `body` is new
type CueMotion = "travel" | "roll" | "step" | "hold";

interface BeatCue {
  beatIndex:    number;        // absolute beats since beatOne
  count:        number;        // 1–8
  measureIndex: number;
  time:         number;        // exactly the grid tick time
  accent:       Accent;
  region:       CueRegion;
  label:        string;        // "R HAND", "CHEST", "L FOOT"
  motion:       CueMotion;
  fromX: number; fromY: number;   // true movement start (video px)
  toX:   number; toY:   number;
  personBounds?: { x1: number; y1: number; x2: number; y2: number };
}

interface CueScript {
  version:       number;
  bpm:           number;
  beatOneOffset: number;
  videoHeight:   number;
  cues:          BeatCue[];       // sorted by time
}

// Free function, not a method — CueScript must survive a JSON round-trip
// through the cache, and methods do not.
function cueAt(script: CueScript, videoTime: number):
  { cue: BeatCue; progress: number } | null;
```

### One-on-screen is structural, not a cap

Cue lifetime moves from fixed milliseconds to **beats**:

- `LEAD_BEATS = 0.75`
- `HOLD_BEATS = 0.25`

Each visibility window is exactly one beat wide, so adjacent windows **abut and cannot overlap**. There is no density limiter to tune — the data structure is incapable of producing two simultaneous cues. At 120bpm this gives 375ms of anticipation and clears the cue 125ms after the hit. The outgoing cue's fade-out completes exactly as the incoming cue's fade-in begins.

`MAX_PER_BUCKET` is deleted.

### Precomputed and scrub-exact

`cueAt(script, t)` is a pure function of video time — no cursor, no wall clock, no accumulated state. The same `t` always yields the same feedback frame, regardless of scrub direction, loop, or `playbackRate`.

Three things are removed to make that true:

- `judgeCue` leaves the practice render loop entirely (this is the red ⊗ marks). It stays exported and tested in `lib/cueRuntime.ts` for the Test tab to consume later; **wiring it into Test is out of scope for this pass.**
- The wall-clock `beatPhase` fallback is replaced by beat phase derived from video time. Since a grid is now required, the fallback has no reason to exist.
- The no-BPM 0.1s quantize path is deleted.

### BPM changes recompose, never rescan

Composition is pure over cached `MovementEvent[]`, so tapping tempo or re-marking count 1 rebuilds the entire script in microseconds. This also repairs `handleAlignCount`, which today relabels the grid but leaves cue times on the old one.

Consequence: **`scan_cache` must store raw events**, not the composed timeline. `SCAN_VERSION` → 3.

---

## What the user sees

### 8-count strip

The fix for "I can't tell what move is what count." Eight cells across the top, below the safe-area inset, ~40px each. The current count is filled and scaled; the rest are dim. **Cells carrying a cue show a dot in that region's colour**, so the shape of the measure is readable before it arrives.

Replaces the 14px violet circle at 0.35–0.55 alpha.

### One cue grammar

Every cue renders as: a **ring** on the body part (colour from the existing `CUE_PALETTE`), a **motion glyph**, a **text label**, and its **count as a large numeral**.

| glyph | motion | means |
|---|---|---|
| arrow | `travel` | length = real travel distance |
| looping arrow | `roll` | roll / wave / circle |
| expanding pulse | `step` | foot contact |
| bare ring | `hold` | position held on this count |

The text label is deliberate. The stated purpose of this feedback is telling the user *which body part* moves; a coloured shape does not communicate that on a 6-inch screen.

Deleted from `overlayRenderer.ts`: `renderElbowArc`, `renderHipSway`, `renderShoulderShift`, `renderBothArms`, `renderHeadNod`. Retained and generalised: ring + glyph + label + numeral.

`renderEvent(ctx, MovementEvent, …)` becomes `renderCue(ctx, BeatCue, progress, transform, beatPhase)`. `entryToEvent` is deleted — the renderer consumes `BeatCue` directly, so there is no longer an adapter between timeline and canvas. `toCanvas`, `applyPersonClip`, and `centeredTransform` are unchanged.

### Truthful travel distance

New origin for `travel` cues: walk **back** through the frame buffer to where that joint's velocity last crossed zero — the actual start of the movement, not the cooldown artifact. Clamp the drawn arrow to the dancer's bounding box rather than a flat 56px.

---

## Roll detection

New signal in `movementEventDetector`. Over a sliding window of one beat, per tracked joint:

```
pathLength      = Σ |Δp|  between consecutive frames
netDisplacement = |p_end − p_start|
circuity        = pathLength / max(netDisplacement, ε)
```

High path length with low net displacement means oscillation or rotation. `circuity > 2.5` with `pathLength` above a magnitude floor emits a `roll` event.

Applied to: shoulders (11, 12) → chest roll · hips (23, 24) → hip circle · wrists (15, 16) → arm wave · nose (0) → head roll.

### Region mapping

`CueRegion` is derived from joint index and motion, not carried through from `EventType`. Joint indices are odd for left, even for right (nose is 0).

| joints | region | label |
|---|---|---|
| 0 | `head` | `HEAD` |
| 11, 12 | `body` when rolling, else `shoulder` | `CHEST` / `L SHOULDER` |
| 13, 14 | `elbow` | `R ARM` |
| 15, 16, 19, 20 | `armBoth` when bilateral, else `hand` | `BOTH ARMS` / `R HAND` |
| 23, 24 | `hip` | `HIPS` |
| 25, 26 | `foot` | `L KNEE` |
| 27–32 | `foot` | `R FOOT` |

Two notes: `body` is added to `CUE_PALETTE` and `CUE_LABELS` but **not** to `CUE_ORDER`, because `CUE_COLORS` derives from that order and feeds decorative swatch rows in onboarding and marketing — adding an eighth dot there would be an unrelated visual change. Knees move from the `hand` colour (where the current palette comment lumps them) to `foot`, which is what they are.

### Frame-rate constraint (accepted limitation)

Circuity needs roughly 4 samples per beat. Scan rate is `max(2, min(10, 300/span))` fps.

| trim length | scan fps | frames/beat @ 120bpm | rolls |
|---|---|---|---|
| 37s | 8.1 | ~4 | works |
| 90s | 3.3 | ~1.7 | marginal |
| 180s+ | 2.0 (floor) | ~1 | impossible |

Rolls therefore work on trimmed segments — the actual use case — and degrade on full-length video. **Below 3 frames/beat the detector emits nothing rather than noise.** Raising the frame budget is the deferred playback-sampling work and is explicitly out of scope here.

---

## BPM gate

`feedbackEnabled` requires `countGrid?.hasBpm`. When auto-detect has not landed or has failed, pressing **Feedback** opens a tap-tempo sheet (tap 4+ beats → BPM) together with mark-count-1, while auto-detect continues in the background to pre-fill.

Auto-detection is **not** being fixed. `detectBeatsFromVideo` fetches the whole file and `decodeAudioData`s it, which is a genuine memory limit on iOS with large clips and cannot be validated from this environment. What changes is that failure now leads somewhere instead of silently producing a broken timeline.

---

## Install gate

New `components/practice/InstallGate.tsx`. On the practice route, when iOS and not standalone: a full-screen Share → Add to Home Screen walkthrough with a "continue in browser" bypass, dismissal scoped to `sessionStorage` so it returns each session.

On mount it also clears the legacy `trace_install_prompt_dismissed` localStorage key, which currently suppresses the nudge permanently.

---

## Cache and migration

- `SCAN_VERSION` → 3.
- `scan_cache` row payload changes from composed timeline to raw `MovementEvent[]`. Order-of-magnitude size is unchanged (tens of KB).
- Add a purge of `scan_version < 3` rows. Nothing has ever purged old versions; v1 and v2 are already orphaned and this would be the third generation.

---

## Testing

`lib/` is platform-agnostic with existing vitest coverage.

| target | assertion |
|---|---|
| `composeCueScript` | never more than one cue per beat; windows never overlap; beats below the score floor stay empty; repeated-joint suppression fires |
| `script.at()` | pure — identical `t` yields identical result regardless of call order or scrub direction |
| recomposition | changing `bpm` or `beatOneOffset` moves every cue time onto the new grid |
| circuity detector | fires on a synthetic circular path; does not fire on a synthetic straight line; emits nothing below 3 frames/beat |
| travel origin | velocity-zero-crossing lookback returns the movement start, not the cooldown anchor |

`lib/__tests__/choreoTimeline.test.ts` and `cueRuntime.test.ts` are replaced by `cueScript.test.ts`.

---

## Deleted

- `judgeCue` from the practice render loop (moves to Test)
- wall-clock `beatPhase` fallback
- `MAX_PER_BUCKET` and the no-BPM 0.1s quantize path
- 5 of 7 bespoke cue renderers
- `toggleFullscreen`'s iOS path (dead code on iPhone)

---

## Build order

This is one coherent change but a large one. It lands in this order so each step is independently verifiable:

1. `lib/cueScript.ts` + tests — pure, no UI. Proves the one-cue-per-beat guarantee before anything renders.
2. Travel-origin fix in `movementEventDetector` + tests.
3. Roll detection (circuity) + tests.
4. Cache migration — raw events, `SCAN_VERSION` 3, purge.
5. `renderCue` and the renderer collapse.
6. `FeedbackCanvas` rewired to `CueScript`; `judgeCue` and the wall-clock `beatPhase` removed.
7. 8-count strip.
8. BPM gate + tap-tempo sheet.
9. `InstallGate`.

Steps 1–4 are pure `lib/` work covered by vitest. Steps 5–9 need the device check.

## Verification

```bash
npx tsc --noEmit
npm test
npm run build:check     # never `npm run build` while the dev server is up
```

Device check on a real iPhone at 375px is required before this is considered done — the mobile behaviour here is reasoned from code, not observed.
