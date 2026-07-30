# Trace — consolidated handoff (2026-07-29)

Self-contained. Paste this into a fresh chat and it should need no other context.

---

## 1. Project

- **Trace**: Next.js 14 (App Router) + Supabase dance-practice PWA. On-device MediaPipe pose detection compares the user (webcam) to a reference dancer. All AI on-device; infra budget **$0/month**.
- **Live (production = `main`)**: `https://trace-app-rho.vercel.app` — auto-deploys on push to `main`.
- **Supabase**: project `rnmnusnhkomiypjzmcbw` (the *old* "Trace" one). `gncvjzcgnukwmruloutu` / "Trace-Fresh" is abandoned.
- **Deadline**: KCON audition submissions close **Aug 7, 2026, 11:59 PDT**. Richard rehearses with the app.
- **Core feature**: `TraceTab` renders the webcam full-screen with a canvas above it drawing the reference dancer at `overlayOpacity/100` — draggable and pinch-zoomable to align with your body. The scan is **additive** (cues on top) and must never gate practice.
- **Three tabs**: `01 TRACE` (overlay practice) → `02 TEST` (record yourself) → `03 SYNC`.

### Verification commands

```bash
npx tsc --noEmit          # must be clean
npm test                  # 79 tests, 7 files
npm run build:check       # safe build while dev server runs
```

---

## 2. Shipped to production 2026-07-29

**`feedback-redesign` was merged to `main` and pushed** (merge commit `7375444`). Richard chose this over the preview URL. Production has every fix.

Why not the preview URL: **a Vercel preview is a different origin**, and videos live in origin-scoped IndexedDB. Rehearsing there would mean re-uploading the video and installing a *second* PWA to earn the 7-day eviction exemption. Merging kept his existing origin, stored video and installed PWA.

Why the merge was acceptable unverified: `adoptScan` sets `setFeedbackEnabled(false)`, so all four unverified cue features are dormant behind a Beta toggle. The default experience is effectively `main` + chrome fixes + tempo diagnostics.

### Two corrections to the earlier version of this doc

- **The recommended cherry-pick did not work.** Dry-run in a throwaway worktree: `a895c24` and `e99fba2` apply clean, but `3ba5990` conflicts two ways — `CountStrip.tsx` does not exist on `main`, and `TraceTab.tsx` hits a content conflict. It was also **not** "pure layout, no logic": it additionally flips cues to off-by-default, fixes auto-hide firing while paused, and rewrites the transport sheet as a framer-motion drag sheet.
- **`TOP_STACK` was only half-applied.** See §4.

Verified before pushing: `tsc` clean, 79/79 tests, `build:check` green on `main`, no console errors, geometry measured (below). **Not verified: anything requiring a login** — Claude cannot enter credentials, so no in-app practice-screen pass was possible.

---

## 3. Branch state — `feedback-redesign`, 15 commits ahead of `main`

Verified only by `tsc` clean + 79 tests + green `build:check` + the app booting with no console errors. **Nothing has been seen on a phone.**

| Commit | What |
|---|---|
| `d4cec97` | Design spec for the cue redesign |
| `544b12a` | Implementation plan |
| `c6457ee` | `lib/cueScript.ts` — beat-locked cue script, one cue per count |
| `de3f08f` | Arrow origin = movement start, not cooldown artifact |
| `80ccc3d` | Roll/wave detection by circuity |
| `dd940fe` | Cache raw events so tempo changes recompose; migration 008 |
| `62d08a2` | One cue renderer replacing seven bespoke shapes |
| `dae4684` | `FeedbackCanvas` purely precomputed |
| `3213ec9` | 8-count strip |
| `b3feaa5` | Tempo required for feedback; recompose instead of rescan |
| `c985a30` | iOS install walkthrough on the practice route |
| `1e07145` | Tempo detection reports *why* it failed + 3 real defects |
| `3ba5990` | **Practice chrome no longer stacks under the iPhone status bar** |
| `a895c24` | **Recording HUD visible from dancing distance** |
| `e99fba2` | **Touch targets at 44px on mobile** |
| `ebefee0` | **Finished applying `TOP_STACK` — 7 surfaces `3ba5990` missed, incl. all of `03 SYNC`** |
| `7375444` | **Merge to `main` → production** |

Specs: `docs/superpowers/specs/2026-07-29-cue-feedback-redesign-design.md`, plan: `docs/superpowers/plans/2026-07-29-cue-feedback-redesign.md`.

---

## 4. Root causes found — DO NOT RE-DERIVE

### The cue overlay felt overwhelming and "live" rather than precomputed

**One root cause explained three of five reported problems: BPM was `null` on the phone.**
- Both count displays were gated on `bpm !== null`.
- `quantize()` fell back to a **0.1s grid** with no musical meaning.
- `detectBeatsFromVideo` fetches and decodes the *entire* video; that fails on iOS for large files.

The other two:
- `MAX_PER_BUCKET = 3` capped cues **per time bucket, not per screen**. With a 1.3s cue lifetime and 0.1s buckets that permitted up to **39 concurrent cues**.
- `CueRuntime.cuesAt(t)` was *already* pure and seek-safe. What made it feel live was: (a) `beatPhase` falling back to a **wall-clock** `sin(performance.now())` oscillator, so cues pulsed while paused; (b) hit/miss badges being **live webcam judgments**, sticky per cue id and cleared only on *backward* seeks, so forward skips showed stale verdicts; (c) the timeline being composed once at scan time and never rebuilt.

Also: `anchorX/anchorY` was a **cooldown-reset artifact** — wherever a joint sat when its 800–1200ms cooldown last expired — so arrow length never represented how far a limb travels.

### The installed-PWA chrome stacked under the status bar

`PracticeView`'s header applied a safe-area inset but centred the tab bar with `absolute top-1/2`, which centres on the **padding box** — so a 59px Dynamic Island inset counted as centreable space. `TraceTab`'s controls used a bare `top-3` with **no inset at all**; the count strip used a third value; both `TestTab` HUDs used `top-4`.

Measured at a simulated 59px inset: tab bar was at **35px**, now **59px**, with no horizontal collision down to a 320px viewport.

**One shared `TOP_STACK` in `components/practice/chrome.ts` now owns this. Import it — do not add a fourth guess.**

#### `3ba5990` only half-applied it — finished in `ebefee0`

Seven more surfaces were still on hardcoded offsets, every one absolutely positioned against a viewport-filling tab root:

| Surface | Was | Overlap into header @59px inset |
|---|---|---|
| TraceTab top-left TRACE + loop badge | `top-16` | 39px — collided with the back button, while its top-right sibling one line below sat correctly |
| SyncTab SYNC/score badge | `top-14` | 47px |
| SyncTab score side panel | `top-14` | 47px |
| SyncTab done action sheet | `top-14` | 47px |
| TestTab PREVIEW badge | `top-3` | 91px |
| TestTab framing instruction | `top-11` | 59px |
| TestTab `saveError` banner | `top-20` | 23px |

All seven were also *beneath the status bar itself* at a 59px inset. The whole `03 SYNC` tab and the `02 TEST` framing state were untouched by the original fix.

**Measured, not assumed.** `env(safe-area-inset-top)` always resolves to 0 in a desktop browser and no stylesheet can override it, so the geometry was checked in a harness that substitutes a controllable variable into the exact CSS from source. Across insets 0/20/44/47/59 (flat, notch, 14/15 Pro, Dynamic Island): the header's bounding box ends at `inset + 44`, `TOP_STACK` lands at `inset + 48`, so clearance is **4px at every inset**. Stacked elements offset from `TOP_STACK` rather than re-guessing, preserving their original gaps.

Note the `chrome.ts` doc comment claims the header ends at 105px at a 59px inset; measured it is 103px. The `3rem` value is still correct.

### Beat detector defects (fixed)

- Every failure returned bare `null` from two bare `catch`es — six causes, one indistinguishable outcome. Now returns typed reasons (`too-large`, `fetch-failed`, `not-media`, `decode-failed`, `no-audio-track`, `no-tempo`, `out-of-range`), surfaced in the tap-tempo sheet and sent to PostHog as `beat_detection`.
- `guess()` renders its own window internally through a 240Hz lowpass — the old code pre-rendered the whole buffer separately, which the library discarded and redid. **Double peak memory on the device least able to afford it.** Now passes `(buffer, offset, duration)`.
- Analysis always started at `t=0`. Tutorial clips open on logo cards and talking intros. Now analyses the trimmed segment.
- `guess()` reports its offset *within* the rendered window, so beat one landed early once a non-zero window start was used.
- The `HEAD` preflight was dead code: `blob:` URLs (every uploaded video) reject HEAD outright.

**Still unknown:** which failure fires on Richard's phone. Leading suspect is `decode-failed` — Safari is far stricter than Chrome about extracting AAC from an MP4 container. **If it is that, it may be unfixable from here**; the workarounds (WebCodecs demuxing, realtime `MediaElementAudioSourceNode` capture) are both substantial, and tap-tempo is four taps.

### iOS evicts IndexedDB after 7 days

`navigator.storage.persist()` (`lib/videoStore.ts:96`) is effectively denied in a normal iOS Safari tab, and iOS evicts IndexedDB after **7 days without interaction**. Videos live in IndexedDB. **Installed PWAs are exempt.** So `InstallGate` protects the user's *videos*, not just screen space — its copy should say so.

---

## 5. Architecture of the new cue system

```
scan  →  MovementEvent[]              tempo-free, cached      ← the expensive part
            ↓  composeCueScript(events, grid)                 ← pure, instant, re-runnable
         CueScript                    one BeatCue per beat
            ↓  cueAt(script, t)                               ← pure lookup, binary search
         renderCue()
```

- **One-cue-on-screen is structural, not a limiter.** Windows are exactly one beat wide (`LEAD_BEATS 0.75 + HOLD_BEATS 0.25`), so adjacent windows abut and cannot overlap. There is no density cap to tune.
- **`cueAt` is a pure function of video time** — no cursor, no wall clock. Scrubbing, looping and `playbackRate` are exact.
- **Composition is separate from scanning**, so correcting the BPM recomposes every cue instantly instead of forcing a rescan. This is why the cache stores raw events (`SCAN_VERSION = 3`).
- `judgeCue` still exists in `lib/cueRuntime.ts` for the Test tab but **is not called from anywhere**. Wiring it into TestTab is deliberately out of scope.

**Cues are Beta and off by default** — Richard deprioritised the feature ("seems kind of hard to get right… set that as an experimental feature").

**Consequence:** the deferred scan-speed rewrite (300 sequential seeks → playback sampling via `requestVideoFrameCallback`) **is no longer worth the risk.** The scan exists only to produce cues. Revisit only if cues leave Beta.

**Known limitation:** roll detection needs ~4 samples/beat, and scan rate is `max(2, min(10, 300/span))` fps. A 37s trim gets ~4 and works; 180s+ floors at 2fps and emits nothing rather than noise.

---

## 6. Open items

**Blocking**
1. Device pass on a real iPhone — **now against production**, since §3 is merged. Chrome geometry is measured and trustworthy; the cue behaviour is not. Critical checks (turn the Beta cue toggle *on* first): never more than one cue on screen; scrubbing to the same moment always shows the identical cue; changing BPM after a scan re-lands cues without a rescan. Also confirm `03 SYNC` and `02 TEST` framing badges now clear the Dynamic Island. **If the phone looks stale, delete the PWA from the Home Screen and re-add it** (§7).
2. **Migration `008_scan_cache_v3.sql` is UNAPPLIED.** It contains `delete from scan_cache where scan_version < 3` — destructive against production, deliberately left for a human. Not urgent: old rows just read as cache misses.
3. Report which `beat_detection` reason fires on the phone.

**Deferred / product calls**
4. Duolingo-style redesign — direction chosen (bold, high-contrast, glanceable). **Deliberately not started**: a visual overhaul touching ~100 raw buttons is high-churn, and it should be aimed at what actually annoys Richard in a real session rather than guesses. The motion-consolidation item was overstated — practice components only use 3 duration values.
5. `SCORE_FLOOR = 0.08` and the roll thresholds need tuning against the real TXT clip.
6. TikTok/YouTube link import — Richard wants to explore it. **A page URL is not a video file**; `useSignedUrl` returns full URLs as-is, so the fetch gets HTML (this is the new `not-media` case). Making it work needs server-side extraction (yt-dlp), which is feasible on Vercel's free tier but violates those sites' ToS and breaks constantly. The working path is share sheet → Files → upload.
7. Supabase scaling: TTL on `scan_cache`, widen segment rounding, move `thumbnail_url` off base64 data URIs, wrap RLS as `(select auth.uid())`, add `(user_id, created_at desc)` index, `security_invoker=true` on `user_progress`.
8. 32 modules / 3,318 LOC unreachable from any entrypoint (incl. a disconnected 3D character subsystem, 6 unwired landing sections, 8 SVG character components). Richard chose to leave it.

**Housekeeping**
9. **Revoke the Supabase and Vercel tokens** pasted into chat earlier — they are in `.env.local` as `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN`. **Confirmed still present 2026-07-29.** Rotate at the Supabase and Vercel dashboards; Claude cannot do this for you. Highest-value item on this list that takes under two minutes.

---

## 7. Gotchas that cost real time

- **Never run `npm run build` while the dev server is up** — it overwrites the same `.next` the dev server serves and produces `Cannot find module './948.js'`. Use **`npm run build:check`** (writes to `.next-check`).
- **The service worker outlives everything.** `sw.js` caches `/_next/static/` cache-first and survived clearing `.next`, deleting `node_modules/.cache`, restarting the server, cache-busting the URL, *and* checking out a clean HEAD. **If the phone looks stale, delete the PWA from the Home Screen and re-add it.**
- **Tailwind silently emits nothing** for invalid opacity suffixes (`/06`) and for interpolated class names (`` `bg-${x}-100` ``). Both shipped unnoticed once. Verify new arbitrary variants actually emit CSS: `grep '\[data-active' .next-check/static/css/*.css`.
- **`npm run build` lints test files too.** An unused `_a` parameter in a vitest stub failed the build while `tsc` passed.
- **Measure before optimising.** The first three hypotheses about scan cost were wrong; seek was ~38ms/frame on desktop and *not* the bottleneck there. `scan_performance` telemetry now reports real device numbers.
- **Supabase stores zero video.** No `storage.upload()` call exists anywhere. Video lives in IndexedDB (`lib/videoStore.ts`). The binding free-tier limit is the **500MB database**, not the 1GB storage.
- **68% of `lib/` is platform-agnostic TypeScript** (tracker, timeline, cue script, count grid). A React Native port keeps all of it — staying on web accrues no debt.

---

## 8. Tooling

Installed skills at `~/.claude/skills/`: `emil-design-eng`, `taste`, `apple-design`, `improve-animations`, `animation-vocabulary`, `find-animation-opportunities`, `review-animations`, `frontend-patterns`, `pick-ui-library`, `prototype`, plus the full `superpowers` and `vercel:*` suites. Added 2026-07-29: `web-design-guidelines` (vercel-labs, 499K installs) and `accessibility` (addyosmani, 40K). All inspected — pure markdown, no scripts.

**Not worth installing** (searched and rejected): computer-vision skills are OpenCV-oriented and would mislead for MediaPipe; Web Audio results are game-audio; PWA and canvas results were weak; the top debugging skill is `superpowers@systematic-debugging`, already installed.

**Figma MCP**: requires the Figma desktop app running locally *and* a paid seat — breaks the $0/month constraint, and only pays off if designing in Figma first. **Playwright**: not installed, and partly redundant with the in-app browser tools.
