# Trace — session handoff (2026-07-29)

## THE CURRENT WORK — cue feedback redesign, branch `feedback-redesign`

All nine code tasks are implemented and committed. **Nothing has been seen on a phone.**

- Spec: `docs/superpowers/specs/2026-07-29-cue-feedback-redesign-design.md`
- Plan: `docs/superpowers/plans/2026-07-29-cue-feedback-redesign.md`

### What the audit found (don't re-derive)

**One root cause explained three of the five reported problems: BPM was `null` on the phone.**
Both count displays were gated on `bpm !== null`, and `quantize()` fell back to a 0.1s grid
with no musical meaning. `detectBeatsFromVideo` fetches and decodes the entire video, which
fails on iOS for large files.

The other two:
- `MAX_PER_BUCKET = 3` capped cues **per time bucket, not per screen**. With a 1.3s cue
  lifetime and 0.1s buckets that allowed up to 39 concurrent cues.
- `CueRuntime.cuesAt(t)` was already pure and seek-safe. What made feedback feel *live* was
  (a) `beatPhase` falling back to a **wall-clock** `sin(performance.now())` oscillator,
  (b) hit/miss badges being **live webcam judgments**, sticky per cue id and cleared only on
  backward seeks, and (c) the timeline being composed once at scan time and never rebuilt.

Also found: `anchorX/anchorY` was a *cooldown-reset artifact*, not the movement start, so
arrow length never represented how far a limb travels.

### What changed

Scan output is now tempo-free (`MovementEvent[]`); composition into beat-locked cues is a
separate pure function. Cue windows are exactly one beat wide (`LEAD_BEATS 0.75 + HOLD_BEATS
0.25`) so they abut and **one-cue-on-screen is structural, not a limiter**. Rolls are detected
by circuity (path length ÷ net displacement). Feedback now requires a count grid; without one
the Feedback button opens tap-tempo. `judgeCue` left the practice loop entirely.

### Still to do — REQUIRES RICHARD

1. **Migration `008_scan_cache_v3.sql` has NOT been applied.** It contains
   `delete from scan_cache where scan_version < 3` — a destructive statement against
   production (`rnmnusnhkomiypjzmcbw`), so it was deliberately left for a human to run.
2. **The 10-point device walkthrough in Task 10 of the plan has not been done.** The critical
   checks: never more than one cue on screen; scrubbing to the same moment always shows the
   identical cue; changing BPM after a scan re-lands cues without a rescan.
3. `SCORE_FLOOR = 0.08` and the roll thresholds need tuning against the real TXT clip.

Local verification only: `tsc` clean, 64 tests across 6 files, `build:check` green, app boots
with no console errors.

---

# Previous handoff (2026-07-28)

## Project context

- **Trace**: Next.js 14 + Supabase dance-practice PWA. On-device MediaPipe pose detection compares the user (webcam) to a reference dancer.
- **Live**: `https://trace-app-rho.vercel.app` — `main` auto-deploys via Vercel.
- **Supabase project**: `rnmnusnhkomiypjzmcbw` (the *old* "Trace" one; `gncvjzcgnukwmruloutu` / "Trace-Fresh" is abandoned).
- **Deadline**: KCON audition submissions close **Aug 7, 2026, 11:59 PDT**. Richard needs a tool he can actually rehearse with.
- **Goals**: usable practice tool first; consumer-PM portfolio piece second; infra stays **$0/month** (free tiers, all AI on-device).
- **Core feature** (confirmed in code): `TraceTab` renders the webcam full-screen with a canvas above it at `overlayOpacity/100` drawing the reference dancer — draggable and pinch-zoomable to align with your body. The scan is *additive* (cues on top) and must never gate it.

---

## THE CURRENT WORK — feedback from a real phone session

This is the active task. A screenshot from an iPhone practising a TXT / KCON routine surfaced six issues:

1. **Not fullscreen.** Safari's top bar and bottom URL bar eat the screen. Wants them gone, or a way to hide them during practice.
   - The manifest is already `"display": "standalone"` with `start_url: /dashboard`, so **installing to the Home Screen removes all Safari chrome**. `components/InstallPrompt.tsx` exists but is dismissible and stores `trace_install_prompt_dismissed` in localStorage — likely already dismissed.
   - iOS Safari does **not** support the Fullscreen API on iPhone (only iPad); `webkitEnterFullscreen` works on `<video>` elements only. So installing the PWA is the only real path. Consider a practice-specific nudge when `display-mode: browser` is detected.

2. **Cues are massively overwhelming.** The screenshot shows ~10 simultaneous markers — multiple blue arrows, orange arcs, red X circles, a purple diamond, a green ring. Needs a hard cap on concurrent cues and probably fewer distinct visual types.

3. **Cues must lock to the 8-count.** Timing should sit on musical counts 1–8, not arbitrary times.

4. **Feedback must be fully precomputed and scrubbable.** Richard's words: *"when I skip around, it shows the last previous feedback… it should be static, like a video — once it scans, it syncs directly to where it's at."* Today it feels dynamic/adaptive. Suspect `CueRuntime` holds a forward-only cursor with no re-seek on scrub / skip ±5s / A-B loop / playbackRate change.

5. **Counts are invisible.** There's a `showCounts` / `countsEnabled` prop on `FeedbackCanvas`, but on a phone no 1–8 count is visible, so the user can't tell which move belongs to which count.

6. **Sustained / rotational movement isn't representable.** A chest roll or body wave isn't a point-A-to-point-B joint translation, but the detector fires purely on displacement from an anchor. Needs a distinct representation.

**Purpose of the feedback, restated by Richard:** tell the user *when* to move *which* body part (shoulder, head, hand) — and indicate the nature of the movement, including rolls/waves.

### Investigation status
An audit of the cue pipeline (`videoPreScan` → `movementEventDetector` → `choreoTimeline` → `cueRuntime` → `FeedbackCanvas` → `overlayRenderer`) was launched but **failed on a session limit before reporting**. Redo it. Key questions:
- Does `CueRuntime` have a forward-only cursor, and does anything reset it on seek?
- What exactly does `buildChoreoTimeline`'s "density cap" cap, and what's the worst-case simultaneous cue count given each cue's on-screen lifetime?
- Does beat quantisation snap to `CountGrid`, and what happens when `grid` is null (no BPM)? Does `DEFAULT_LEAD_MS` get applied before or after quantisation (i.e. can the ~600ms lead knock a cue off its beat)?
- Where is the 1–8 count actually drawn, and why would it not render on mobile?

---

## Shipped today (8 commits, all live)

| Commit | What |
|---|---|
| `e4f200e` | Mid-scan dancer reacquire picker, abort-safe |
| `dc50700` | Scan halved: 720 → 360 frames on a 3-min song; cue timing moved off a fake clock onto real video time. Wake lock + `storage.persist()` |
| `c84f661` | Scan progress no longer a full-screen modal covering the overlay — now a corner pill |
| `c649dae` | 28 Tailwind classes that emitted **zero CSS** (invalid `/06` `/05` opacity; `glassToggle` built classes by interpolation so the mirror toggle had no active state at all) |
| `e5bf46c` | `scan_performance` telemetry → PostHog (frames, total, seek, detect, fps) |
| `cefe312` | `ink` / `clay` Tailwind tokens replacing 415 arbitrary hex values — verified visually neutral (853 CSS rules before/after, identical declaration multiset) |
| `8f4531c` | `<MotionConfig reducedMotion="user">`; scoped the blanket reduced-motion CSS that was freezing loading spinners; fixed invisible-but-clickable HUD controls; fixed countdown desync (recording started while "GO!" was still animating in); `lib/cuePalette.ts` as single source for the 7 region colours |
| `f1d23cf` | **Scan stall fix** — the "stuck at 2%". `DancerTracker`'s coast budget only reset on a successful lock, so once blown every frame re-prompted, and "keep best guess" returned `-1` without locking → modal reappeared forever. Also recalibrated the fast-movement threshold |
| `bbc4c04` | **Service worker serving stale JS**; mobile `100vh` → `h-full`; header logo covering the fullscreen button; transport row wrapping |

### Infra also done
- Migration `007_scan_cache.sql` applied to `rnmnusnhkomiypjzmcbw` — `scan_cache` exists with both RLS policies.
- All four Vercel env vars repointed to that project; production redeployed.
- Supabase auth redirect allow-list fixed (was missing `https://trace-app-rho.vercel.app/auth/callback`).
- Emil Kowalski's 8 skills + Taste installed in `~/.claude/skills/` (inspected first — no network calls, `eval`, or credential access).
- `docs/CLAUDE_TOOLING.md` — what each skill does and when to use it.

---

## Known-good facts (don't re-derive)

- **Supabase stores zero video.** No `storage.upload()` call exists anywhere. The `dance-videos` bucket is created by `001_create_tables.sql:82-87` but is write-dead. Video lives in IndexedDB (`lib/videoStore.ts`).
- **The binding free-tier limit is the 500MB database**, not the 1GB storage. `scan_cache.timeline` is 20–80KB jsonb per row → ~12,000 scans ≈ 500MB.
- `scan_cache_key_idx` keys on segment bounds rounded to 0.1s, so re-trimming the same video writes a **whole new row**. No TTL, and nothing purges rows when `SCAN_VERSION` bumps — every `scan_version = 1` row is orphaned right now.
- **68% of `lib/` is platform-agnostic TypeScript** (tracker, timeline, cue runtime, count grid). A future React Native port keeps all of it — staying on web accrues no debt.
- **32 modules / 3,318 LOC are unreachable** from any entrypoint (incl. a whole disconnected 3D character subsystem, 6 unwired landing sections, 8 SVG character components). Richard chose to **leave it all** for now.

---

## Gotchas that cost real time today

- **Never run `npm run build` while the dev server is up** — it overwrites the same `.next` the dev server is serving and produces `Cannot find module './948.js'`. Use **`npm run build:check`** (writes to `.next-check` via `distDir`). Cost three rounds of confusion.
- **The service worker outlives everything.** `sw.js` caches `/_next/static/` cache-first. It survived clearing `.next`, deleting `node_modules/.cache`, restarting the server, cache-busting the URL, *and* checking out a clean HEAD. Now production-only, and dev actively unregisters any leftover worker. `CACHE_VERSION` bumped to `trace-v2` so installed clients drop a stale app shell — **if the phone still looks stale, delete the PWA from the Home Screen and re-add it.**
- Tailwind silently emits nothing for invalid opacity (`/06`) and for interpolated class names (`` `bg-${c}-100` ``). Both shipped unnoticed.
- Measure before optimising the scan: the first three hypotheses were wrong. Benchmarked seek cost at ~38ms/frame on desktop — **not** the bottleneck there. `scan_performance` events now report real device numbers.

---

## Open tasks

**Blocking / next**
1. Redo the cue-pipeline audit (above), then fix: density cap, 8-count locking, precomputed+scrubbable playback, visible counts, rolls/waves.
2. PWA install nudge so practice runs without Safari chrome.
3. Verify the practice screen at 375px — the mobile fixes there are reasoned from code, **not yet seen**, because it needs auth + a loaded video.

**Product calls needing Richard**
4. Idle timer hides transport controls after 500ms — mid-dance you're idle *by definition*, so they vanish when you can't reach them.
5. Recording indicator is an 8px pulsing dot, invisible from across a room.

**Deferred**
6. Scan speed architecture: replace 300 sequential seeks with playback-based sampling via `requestVideoFrameCallback` at elevated `playbackRate` (52s clip at 8× ≈ 6.5s). An earlier attempt returned zero frames because autoplay needs a user gesture — in-app there is one.
7. Supabase scaling: purge `scan_version < 2` rows, add TTL, widen segment rounding, move `thumbnail_url` off base64 data URIs, wrap RLS as `(select auth.uid())`, add `(user_id, created_at desc)` index, `security_invoker=true` on `user_progress`.
8. Duolingo-style redesign (direction chosen: bold, high-contrast, glanceable). Motion consolidation: 7 easings → 3, 19 durations → 4 tiers. Extract Button/Card/Modal primitives (100 raw `<button>`s).

**Housekeeping**
9. **Revoke the Supabase and Vercel tokens** pasted into chat earlier — they're in `.env.local` as `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN`.

---

## Verification commands

```bash
npx tsc --noEmit          # clean
npm test                  # 55 tests, 7 files
npm run build:check       # safe build while dev server runs
```
