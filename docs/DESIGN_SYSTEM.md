# Trace design system — the contract

Every surface in the app is built from what is below. If you find yourself
writing a colour, a shadow, a button or an input by hand, the answer is almost
always that a token or a primitive already exists for it.

---

## 1. Two grounds

The app has **two** surfaces, and almost every past inconsistency came from
applying one's rules to the other.

### Paper — `bg-brand-cream`

Auth, dashboard, upload. Read at arm's length, on a static ground.

- Ground: `bg-brand-cream` (#F8F4E0). Cards: `bg-white`.
- Text: `text-ink` primary, `text-clay` secondary, `text-clay/60` tertiary.
- Borders: `border-duo-edge`.
- **Depth is a solid, unblurred edge** — `shadow-card` on cards, `shadow-chunk-*`
  on pressables. The ground is static, so a hard edge reads as a physical layer.
  Blurred shadows read as soft, and soft is the opposite of the affordance.

### Stage — the practice screen

A live camera feed at full bleed, looked at from **ten feet away while dancing**.

- Ground: the video. Panels: `bg-stage-glass backdrop-blur-xl border border-white/10`.
- Text: `text-stage-text`, muted `text-stage-text/70`.
- **Depth is a blur plus a translucent fill** (`shadow-stage`). There is no
  static ground to cast a hard edge onto.
- **Chrome on the stage is dark, never white.** White glass over a camera feed
  in a bright room becomes the brightest thing on screen, so the eye lands on
  the controls instead of the dancer. Dark glass keeps the video brightest and
  holds its own contrast against whatever is behind it.
- **12px is the type floor.** Use `text-hud` (12px/700) and `text-hud-lg`
  (14px/700). Anything smaller than `text-hud` on the stage is a bug — the old
  chrome ran down to `text-[8px]`, which is unreadable at dancing distance.
- Text with no panel behind it gets `.hud-text` (a shadow, not a plate — a plate
  would occlude the dancer).

---

## 2. Colour

Tokens only. **Never write a hex literal in `app/` or `components/`** — there is
a scanned budget of 56 for the whole repo and it only ratchets down.

| Token | Use |
|---|---|
| `ink` / `clay` | Paper text, primary and secondary |
| `brand-cream` | Paper ground |
| `duo-edge` | Borders on paper |
| `stage`, `stage-raised`, `stage-glass`, `stage-inset`, `stage-edge`, `stage-text`, `stage-muted` | Everything on the practice screen |
| `duo-green` | Go / commit / success. The one "start" colour |
| `duo-blue` | View, framing, focus rings, informational |
| `duo-gold` | Streaks, achievement, loop regions |
| `duo-red` | Destructive, errors, recording |
| `cue-*` | Per-joint cue colours. Do not reuse them for UI |

**Accents mean the same thing everywhere:** blue = view/framing, emerald =
the cue system, violet (`cue-hip`) = counts and tempo, amber/gold = looping.

---

## 3. Primitives — use these, do not re-roll them

All in `components/ui/`.

| Component | For |
|---|---|
| `Pressable` | **Every** button with a text label. Variants `primary` (green, "start"), `secondary` (blue), `ink` (neutral commit — form submits), `quiet` (white), `danger` (red), `stage` (dark ground). Sizes `sm`/`md`/`lg`, all ≥44px. `block` stretches. `href` renders a `Link`. |
| `IconButton` | Every icon-only control. `tone` `paper`/`stage`/`stage-solid`. Always ≥44px hit area. **`aria-label` is required.** |
| `Field` | Every text input. Label binding and error announcement are built in. |
| `Panel` | Every card or floating surface. `tone` `paper`/`stage`/`stage-solid`. |
| `Segmented` | Pick one of a short fixed set (view mode, speed). Sliding pill, not a cut. |
| `TogglePill` | Labelled on/off (Mirror, Cues, Counts, Loop). **On = filled**, off = unfilled — a fill/no-fill difference survives any viewing distance; the old 100-tint-behind-700-text did not. |
| `StatTile` | A single glanceable number with a subordinate label. |
| `CountUp`, `FadeIn`, `Stagger` | Existing motion helpers. |

Sliders: `<input type="range" className="slider">`, plus `slider-stage` on the
practice screen. Never leave a range input unstyled — the default 2px track is
invisible at distance.

---

## 4. Non-negotiables (these are scanned and enforced)

`loop/properties/design.props.test.ts` counts these across `app/` and
`components/`. Every budget is a ceiling that only ratchets down, so a
regression fails the build.

1. **No `transition-all`.** Budget 0. Use `transition-ui`, or name the
   properties (`transition-[transform,opacity]`). `all` animates
   width/height/padding/margin, forcing layout and paint every frame.
2. **No bare `ease-in`.** Budget 0. `ease-in-out` and `ease-out-strong` are fine.
   A lone `ease-in` delays the frame the user is watching.
3. **Every `animate-*` line carries `motion-reduce:`** on the same line.
   Budget 0. Prefer `motion-reduce:animate-pulse` over `animate-none` for
   spinners — a loading indicator that stops indicating is worse than one that
   pulses. Rotation is a vestibular trigger; opacity is not.
4. **No touch target under 44px.** Budget 0. Either size it ≥ `h-11`, or add the
   `.touch-target` class, which expands the hit area with a centred
   pseudo-element while leaving the visual size alone.
5. **No raw hex** in `app/` or `components/`. Budget 56 and falling.

Also required, though not scanned:

- **Motion durations**: 110–160ms for press feedback, 180–260ms for entrances
  and layout, 300–500ms only for something crossing the whole screen. Springs
  for anything the finger is dragging.
- **Animate transform and opacity only.** Never width, height, top or left.
- Framer entrance animations must not be the only thing making content visible —
  a mid-flight failure leaves a blank screen (this has already shipped once).
- **Tailwind silently emits nothing** for interpolated class names
  (`` `bg-${x}-100` ``) and invalid opacity suffixes (`/06`). Write states out
  in full.

---

## 5. Practice-screen layout

- **`TOP_STACK` from `components/practice/chrome.ts` owns the top offset.**
  Anything anchored to the top of the practice screen starts below it. Do not
  add a fourth hardcoded guess — three independent guesses are what put the tab
  bar, the controls and the count strip on top of each other under the Dynamic
  Island.
- `BOTTOM_SAFE` likewise for the bottom edge.
- `env(safe-area-inset-*)` always resolves to 0 in a desktop browser, so notch
  geometry cannot be checked by looking at it locally.

---

## 6. What this is for

Richard is rehearsing for a **KCON audition, deadline Aug 7 2026**. He props a
phone across the room and dances. Every decision should be checked against that:
*can he read it, and can he hit it, from where he is actually standing?*

The scan/cue system is **additive and Beta** — it must never gate practice.
