# Trace — design overhaul handoff (2026-07-30)

Self-contained. Paste the pointer line into a fresh chat and it needs no other context:

> Read `docs/HANDOFF-DESIGN.md` and `docs/DESIGN_SYSTEM.md` in this repo, then continue.

Companion docs: **`docs/DESIGN_SYSTEM.md`** (the binding contract — read it before touching any
UI) and **`docs/HANDOFF.md`** (the pre-existing product/architecture handoff, still accurate
except where noted in §6 below).

---

## 1. Which model to use

**Use Sonnet for §4 (mechanical follow-ups). Use Opus for §3 and §5 (device debugging and
design judgement).**

| Task | Model | Why |
|---|---|---|
| §3 device pass — diagnosing what's wrong on a real iPhone | **Opus** | Root-causing safe-area, PWA-cache and cue-timing behaviour from indirect symptoms. This is the work where the last session's wrong guesses cost the most time. |
| §4.1–4.4 mechanical cleanups | **Sonnet** | Each is a bounded, fully-specified edit with a named file and a named fix. No judgement required. |
| §5.1 keyboard access for trim handles | **Opus** | Inventing an interaction, not restyling one. |
| §5.2–5.4 remaining design calls | **Opus** | Each needs a taste judgement about hierarchy, and one is a delete-or-keep call. |
| §6 Supabase/Vercel scaling items | **Sonnet** | Well-specified DB changes from the original handoff. |

Note: `.claude/settings.json` pins **Sonnet 5** for this project on restart. Override with
`/model opus` when doing §3 or §5.

**Do not spawn subagents for §4 or §5** — they are small, and a cold subagent re-reads the whole
design system to make a three-line edit. §3 is interactive with the user by nature. Subagents
earned their keep in the last session only because five large surfaces were being rebuilt in
parallel against one contract.

---

## 2. What was done — branch `design-overhaul`, 57 files, +6253/−3607

**Pushed to `origin/design-overhaul` and merged to `main` on 2026-07-30** so it could be
seen on hardware at all — see §3 for why a preview URL was not an option. Still nothing
has been seen on a phone; merging is what makes looking possible, not evidence that it works.

| Commit | What |
|---|---|
| `c5a2a88` | Stage ground, shared primitives, and the design contract |
| `1b09843` | Practice screen onto the stage; login and dashboard chrome rebuilt |
| `7e3fb75` | Tempo controls, dashboard, landing, Test/Sync phases |
| `ebec02f` | Calibration finished, cross-surface seams closed, silent Tailwind bugs fixed |
| `cf7fedf` | §4.1–4.4 + §5.2–5.3: auth states consolidated, state heading rank, dead `VideoCard` gone |
| `2a45184` | §5.1: keyboard access for the trim handles, semantics extracted to `lib/trimControls.ts` |

**To undo the whole thing** if it is wrong on the phone — one command, ~2 minutes to redeploy:

```bash
git checkout main && git revert -m 1 <merge-sha> && git push origin main
```

### The organising idea

The app has **two grounds**, and nearly every inconsistency came from applying one's rules to the
other:

- **Paper** (`bg-brand-cream`) — auth, dashboard, landing, upload. Read at arm's length on a
  static ground. Depth is a **solid unblurred edge** (`shadow-card`, `shadow-chunk-*`).
- **Stage** — the practice screen: a live camera feed at full bleed, watched from **ten feet away
  while dancing**. Depth is **blur plus translucent fill** (`shadow-stage`). Type floor is 12px
  (`text-hud`).

The practice chrome had been paper rules applied to a stage surface: white glass over live video,
with an 8px type floor. That was the single biggest change.

### Colour

**Deliberately not rehued.** The cream/ink/duo palette is distinctive and was already ratified by
a passing design ratchet; changing hues would have burned the budget for marginal gain. What was
added is what was genuinely missing: a `stage.*` scale, `chunk-ink`/`chunk-stage`/`stage` shadows,
and `text-hud`/`text-hud-lg` as a named legibility floor.

### Primitives (`components/ui/`) — use these, never re-roll them

`Pressable` (variants `primary`/`secondary`/`ink`/`quiet`/`danger`/`stage`, sizes `sm`/`md`/`lg`
all ≥44px, plus `block`, `loading`, `href`, `type`), `IconButton` (required `aria-label`),
`Field`, `Panel`, `Segmented`, `TogglePill`, `StatTile`, and the existing `CountUp`/`FadeIn`/
`Stagger`/`Marquee`.

### Three real bugs found, not just styling

1. **`SyncTab`'s full-screen modal scrim never rendered.** `bg-black/72` — 72 is not on Tailwind's
   opacity scale, so no rule was emitted and the results sheet floated over an unscrimmed video.
   Verified against emitted CSS, not assumed. Two more of the same cause (`TraceTab` count button,
   `SongCard` delta chip).
2. **The dashboard drew a second greeting card and section header** beneath the real ones during
   every load — the skeleton rendered below already-visible content.
3. **The Ghost opacity slider was `hidden sm:flex`** — hidden on phones, the only device where
   that calibration step is ever performed.

---

## 3. BLOCKING — device pass on a real iPhone

**Everything below is unverified on hardware.** `env(safe-area-inset-top)` resolves to 0 in a
desktop browser and no stylesheet can override it, so notch geometry cannot be checked by looking
at it locally.

**This is now live on production** (`main` → `https://trace-app-rho.vercel.app`). Merging rather
than deploying a preview was deliberate, for the reason in `docs/HANDOFF.md` §2: **a preview is a
different origin**, videos live in origin-scoped IndexedDB, and testing there would mean
re-uploading the video and installing a second PWA to earn the 7-day eviction exemption. Merging
keeps the existing origin, stored video and installed PWA — the same call Richard made on
2026-07-29. The revert command is in §2.

Check, in this order:

1. **Safe-area geometry.** `TOP_STACK` owns the top offset for every absolutely-positioned element
   on the practice screen. `CountStrip` grew from 40px to 56px cells this session and has **not**
   been re-measured against the Dynamic Island. Confirm `01 TRACE`, `02 TEST` and `03 SYNC` all
   clear the status bar.
2. **Is the transport readable and hittable from where you actually stand?** That was the whole
   premise. Specifically the rebuilt timeline: the playhead used to be `opacity-0
   group-hover:opacity-100`, and there is no hover on a phone, so it never appeared at all on the
   target device. It is now always visible with a 44px pointer area and 28px A/B handles.
3. **The `SyncTab` scrim now actually renders.** It never has before.
4. **Cue behaviour** (turn the Beta toggle *on* first): never more than one cue on screen;
   scrubbing to the same moment always shows the identical cue; changing BPM after a scan re-lands
   cues without a rescan.
5. **Which `beat_detection` failure reason fires on your phone.** `BpmInput` now surfaces the typed
   reason instead of showing "No tempo found" for six different causes. Leading suspect is
   `decode-failed` — Safari is far stricter than Chrome about extracting AAC from MP4. If it is
   that, it may be unfixable from here, and tap-tempo is four taps.

**If the phone looks stale, delete the PWA from the Home Screen and re-add it.** The service worker
outlives everything.

---

## 4. Mechanical follow-ups — Sonnet, no judgement needed

**4.1–4.4 are DONE** (uncommitted in the working tree as of 2026-07-30). All four verification
commands in §7 were green afterwards. What was done:

1. ~~**Extract the auth page-level error box.**~~ Now `components/states/FormError.tsx`, used by
   `login`, `signup` and `forgot-password`. `signup`'s `PageError` is deleted. The component reads
   `useReducedMotion()` itself rather than taking a `reduce` prop — login's copy had omitted the
   check, which is the failure mode a prop invites.
2. ~~**Two hand-rolled Suspense spinners.**~~ Both now `LoadingState`.
3. ~~**`app/dashboard/layout.tsx`'s auth-check loading state.**~~ Now `LoadingState` with the same
   "Checking your session…" copy as `app/practice/page.tsx:244` — it is the same moment.
4. ~~**Two stragglers from the tracking sweep.**~~ `StepHeader` and both "or" dividers are now
   `tracking-[0.18em]`. Verified in emitted CSS (`letter-spacing:.18em`). Note the remaining
   `tracking-widest` hits in `components/practice/` and `components/landing/` are **stage** and
   **landing** surfaces, deliberately out of scope for the paper standard.
5. **Migration `008_scan_cache_v3.sql` is still UNAPPLIED** (from the original handoff). It
   contains a destructive `delete from scan_cache where scan_version < 3`, deliberately left for a
   human. Not urgent — old rows read as cache misses.

---

## 5. Design calls left open — Opus

1. ~~**Trim handles in `CalibrationModal` have no keyboard access.**~~ **DONE** (`2a45184`).
   Two `role="slider"` thumbs inside the existing `role="group"` — the WAI-ARIA dual-thumb
   pattern. Arrows nudge 0.1s, Shift/Page jump 1s, Home/End run to each handle's *live* limit
   so the 0.5s minimum stays an invariant rather than a wall. Semantics live in
   `lib/trimControls.ts` (pure, 16 tests); the component only wires them up.
   Pointer behaviour is unchanged — the handles keep `pointer-events-none` so the whole 44px
   bar remains the pointer target.
2. ~~**`StateBlock`'s title is `text-xl` on an `<h3>` under a `text-lg` `<h2>`.**~~ **DONE** —
   dropped to `text-lg`, so the block is subordinate by position rather than by size. Fixed
   centrally in `StateBlock`, which covers all ten call sites at once.
3. ~~**`components/dashboard/VideoCard.tsx` is imported by nothing.**~~ **DELETED** by Richard's
   call, 2026-07-30. Verified no importers first. Recoverable from git.
4. **Six landing components are unwired** and were correctly skipped: `Problem`, `Solution`,
   `StickySteps`, `Testimonial`, `Testimonials`, `LogoCloud`. `app/page.tsx` renders only `Navbar`,
   `Hero`, `MeetTrace`, `HowItWorks`, `Features`, `Waitlist`, `Footer`, `FloatingCTA`. The original
   handoff notes Richard chose to leave unreachable code in place — confirm that still holds before
   deleting or wiring any of them.

---

## 6. Corrections to `docs/HANDOFF.md`

- §6 item 4 says the Duolingo-style redesign was **"deliberately not started"**. That is now stale
  — it is done across every page, on the branch described here.
- §8's tooling list is still accurate.
- Everything in §4 (root causes), §5 (cue architecture) and §7 (gotchas) remains correct and
  should **not** be re-derived.

---

## 7. Non-negotiables — these are scanned and enforced

`loop/properties/design.props.test.ts` counts these across `app/` and `components/`. Every budget
is a ceiling that **only ratchets down**, so a regression fails the build. There is no way to make
a cycle green by arguing.

| Rule | Current | Budget |
|---|---|---|
| `transition_all` | 0 | 0 |
| `ease_in` | 0 | 0 |
| `motion_no_reduce` | 0 | 0 |
| `small_touch_target` | 0 | 0 |
| `raw_hex` | **18** | 56 |

`raw_hex` fell 56 → 18 this session. **The budget file has not been re-pinned to 18** — do that
only via `loop/verify.sh`, which owns it. The loop directory is protected by a `PreToolUse` hook
(`.claude/hooks/protect-verifier.sh`); the verifier may not be edited by an agent.

Also enforced by reality rather than by a test:

- **Tailwind silently emits nothing** for interpolated class names (`` `bg-${x}-100` ``) and for
  opacity suffixes not on the scale (`/12`, `/72`, `/06`). Three such bugs were shipping before
  this session. Valid steps are `0,5,10,15,…,100`. **Verify new utilities against emitted CSS**:
  `grep 'text-hud' .next-check/static/css/*.css`.
- **Never run `npm run build` while the dev server is up** — it overwrites the same `.next` the dev
  server serves. Use `npm run build:check` (writes to `.next-check`).

### Verification commands

```bash
npx tsc --noEmit --incremental false                    # must exit 0
npx vitest run                                          # 79 tests, 7 files
npx vitest run --config loop/vitest.loop.config.ts      # 24 properties incl. the design ratchet
npm run build:check                                     # safe build while dev server runs
```

All four were green at `ebec02f`.

---

## 8. Highest-value item that takes two minutes

**Revoke the Supabase and Vercel tokens in `.env.local`** (`SUPABASE_ACCESS_TOKEN`,
`VERCEL_TOKEN`). They were pasted into a chat previously and were still present as of 2026-07-30.
Rotate at the Supabase and Vercel dashboards — Claude cannot do this for you.

**Deadline: KCON audition submissions close Aug 7, 2026, 11:59 PDT.**
