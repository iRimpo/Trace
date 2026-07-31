# Trace — UX overhaul program (strategic plan)

**Written:** 2026-07-30 · **Branch at time of writing:** `design-overhaul` · **Status:** plan only, nothing built.

> **Pointer line for a fresh chat:**
> `Read docs/superpowers/plans/2026-07-30-trace-ux-program.md, then docs/DESIGN_SYSTEM.md and docs/HANDOFF-DESIGN.md. Start at the workstream I name.`

---

## Progress log

**2026-07-30 — Richard picked Ordering A (§10), then asked to run every workstream straight through
rather than freezing.** All ten workstreams are implemented on branch `ws0-foundations` (15 commits off
`design-overhaul`).

| WS | Status |
|---|---|
| **WS0** Foundations | ✅ `useIsPortrait`, `lib/motion.ts`, `DESIGN_SYSTEM.md` §7. **`/taste` artefact NOT done** — needs a browser. |
| **WS1** Type + colour | ✅ `duo-teal` splits the cue accent off the "go" green; Nunito as `font-display`; raw palette classes at 0 |
| **WS2** Motion system | ✅ folded into WS0 — 8 divergent springs → 3 named; stagger via `staggerDelay` |
| **WS3** App chrome | ✅ `components/nav/AppNav.tsx` — bottom bar in portrait, left rail otherwise |
| **WS4** Sound + haptics | ✅ `lib/feedback.ts`, synthesised (no assets, no `CACHE_VERSION` bump), 16 tests |
| **WS5** Character + celebration | ✅ choreographed reveal, `Confetti`, mascot reacts to band, streak milestones |
| **WS6** Calibration portrait | ✅ media 25% → ~83% of viewport |
| **WS7** Comparison views | ✅ orientation switch, detail panel as a sheet, **stacked mode built** |
| **WS8** Dashboard resume | ✅ resume state in IndexedDB v2, surfaced on device tiles, restored on mount, 6 tests |
| **WS9** Ghost + modes | ✅ blend modes (§7A), hold-to-peek (Opt 1), drill mode (Opt 3), 12 tests. **Opt 2 PiP deferred** per plan. |

**Verification at every commit:** `tsc` 0 · 139 unit tests (was 79) · 24 properties incl. the design
ratchet · `build:check` clean including lint · new Tailwind utilities checked against emitted CSS.

### Corrections to this document, found while executing it

1. **§0.1 is wrong that the redesign merged to `main`.** `design-overhaul` was 10 commits *ahead* of
   `main`. Nothing had shipped.
2. **§7A prescribes `ctx.globalCompositeOperation`. That cannot work.** A canvas composite op blends
   against what is already in *that canvas*, cleared to transparent every frame; the webcam is a
   separate sibling `<video>`. Only CSS `mix-blend-mode` on the element composites against it.
3. **§7A offers only `screen`/`difference`/`lighten`.** A K-pop practice video is usually a *bright*
   studio, which is the case `screen` blows out to white. `multiply` is the needed opposite polarity.
4. **§5 WS3 proposes Practice · Progress · Profile.** Progress and Profile are not routes that exist.
   The bar carries what is real rather than inventing empty pages.
5. **WS4 assumes audio assets precached by `sw.js`.** Synthesised cues need neither.

### Two bugs this document did not predict

- **Canvas overlays mapped video→canvas by stretching.** Correct only while a pane matched the camera's
  aspect ratio. Going full-bleed in portrait would have thrown the calibration skeleton off the body
  entirely. Fixed via `lib/videoFit.ts` (+10 tests). **Any workstream that reshapes a media pane must
  check the canvas drawn over it.**
- **The top edge collision was a paint overlap, not a near-miss.** The TRACE badge covered counts 1–2
  and the utility cluster covered counts 6–8 — the downbeat was under the wordmark.

### §11 ratchet rules — final counts, ready to pin

The verifier is hook-protected, so these remain for Richard to add to `loop/verify.sh`.

| Rule | Repo-wide | `components/practice/` |
|---|---|---|
| `raw_tailwind_palette` | **0** | **0** |
| `hidden_on_mobile` | **0** | **0** |
| `stage_type_floor` | 6 | **0** |
| `magic_duration` | 65 | — |

Three of these can be pinned at **0 today**. `magic_duration` is the one still worth work: `lib/motion.ts`
exists and the springs are migrated, but 65 duration literals remain across `app/` and `components/`.

### Still outstanding

- **WS0.3 `/taste https://www.duolingo.com`** → `docs/design/duolingo.md`. Needs a browser.
- **§3.4(2)(3)** — `extractFaceThumbnail`'s three score gates and the unguarded `toDataURL`. The plan
  says instrument on Richard's real video before fixing; still the right call.
- **WS9 Option 2 (picture-in-picture)** — deferred on the plan's own reasoning.
- **§13** — rotate `SUPABASE_ACCESS_TOKEN` / `VERCEL_TOKEN`; apply `008_scan_cache_v3.sql`; decide on the
  six unwired landing components.
- **Nothing is merged.** All 15 commits are on `ws0-foundations`, and `design-overhaul` has never
  reached `main`.
- **None of this has been seen on a phone.** The blend mode default, the portrait calibration, the drill
  readout at eight feet, and the audio mix all need judging on the device, in a room, from where Richard
  actually stands.

---

This is a **program document**, not a task list. It decomposes the work into ten workstreams (WS0–WS9).
Each workstream is sized to become its own spec → plan → implementation cycle via
`superpowers:brainstorming` → `superpowers:writing-plans`. Do not try to execute this document
directly — pick a workstream, write its plan, execute that.

---

## 0. Read this before anything else

### 0.1 What is already true (do not re-derive it)

A Duolingo-flavoured redesign **has already shipped** on `design-overhaul` (57 files, +6253/−3607, merged
to `main` 2026-07-30). `docs/HANDOFF-DESIGN.md` §2 lists it. That work delivered:

- Two named grounds — **paper** (`bg-brand-cream`) and **stage** (the practice screen). `docs/DESIGN_SYSTEM.md` §1.
- A real chunk-button primitive. `components/ui/Pressable.tsx` is genuinely good: solid unblurred
  `shadow-chunk-*`, `active:translate-y-[4px] active:shadow-none`, 110ms, transform-only, hover gated
  behind `@media(hover:hover)and(pointer:fine)`, ≥44px at every size. **Do not rewrite it.**
- A token palette with Duolingo's *structure* — `duo-green/blue/gold/red` plus a paired `*Dark` chunk
  shade — in `tailwind.config.ts:36-46`.
- A scanned design ratchet in `loop/properties/design.props.test.ts` with budgets that only fall:
  `transition_all: 0`, `ease_in: 0`, `motion_no_reduce: 0`, `small_touch_target: 0`, `raw_hex: 56`
  (actual 12). The verifier is protected by a `PreToolUse` hook and **may not be edited by an agent.**

**So the honest framing of this program is not "redesign Trace."** The visual language exists. What is
missing is (a) *application of it to the surfaces that were never re-laid-out for a phone*, (b) the
**feel** layer Duolingo actually wins on — sound, haptics, celebration, a character with a point of
view — and (c) five concrete defects that make the app hard to rehearse with. Framing it as a fresh
redesign is how the last three attempts ended up touching only the dashboard: a cold agent re-does the
easy, visible surface and stops.

### 0.2 The constraint that outranks everything

`docs/DESIGN_SYSTEM.md` §6: **Richard is rehearsing for a KCON audition, deadline Aug 7 2026, 11:59 PDT.**
He props a phone across the room and dances to it. Every decision is checked against:
*can he read it, and can he hit it, from where he is actually standing?*

Today is 2026-07-30. That is **eight days**. §10 gives three orderings; Richard picks one.

### 0.3 Framework used throughout

Each workstream is stated as **Persona → Problem → Approach → Measure** ("PAM", per Richard's note).
The *Measure* line is the thing that decides whether the workstream is done — not "it looks better."

### 0.4 Verification, unchanged

```bash
npx tsc --noEmit --incremental false                    # must exit 0
npx vitest run                                          # 79 tests, 7 files
npx vitest run --config loop/vitest.loop.config.ts      # 24 properties incl. the design ratchet
npm run build:check                                     # NEVER `npm run build` while dev is up
```

Two traps that have already cost real time and will again:

- **Tailwind silently emits nothing** for interpolated class names (`` `bg-${x}-100` ``) and for opacity
  suffixes off the scale (`/72`, `/06`). Three such bugs shipped before. Verify new utilities against
  emitted CSS: `grep 'text-hud' .next-check/static/css/*.css`.
- **`env(safe-area-inset-*)` resolves to 0 in a desktop browser.** Notch geometry cannot be checked
  locally. `TOP_STACK` / `BOTTOM_SAFE` in `components/practice/chrome.ts` own those edges — do not add
  a fourth independent guess.

---

## 1. Personas — who this is for

These are the lenses every workstream is checked against. When two conflict, **P1 wins on the practice
screen; P2 wins everywhere else.**

| # | Persona | What they need | What kills them today |
|---|---|---|---|
| **P1** | **Richard, mid-rehearsal.** Phone propped 8–10ft away, portrait, PWA, mid-song, hands busy, out of breath. | Read it from across the room. Hit it without walking over. Never lose his place. | Any control under ~14px, any two-column layout on a portrait phone, any modal that needs a precise tap, any state that requires reading. |
| **P2** | **The new dancer.** Downloaded it, has never used pose overlay software, does not know what "trim" or "calibrate" mean. | To understand *why* each step exists before doing it. To be told they did well. To not be able to make an unrecoverable mistake. | Four setup steps before any dancing. Jargon ("Ghost", "Sync", "BPM", "beat one"). Silence after finishing a run. |
| **P3** | **The returning dancer.** Third session on the same song, wants to drill bars 17–24. | To get from app-open to dancing in under 15 seconds. To loop one section indefinitely. To see whether they improved. | Re-doing calibration every session. Loop points that reset. A dashboard that shows sessions rather than progress on *this* section. |
| **P4** | **The front-end engineer** (you, next session, cold). | A contract that says which primitive to use so you never invent a button. A verifier that fails on regression rather than a reviewer who has to notice. | 1570-line components. Layout decisions distributed across four files. |
| **P5** | **The reduced-motion / low-vision user.** | Motion that informs, not motion that moves. Contrast that survives a bright room. Every control reachable by keyboard. | Any `animate-*` without `motion-reduce:`. Any information carried only by colour. |

---

## 2. Duolingo's actual design DNA — and what to take

Duolingo's marketing site is *not* the interesting artefact; the **learning app** is. What makes it feel
the way it does, ranked by how much it would do for Trace:

| # | Duolingo does | Trace status | Take it? |
|---|---|---|---|
| 1 | **Chunk buttons** — solid 4px bottom edge that collapses on press. | ✅ `Pressable` | Already have it. Extend to the last hand-rolled buttons (§5.3). |
| 2 | **One saturated action colour per screen.** Green means go, and only go. | ⚠️ Partial | Enforce. `TraceTab` has green, blue, violet, emerald and amber pills all at equal weight. |
| 3 | **Sound + haptics on every commit.** Correct/incorrect chimes are load-bearing to the feel. | ❌ **None anywhere** | **Take it. Highest feel-per-line-of-code in this document.** WS4. |
| 4 | **A character with a point of view.** Duo reacts, celebrates, guilts. | ⚠️ Art exists, unused | Take it, restrained. `components/illustrations/` already has 7 characters (`Celebrating`, `Dancing`, `Idle`, `Jumping`, `Running`, `Thinking`, `Waving`) and `AnimatedBanner` is rendered by nothing. WS5. |
| 5 | **The celebration moment.** Lesson-complete: big number, 2–3 stat cards, confetti, sound, one primary CTA. | ⚠️ Half | `SyncTab.tsx:929-1011` already does the big number well. Missing: entrance choreography, count-up, confetti, sound, mascot. WS5. |
| 6 | **Heavy rounded display type.** Feather Bold. Nothing in Duolingo is thin. | ⚠️ DM Sans | DM Sans at `font-extrabold` is close but geometrically cooler. Evaluate **Nunito** — the closest free analogue — behind a one-line `tailwind.config.ts` change. WS1, low-risk, high-vibe. |
| 7 | **Mobile-first chrome: bottom tab bar on phones, left rail on desktop.** Thumb-reachable. | ❌ Top header only | Take it. `app/dashboard/layout.tsx` puts the only navigation in a top bar — the least reachable place on a phone. WS3. |
| 8 | **Progress you can see.** Path, crowns, streak, daily goal. | ⚠️ Streak + 4 stat tiles | **Deliberately limited by Richard's call (2026-07-30): visual + motion + celebration only. No XP, hearts, gems, or leagues.** Trace's reward is the score it already computes. Do not add a game economy. |
| 9 | **Spring-based, playful motion.** Pops, overshoot, squash. | ⚠️ Some | Extend, within the emil-design-eng bands already encoded in the ratchet. WS2. |
| 10 | **Never a dead end.** Every empty/error state has art, a sentence in plain language, and one button. | ✅ `components/states/*` | Already done well. Reuse, don't rebuild. |

**What NOT to copy:** Duolingo's density. Duolingo is read at 14 inches; Trace's practice screen is read
at 10 feet. Duolingo's own type scale would be a bug on the stage. `text-hud` (12px/700) is the floor
there and it exists for a reason (`tailwind.config.ts:110-117`).

**Phase-0 artefact:** run `/taste https://www.duolingo.com` and commit the output to
`docs/design/duolingo.md` + `.json`. It produces concrete px/hex tokens and the trade-off rationale, and
it is the reference every later workstream cites instead of re-arguing from memory. ~20 minutes.

---

## 3. Defects found by static analysis — root causes, with evidence

Every one of these was located in source, not guessed. Line numbers are as of `ef19d33`.

### 3.1 Side-by-side is two squished columns on a portrait phone — **confirmed**

`components/practice/TraceTab.tsx:834`

```tsx
<div className="absolute inset-0 grid grid-cols-2">
```

Unconditional. On a 393×852 phone each pane is **196px wide**; the reference is `object-contain`, so a
16:9 clip letterboxes into a 196×110 strip with ~370px of black above and below it. This is exactly the
"very compressed, squished up together" report.

The fix is a **portrait/landscape switch, not a breakpoint**: `grid-cols-2` when the viewport is wider
than tall, `grid-rows-2` (you on top, reference below — Richard's stated preference) when it is taller
than wide. Breakpoints are the wrong axis here; a phone in landscape *should* get columns.

Also on those two panes: `bg-pink-500` (`:838`) and `bg-blue-500` (`:849`) are raw Tailwind palette, not
tokens. They are the only two places in `components/practice/` where the REFERENCE/YOU identity colours
are invented rather than named, so they cannot be kept in sync with the rings drawn on the video.

### 3.2 SyncTab has no side-by-side at all — **confirmed, and it is a gap not a bug**

`components/practice/SyncTab.tsx:696-741`. Sync composites the reference canvas *over* the recording at
`overlayOpacity/100`. There is no stacked or split comparison mode. Richard asked for "recorded video on
top, reference on the bottom" — that view **does not exist yet**; it needs building, not fixing (WS7).

Separately, `SyncTab.tsx:705`: the user's recording is `object-cover`, which **crops** it to fill.
Combined with `transform: scaleX(-1)` this can silently cut the dancer's hands or feet out of the
comparison. On the review screen, `object-contain` is almost certainly correct — you are judging shapes,
not filling a frame.

And `SyncTab.tsx:779`: the entire feedback detail panel is `hidden … md:block`. **The per-region
breakdown and the "jump to your weakest bar" button — the most actionable controls in the app — do not
exist on a phone.** Same class of bug as the Ghost slider that was `hidden sm:flex` (fixed in `ebec02f`).

### 3.3 Calibration is a landscape box inside a portrait screen — **confirmed**

`CalibrationModal.tsx:798`, `:939`, `:1158` — all three video panes are `aspect-video` (16:9), inside
`STEP_CARD` (`:178`). On a portrait phone that reserves ~40% of the screen for the thing you are
actually looking at, and gives the rest to a header and a footer. Steps 1 (Frame yourself) and 4 (Pick
the dancer) are *visual judgement tasks performed from several feet away* — they want the whole screen.

The fix is a **portrait-native modal**: full-bleed media, header and footer as floating stage-glass
overlays rather than stacked rows, `aspect-video` only where there is horizontal room. This is WS6 and
it is the single largest mobile win in the document.

### 3.4 "Choose your dancer" shows no faces — **root cause narrowed to three candidates**

Reported against a single-dancer video. Three distinct things are in play, and a build session should
instrument before fixing:

1. **With exactly one dancer, the picker never renders.** `CalibrationModal.tsx:641-650` auto-advances
   800ms after a solo detection, and `:1241` gates the thumbnail row on `persons.length > 1`. So the
   correct reading of "it doesn't show anyone's faces" may be *"it flashed a screen titled 'Pick the
   dancer to follow' and then left"* — a copy and state bug, not an image bug. **Check this first; it is
   free.** A one-dancer scan should say "Found your dancer" with the thumbnail, not title itself as a
   picker it is about to skip.
2. **`extractFaceThumbnail` returns `null` on three independent score gates** — `lib/faceExtraction.ts:30-32`
   requires nose ≥ 0.25 and *both* shoulders ≥ 0.2. Any frame where the dancer is turned away, mid-spin,
   or backlit fails all three, and the fallback is the grey stick figure at `CalibrationModal.tsx:1279`
   or the bare `?` tile at `TraceTab.tsx:904`. On a dance video, "turned away" is most frames.
3. **`canvas.toDataURL` at `lib/faceExtraction.ts:82` is outside the try/catch.** `drawImage` is guarded
   (`:76-80`), `toDataURL` is not. A tainted canvas throws `SecurityError` there and takes the whole
   scan loop down. The reference video carries `crossOrigin="anonymous"`, so blob URLs from IndexedDB
   are fine — but a signed Supabase URL that answers without the right CORS header is not.

Instrumentation before the fix: the scan already logs per-frame at `CalibrationModal.tsx:458`. Add
whether a thumbnail was produced and which gate rejected it, run it on Richard's actual video, read the
console. **Do not fix this blind** — the same discipline `HANDOFF-DESIGN.md` §3 applies to safe-area
geometry applies here.

### 3.5 The ghost is hard to see — **confirmed, and the cause is architectural**

`TraceTab.tsx:524` calls `drawProVideo` (`:68-92`), which does one thing: `ctx.drawImage(pro, …)` — the
**entire reference frame, background included** — and the canvas element carries
`style={{ opacity: overlayOpacity / 100 }}` (`:808`).

So at 50% opacity you are not seeing "the reference dancer at half strength." You are seeing *the
reference dancer's whole room* at half strength, alpha-blended over *your* whole room. Two mid-grey
scenes averaged together produce mid-grey. The dancer's body — the only thing that matters — is
competing against their sofa, their wall, and their lighting, all at equal weight.

Raising opacity does not fix it; it just hides your own body instead. Which is why the slider is clamped
`min="10" max="90"` (`:1277`) — neither end is usable.

This gets its own section (§8) because it is the most valuable single fix in the document and it is not
a styling change.

### 3.6 Smaller confirmed items

| Where | What | Why it matters |
|---|---|---|
| `app/dashboard/layout.tsx:44-77` | Navigation is a top header only. No bottom bar. | The two actions on a phone (new session, sign out) are in the least reachable corner. |
| `TraceTab.tsx:1274-1283` | Opacity slider lives in a horizontally-scrolling toolbar row. | The single most-used control on the practice screen may be scrolled off-screen. Richard names it as a key feature. |
| `TraceTab.tsx:1310-1322` | Live count + Adjust is `hidden … sm:flex`, with a separate mobile duplicate at `:1356`. | Two implementations of one control, already drifting. |
| repo-wide | No `Audio`, no `navigator.vibrate`, no `AudioContext` outside beat detection. | Zero sound design, zero haptics. See WS4. |
| `components/AnimatedBanner.tsx` | Imported by nothing. | Artwork with no home. Candidate for the celebration screen (WS5) rather than deletion. |
| `components/landing/` | `Problem`, `Solution`, `StickySteps`, `Testimonial`, `Testimonials`, `LogoCloud` unwired. | Six components carrying the last 4 raw hexes. Decide once (`HANDOFF-DESIGN.md` §5.4). |

---

## 4. The responsive doctrine — the thing every past attempt got wrong

**Rule: on the practice surfaces, branch on orientation, not on width.** A 393px-wide phone held sideways
is a landscape device and wants columns. A 1024px tablet held upright is a portrait device and wants
rows. `sm:`/`md:` cannot express that, and every squished layout in §3 is a `sm:`/`md:` decision applied
to an orientation problem.

Add to `components/practice/chrome.ts` (which already owns `TOP_STACK`/`BOTTOM_SAFE`) a single hook:

```ts
/** True when the viewport is taller than it is wide. The practice screen branches
 *  on this, never on a width breakpoint — a phone in landscape is a landscape
 *  device regardless of how few pixels wide it is. */
export function useIsPortrait(): boolean
```

Backed by `matchMedia("(orientation: portrait)")`, SSR-safe default `true` (phones are the majority and
portrait is the safer wrong guess). **One hook, one source of truth**, exactly as `TOP_STACK` is for the
top edge. Every video-pane layout in `TraceTab`, `SyncTab`, `TestTab` and `CalibrationModal` reads it.

### The two doctrines, stated plainly

**Mobile (portrait phone) — tailored to its strengths:**
- Media is **full-bleed**. Chrome floats *over* it as stage-glass, never stacked above and below it.
- Comparisons stack **vertically**: you on top, reference below.
- Primary controls live in the **bottom third** — thumb-reachable, and out of the way of the body you
  are watching.
- One-handed, and honestly usually **no**-handed: everything critical is also a large gesture (§9).
- Sheets, not modals. Drag-to-dismiss with momentum, per emil-design-eng. `TraceTab.tsx:1184-1202`
  already does this correctly for the transport — copy that pattern, do not invent a second one.

**Desktop / landscape — tailored to *its* strengths:**
- Use the horizontal room: reference and camera **side by side at full height**, plus a persistent
  detail rail (the one currently `hidden md:block` in `SyncTab`, promoted rather than hidden).
- Keyboard is a first-class input. `TraceTab.tsx:685-687` already binds `L`, `[`, `]`, `T`, `B` —
  surface them in the help overlay and add the new ones (§9).
- Hover states are real here, and only here — keep them behind
  `@media(hover:hover)and(pointer:fine)` as `Pressable` already does.
- Larger type is *available*, not mandatory: the stage floor stays 12px because the viewing distance,
  not the screen size, is what set it.

---

## 5. Design foundations to add — WS1 through WS5

### WS1 — Type, colour discipline, and the taste artefact

**P**: P1, P4. **P**: The palette has Duolingo's structure but the app does not enforce "one action colour
per screen," and DM Sans reads cooler than Duolingo's rounded display face.
**A**:
- Run `/taste https://www.duolingo.com` → commit `docs/design/duolingo.md` + `.json`. Every later
  workstream cites it.
- Evaluate Nunito (or Baloo 2) as `font-display`, applied to `h1`/`h2` and stat numbers only — *not*
  body, *not* the stage HUD where DM Sans's tighter forms are more legible at distance. One
  `tailwind.config.ts` change plus `app/layout.tsx` font loading. Reversible in one line.
- **Semantic colour audit.** Write down, in `DESIGN_SYSTEM.md` §2, that a screen has exactly one green.
  Then fix `TraceTab`'s toolbar, where Mirror (blue), Cues (emerald), Counts (violet), Loop (amber) and
  the transport all compete at equal visual weight. Demote to neutral-when-off, coloured-when-on, which
  is what `TogglePill` already does correctly and the hand-rolled `glassToggle` does not.
**M**: `raw_hex` budget falls below 12. One green per screen, verified by reading each screenshot. A
blind test: from 8 feet, which control is "go"?

### WS2 — Motion system

**P**: P1, P5. **P**: Motion exists but is not systematised; new work re-derives durations.
**A**: Add a `lib/motion.ts` exporting the named bands already implied by `DESIGN_SYSTEM.md` §4 and the
emil-design-eng rules the ratchet enforces — `PRESS` (110–160ms), `ENTER` (180–260ms), `CROSS_SCREEN`
(300–500ms), plus two springs: `SPRING_UI` (`stiffness: 420, damping: 42`, already used at
`TraceTab.tsx:1191`) and `SPRING_POP` (`duration: 0.5, bounce: 0.25`) for celebration only.
Then: stagger every list entrance at 40–60ms (`components/ui/Stagger.tsx` exists — use it), give every
sheet the drag-to-dismiss-with-velocity treatment, and make exits faster than entrances.
**M**: `motion_no_reduce` stays 0. No new duration literal appears outside `lib/motion.ts`. Add a ratchet
rule for that (§11).

### WS3 — App chrome: bottom bar on phones, rail on desktop

**P**: P1, P2, P3. **P**: `app/dashboard/layout.tsx` navigation is a top header; on a phone that is the
hardest place to reach and it wastes the safe-area strip.
**A**: A `components/nav/AppNav.tsx` that renders a **bottom tab bar** in portrait (Practice · Progress ·
Profile, ≥56px, `env(safe-area-inset-bottom)`-aware, active tab with a chunk-lifted pill) and a **left
rail** in landscape/desktop. The top header keeps only identity and the logo. `Pressable` and
`IconButton` supply every control; nothing new is hand-rolled.
**M**: Every top-level destination reachable with one thumb from the bottom third of a 393×852 screen.

### WS4 — Sound and haptics — *highest feel-per-line in this document*

**P**: P1, P2. **P**: Trace is silent. Duolingo's feel is 40% audio. P1 is looking away from the phone
half the time — **audio is the only channel that reaches him mid-move**, and it is currently unused.
**A**: A tiny `lib/feedback.ts` with `sfx(name)` and `haptic(pattern)`:

| Cue | When | Why it earns its place |
|---|---|---|
| `tick` (soft) | Each count, when counts are on | You can dance to the app without looking at it. |
| `count-in` | 3-2-1 before a loop restart or a take | Removes the "when do I start?" guess entirely. |
| `commit` | Framing locked, trim set, dancer picked | Confirms a setup step you performed from 8 feet away. |
| `success` / `almost` | Score reveal, banded | The celebration moment. |
| `record-start` / `record-stop` | Test tab | You are not near the phone; you cannot see the red dot. |

Rules: WebAudio with a **user-gesture unlock** (iOS requires it — hook it to the first tap on the
practice route), all assets precached by `public/sw.js` (bump `CACHE_VERSION`), a **global mute that
persists**, and it must **duck against the reference track's own audio** rather than fighting it.
`navigator.vibrate` on Android only — iOS Safari does not support it, so haptics are a bonus, never the
only signal. Respect `prefers-reduced-motion` for the *visual* half but **never mute audio for it** —
that is a different axis and conflating them is a common bug.
**M**: A full trace→test→sync run is completable with the screen never looked at directly except during
setup.

### WS5 — Character and celebration

**P**: P2, P3. **P**: Seven illustrated characters exist in `components/illustrations/` and are barely
used; `AnimatedBanner.tsx` is imported by nothing. A run ends with a number and silence.
**A**:
- **Character presence, restrained.** The mascot appears at exactly four moments: empty dashboard
  (already does — `app/dashboard/page.tsx:241`), the calibration step that is waiting on you, the score
  reveal, and the streak milestone. `Thinking` while scanning, `Celebrating` above 80, `Waving` on
  return after a gap. **It never appears on the practice stage** — nothing decorative belongs over the
  camera feed.
- **The celebration moment.** Rebuild `SyncTab.tsx:929-1011` as a choreographed sequence rather than one
  spring: scrim → number counts up from 0 with `SPRING_POP` → region bars fill left-to-right, staggered
  60ms, worst first → mascot pops in → confetti (canvas, ~1.2s, `motion-reduce:` skips it entirely) →
  buttons fade last. Sound on the number landing. This is the one place in the app where 500ms+ is
  correct, because it is rare and it is the payoff.
- **Streak, honestly.** `app/dashboard/page.tsx:157-165` already draws a gold chunk streak pill. Give it
  a pop on increment and a milestone state at 3/7/30. No XP, no hearts, no gems, no leagues — Richard's
  call, 2026-07-30.
**M**: A new dancer finishing their first run is told, in a sentence, what they did well and what to
drill next — with a face and a sound attached.

---

## 6. Surface workstreams — WS6 through WS8

### WS6 — Calibration, rebuilt portrait-native — *largest mobile win*

**P**: P1, P2. **P**: §3.3. Four steps in a 16:9 box on a portrait screen, each step a card with a header
row and a footer row squeezing the media into the middle.
**A**: One `STEP_CARD` shape that is **full-bleed media in portrait** with header and footer as floating
stage-glass overlays (the `TraceTab` chrome pattern, which is already correct), and the current
card-with-rows shape only in landscape. Then per step:
- **Frame yourself** — full-screen camera. The palm-progress ring (`:824-839`) is already excellent;
  give it the whole screen. Ghost slider stays visible (it was `hidden sm:flex` once — do not regress it).
- **Trim** — full-bleed video, timeline as a floating bar at the bottom third. Keyboard access to the
  handles already exists via `lib/trimControls.ts` (`2a45184`) — **do not touch that logic**, only its
  container.
- **Mode** — two `ChoiceCard`s are already the right answer. Just make them fill the screen.
- **Dancer** — full-bleed, thumbnails as a bottom sheet. Plus the §3.4 fixes.
**Consider also**: can steps 3 and 4 be *inferred*? If the scan finds exactly one dancer, "how many
dancers?" is a question the app already knows the answer to. Removing a step beats redesigning it.
**M**: On a 393×852 screen, the thing you are judging occupies ≥70% of the viewport at every step.
Setup completable start-to-finish from 8 feet away.

### WS7 — The comparison views

**P**: P1, P3. **P**: §3.1 and §3.2 — one squished view that exists, one useful view that does not.
**A**:
- `TraceTab` side-by-side: orientation-driven (`useIsPortrait`), stacked in portrait with **you on top**.
- `SyncTab`: **add** a stacked comparison mode alongside the existing overlay — recording on top,
  reference below, one scrubber driving both. This is the view Richard asked for and it does not exist.
- `SyncTab.tsx:705`: `object-cover` → `object-contain` on the review surface.
- `SyncTab.tsx:779`: the detail panel stops being `hidden md:block`. In portrait it becomes a **bottom
  sheet** — same drag-to-dismiss pattern as the transport. The "jump to your weakest bar" button is the
  single most useful control in the app and phones currently do not have it.
- REFERENCE/YOU identity colours become tokens, shared with the person rings.
**M**: In portrait, both panes are ≥40% of viewport height and the dancer's full body is visible in each.

### WS8 — The dashboard as a practice surface

**P**: P3. **P**: The dashboard lists *sessions*. P3 wants to know "am I getting better at bars 17–24 of
this song, and can I get back there in one tap?"
**A**: `SongCard` (`components/dashboard/SongCard.tsx`) gains a **resume affordance** — one tap back into
the last-practised section with its trim, framing and loop points restored. Progress is shown per song
as a trend, not a list. `ProgressGraph` already exists (`components/dashboard/ProgressGraph.tsx`, 109
lines) — promote it. Keep the four `StatTile`s; they are good.
**Dependency:** resuming loop points requires persisting them. They currently live in `TraceTab` state
(`:201-205`) and die with the tab. Cheapest correct home is the existing IndexedDB video record
(`lib/videoStore.ts`), not a new Supabase table — zero-storage is an architectural commitment
(README, "Remaster Phase 1").
**M**: App-open to dancing the same section again in ≤3 taps and ≤15 seconds.

---

## 7. Deep dive — making the ghost readable (WS9, part A)

This is §3.5's fix and it deserves its own thinking. **Alpha is the wrong tool.** Blending two full video
frames averages two backgrounds together; no opacity value makes an averaged background readable.

Five approaches, cheapest first. They compose — 1+2 alone probably solve it.

**A. Blend mode instead of alpha. ~10 lines. Do this first.**
Set `ctx.globalCompositeOperation` on the overlay canvas. `"screen"` makes the reference's dark pixels
transparent and its light pixels glow — a bright dancer against a dark studio becomes a genuine ghost
with the background dropping away for free. `"difference"` makes *any* mismatch light up, which turns
the overlay into a live error signal: perfect alignment reads as black. `"lighten"` is the safe middle.
This is a `<select>` with three options and it may be the whole fix. **Cost: an afternoon. Do it first
and evaluate on the phone before building anything below.**

**B. Segmentation mask — cut the reference's background out entirely. The architecturally right answer.**
MediaPipe `PoseLandmarker` supports `outputSegmentationMasks: true`, and `lib/mediapipe.ts:52-64` already
constructs the landmarker — it is a flag plus a mask composite (`ctx.globalCompositeOperation =
"destination-in"`). Then the ghost is **only the dancer's silhouette**, and 60% opacity of *a body* is
dramatically more readable than 60% of a body-plus-room. Cost: per-frame mask work on the reference
video. Mitigation: the scan pipeline already walks the reference offline
(`CalibrationModal.tsx:427-513`) — masks can be precomputed there and cached alongside the timeline,
paying zero cost during playback. **This is the real fix. Prototype it behind a flag.**

**C. Contour / rim-light rendering.** Draw the reference as a bold outline plus a coloured rim rather than
a filled image. A 4px `duo-blue` contour with a dark drop-shadow reads at 100% opacity against *any*
background without hiding your own body at all — which is the actual goal. Cheapest version: draw the
33-point skeleton thick and glowing, which requires no new CV work because the pose is already detected.
Most legible version: Sobel edge detection on the masked silhouette from (B).

**D. Adaptive contrast.** Sample mean webcam luminance each second; auto-pick blend mode and opacity.
Removes a slider P1 has to reach for mid-song. Ship *after* B/C prove out, as a "smart" default with
manual override.

**E. Spatial separation instead of blending.** Sometimes the answer is not to blend at all — see WS9
part B. A hold-to-peek gesture makes the reference 100% opaque for as long as you hold, which solves
"sometimes I just need to see the video" without touching the blend at all.

**Also, regardless of approach:** move the opacity control **out of the scrolling toolbar row**
(`TraceTab.tsx:1274-1283`). Richard names the ghost as a key feature, and its control can currently be
scrolled off-screen. Candidates: a persistent vertical slider on the right edge (thumb-reachable, out of
the body's way), or a two-finger vertical drag on the canvas — the canvas already has a pinch handler
(`:726`), so the gesture plumbing exists.

**M**: From 8 feet, in a normally-lit room, both bodies are simultaneously distinguishable without
touching a control.

---

## 8. Deep dive — the practice modes (WS9, part B)

Richard asked for all three specced with trade-offs. Here they are; the build session picks.

### Option 1 — Hold-to-peek + stacked portrait *(recommended)*
Press and hold anywhere on the canvas → reference goes to 100%, webcam fades to ~15%, over 140ms.
Release → springs back. Solves "sometimes seeing the video in full form makes it a lot easier" with a
gesture that costs nothing to learn and needs no screen real estate.
*Pros:* smallest build, no layout change, works one-handed and no-handed (long-press is a big target),
composes with everything else. *Cons:* requires a hand on the phone — the one thing P1 does not have
mid-song. **Mitigate: bind it to a key on desktop and to a double-tap-and-hold, and add a latched
"Reference only" mode in the view segmented control for hands-free use.**
*Note:* `TraceTab.tsx` already has `onPointerDown`, pinch and wheel handlers on that canvas — the new
gesture must not fight the existing drag-to-reposition. Long-press threshold ~350ms with a movement
cancel is the standard resolution.

### Option 2 — Picture-in-picture reference
Reference plays in a small draggable, resizable window over the camera.
*Pros:* both feeds always visible; the user chooses the trade-off; familiar. *Cons:* a small window is a
small dancer — at 8 feet a PiP pane is probably unreadable, which is the exact failure mode of the
current side-by-side. **Recommend deferring; it is a desktop feature wearing mobile clothes.**

### Option 3 — Drill mode
Pick a section → it loops with an audible count-in → alternating "watch" and "dance" reps
(watch the reference at full opacity for 8 counts, then dance it with the ghost for 8 counts, repeat).
Rep counter, no interaction between reps.
*Pros:* **this is the feature Richard actually described** ("a testing ground for always repeating a
certain part"). It is how dancers actually learn, it is hands-free by construction, and it is the most
Duolingo-shaped thing in this document — a bounded, repeatable, countable practice unit, which is
exactly what a Duolingo lesson is. It also gives WS4's audio somewhere to be load-bearing.
*Cons:* the largest build of the three. Needs the A/B loop persisted (WS8's dependency), a rep state
machine, and count-in audio.
*Foundation already present:* A/B loop points, loop enforcement (`TraceTab.tsx:574-581`), `[`/`]`/`L`
keybinds, and `CountGrid`. **The primitives exist; the mode does not.**

**Recommended sequencing if all three are wanted:** Option 1 first (an afternoon, immediate relief),
Option 3 second (the real feature), Option 2 only if desktop use turns out to matter.

---

## 9. How to run this — agents, models, parallelism

`HANDOFF-DESIGN.md` §1's guidance still holds and is worth repeating, because it was learned expensively:

- **Opus for design judgement and device debugging** (WS5, WS6, WS7, WS9, and all of §3.4/§3.5).
  **Sonnet for mechanical, fully-specified edits** (token renames, `hidden md:block` removals, applying
  `useIsPortrait` to a fourth call site).
- `.claude/settings.json` pins Sonnet 5 for this project on restart. `/model opus` before judgement work.

**On subagents:** `HANDOFF-DESIGN.md` §1 says subagents earned their keep exactly once — when five large
surfaces were rebuilt in parallel against one written contract. That condition recurs here, and only
here:

- ✅ **Parallelise WS6 / WS7 / WS3** after WS0 lands. They touch disjoint files
  (`CalibrationModal.tsx` / `SyncTab.tsx`+`TraceTab.tsx` / `app/dashboard/layout.tsx`) and share one
  contract. Use `superpowers:dispatching-parallel-agents`.
- ❌ **Never subagent WS1, WS2, or a §3 bug fix.** A cold agent re-reads the entire design system to make
  a three-line change, and a bug fix needs the conversation context that narrowed it.
- ⚠️ **WS9 is interactive by nature** — the ghost fix must be evaluated by a human on a phone, in a room,
  from 8 feet. No agent can judge it.

**The prerequisite that makes parallelism safe — WS0, do this first, half a day:**

1. `useIsPortrait` in `components/practice/chrome.ts` (§4).
2. `lib/motion.ts` with the named bands (WS2).
3. `docs/design/duolingo.md` from `/taste` (§2).
4. `DESIGN_SYSTEM.md` gains a **§7 Responsive contract** stating the orientation rule, the two doctrines,
   and "media is full-bleed in portrait" as a binding rule rather than a preference.

Without WS0, three parallel agents invent three different portrait strategies. That is precisely how
the tab bar, the controls and the count strip ended up stacked under the Dynamic Island.

---

## 10. Three orderings — Richard picks

The plan is written whole, as asked. These are the sequencings, with the honest trade-off of each.

**Ordering A — "Rehearse first" (lowest risk to Aug 7).**
Days 1–3: WS0, §3.1 (squished side-by-side), §3.3 (portrait calibration), §7 blend-mode experiment,
§3.2's `hidden md:block` removal. All small, all on `main`, all directly reduce friction in the thing
Richard is doing every day. Days 4–8: **freeze.** Rehearse. Post-Aug 7: WS1–WS9 in full.
*Cost:* the Duolingo feel work waits ten days. *Benefit:* nothing destabilises the rehearsal tool.
**This is what I would choose.**

**Ordering B — "Feel first."**
WS0, WS4 (sound/haptics), WS5 (celebration) first — they are additive, touch few existing files, and are
the largest perceived change per unit of risk. Then the surface workstreams.
*Cost:* the squished layouts persist through the audition prep. *Benefit:* the app feels transformed within
about three days.

**Ordering C — "Fix the ghost first."**
WS0, then §7 in full (blend mode → segmentation mask → contour), then everything else.
*Cost:* it is the deepest single piece of work and the least certain to land quickly.
*Benefit:* it is the highest-value fix in the document for the core feature of the product, and every
hour rehearsing with a readable ghost compounds.

---

## 11. New verifier rules to propose

The ratchet is what stops the next redesign from being partial. It may not be edited by an agent — these
are **proposals for Richard to add via `loop/verify.sh`**, each a countable regex over `app/` + `components/`:

| Rule | Regex intent | Starting budget | Why |
|---|---|---|---|
| `raw_tailwind_palette` | `bg-(pink\|blue\|red\|green\|amber\|violet\|emerald)-[0-9]{3}` | current count (≥2: `TraceTab.tsx:838,849`) | Palette classes bypass the token system exactly the way raw hex does, and are invisible to the `raw_hex` rule. |
| `orientation_bypass` | `grid-cols-2` / `flex-row` inside `components/practice/` not preceded by an orientation branch | current count | The §3.1 class of bug, made un-reintroducible. |
| `hidden_on_mobile` | `hidden [a-z]+:(block\|flex\|grid)` in `components/practice/` | current count | Third time this exact bug has shipped (Ghost slider, detail panel, live count). |
| `magic_duration` | `duration-\[[0-9]+ms\]` or `duration: 0\.[0-9]+` outside `lib/motion.ts` | current count | Keeps WS2's bands from eroding. |
| `stage_type_floor` | `text-\[([0-9]\|10\|11)px\]` in `components/practice/` | 0 | The 12px floor, enforced rather than remembered. |

Pin each at the current count, then let it ratchet.

---

## 12. Risks and rollback

| Risk | Mitigation |
|---|---|
| A redesign lands badly on the phone with days to the audition. | Every workstream is its own branch and its own revert. `git revert -m 1 <merge-sha>` + push = ~2 min redeploy. |
| Preview URLs are useless for testing. | Known and unchanged: a Vercel preview is a **different origin**, videos live in origin-scoped IndexedDB, and a second PWA install is needed for the 7-day eviction exemption. Merge to `main` is the established call (`HANDOFF.md` §2). Accept it; keep changes revertible. |
| Segmentation masks tank frame rate on an iPhone. | Precompute during the existing offline scan and cache. Ship behind a flag defaulting off. Blend mode (§7A) is the cheap fallback and may suffice alone. |
| Audio breaks on iOS. | WebAudio requires a user-gesture unlock; hook it to the first tap on the practice route and fail silent. Audio is never the only signal. |
| Parallel agents invent divergent portrait strategies. | WS0 lands first and `DESIGN_SYSTEM.md` §7 is binding. This has already happened once with `TOP_STACK`. |
| Scope sprawl into a game economy. | Ruled out on 2026-07-30: visual + motion + celebration only. If XP appears in a plan, that plan is wrong. |

---

## 13. Open items inherited, not resolved here

- **`HANDOFF-DESIGN.md` §3 device pass is still BLOCKING and still unperformed.** Predicted collision:
  `CountStrip` (`left-0 right-0`, `max-w-sm`) vs `TraceTab`'s TRACE badge (`left-3`) and control cluster
  (`right-3`), all at `top: TOP_STACK`, all `z-30`. Repro: overlay mode, counts on, **paused**. Two
  minutes to confirm. Confirm before WS6/WS7 touch that geometry.
- **Migration `008_scan_cache_v3.sql` unapplied.** Contains a destructive delete; deliberately left for a
  human. Not urgent — old rows read as cache misses.
- **`.env.local` still contains `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN`** that were pasted into a chat.
  **Rotate them.** Two minutes, and it is the highest-value item in any of these documents.
- **Six unwired landing components** — delete-or-keep still undecided (`HANDOFF-DESIGN.md` §5.4). They
  hold the last 4 raw hexes.
