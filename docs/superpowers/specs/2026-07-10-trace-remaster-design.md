# Trace Remaster — Design Spec

**Date:** 2026-07-10
**Status:** Approved direction (web-first "app-like" remaster; native app deferred)
**Deadline context:** KCON audition ~Aug 20; audition forms expected within 2–3 weeks. Phase 1 must produce a genuinely usable experimental version for daily solo practice.

## Goals

1. **Seamless choreo learning.** A dancer picks a video, picks the section and the dancer to follow, and is practicing within seconds — with cues that arrive *before* the move, aligned to 8-counts.
2. **Repeat practice is instant.** The same choreo opens with zero re-upload and zero re-scan.
3. **$0/month to run** at 10–50 users. All pose AI stays on-device; Supabase stores only metadata and small JSON. Free core forever; premium features (later) paywall only storage-costly extras.
4. **Feels like an installed app** on the phone: fullscreen PWA, no Safari chrome.

## Non-goals (Phase 1)

- Native (React Native/Capacitor) app — revisit only after traction.
- Framework upgrades (Next 16 / React 19 / Tailwind 4) — Phase 2, post-audition-forms.
- Premium features and payments — Phase 2. Groundwork only (data model must not preclude them).
- Server-side video processing of any kind.

## Current pain → root cause

| Symptom | Root cause |
|---|---|
| Cues fire too early/late/never | Reactive runtime scheduler: cues fire *at* event time, then wait up to 550ms for beat-snap (`cueScheduler.ts`); low-priority cues dropped under load |
| Wrong dancer tracked in group videos | Greedy nearest-hip-center tracking (`videoPreScan.ts`) fails exactly at K-pop formation crossings |
| Upload/scan slow and confusing | Full-video scan regardless of length; no trim; no guidance; ~9MB model re-downloaded from CDN each cold start; WASM pinned to 0.10.18 vs installed 0.10.32 |
| Nothing persists | Reference videos are `sessionStorage` blob URLs (die with the tab); scan results never cached |
| Feels like a webpage | Manifest exists but no service worker, no PNG icons → not properly installable on iOS |

## Pillar 1 — Guided import: "pick the part you want to learn"

**Flow (all sources — YouTube/TikTok link or local file):**
1. Paste link / pick file → video appears immediately in a trim view.
2. User drags trim handles to select the practice segment. Default: whole video if ≤60s; if longer, UI nudges toward selecting a section (dancers learn in sections). Segments are first-class: a video can have multiple named segments, each independently scanned and loopable in practice.
3. If multiple people detected on the segment's first readable frame → dancer picker (Pillar 2).
4. Scan runs on the trimmed segment only, with a progress bar and time estimate.

**Persistence:**
- **Reference video → IndexedDB** (on-device, survives tab/app restarts). Evict LRU above a size budget (~2GB, configurable); always ask before evicting.
- **Scan result (choreo timeline JSON) → Supabase** table `scan_cache`, keyed by `(video_identity, segment_start, segment_end, scan_version)`. `video_identity` = YouTube/TikTok video ID for links, SHA-256 of file bytes for uploads. Shared across users for link-sourced videos (a public video's choreography is not private data); upload-sourced entries are RLS-scoped to the owner.
- `scan_version` lets us invalidate cache when the detector changes.

**Result:** first session of a new choreo = trim + one scan; every later session = tap and practice.

## Pillar 2 — Dancer lock

- **Selection:** freeze-frame at segment start with a tappable box per detected person. Single person → auto-selected, no prompt.
- **Tracker rebuild** (`lib/dancerTracker.ts`, replaces inline logic in `videoPreScan.ts`):
  - Constant-velocity prediction of the locked dancer's next position; match candidates by predicted-position distance + bounding-box IoU, not raw nearest-center.
  - Per-frame confidence score. Occlusion tolerated by coasting on the prediction for a bounded number of frames.
  - When confidence stays below threshold past the coast window (a real crossing/identity swap risk), the scan **pauses on that frame and asks the user to re-tap** their dancer. Bounded interruptions beat silently following the wrong member.
- **During practice:** subtle highlight (dim box/spotlight) on the tracked dancer in the reference playback so the user always knows who is being followed.
- MediaPipe `numPoses: 10` retained; MediaPipe stays the pose engine (evaluated MoveNet: faster but 17 keypoints and weaker multi-person — rejected).

## Pillar 3 — Count-based anticipatory cue engine

**Principle:** all timing decisions move to scan time; runtime becomes deterministic playback. 8-counts are the backbone.

- **At scan time** produce a **choreo timeline**: movement events from `MovementEventDetector`, quantized to the `CountGrid` (existing 8-count model with downbeat/snare/offbeat accents). BPM from `beatDetector.ts` auto-detection with manual `BpmInput` override; beat-one offset user-adjustable ("tap on 1").
- Each timeline entry: `{ videoTime, count (1–8), measureIndex, accent, joint, eventType, position, magnitude }`. This JSON is what `scan_cache` stores.
- **At practice time** the runtime plays the timeline with a **lead time** (default 600ms, user-tunable): each cue appears *before* its move, rhythm-game style, so the dancer can anticipate. No runtime queueing, no priority-based dropping — density is capped at scan time instead (per half-count, keep the highest-magnitude event).
- **Counts in the UI:** current count (1–8) displayed during practice, accented on downbeats; cues labeled with their count ("on 5").
- **Feedback:** each cue resolves to hit/partial/miss by comparing user pose (live MediaPipe) to the reference pose for that cue within a tolerance window around its videoTime. Feedback always corresponds to a visible cue — no orphan feedback, no silent cues. Sync scoring (existing worker) continues in parallel for the session score.
- `CueScheduler`'s pending-queue/beat-snap logic is deleted; `CountGrid` is reused as-is.

## Pillar 4 — Performance, PWA, cleanup

- **Models self-hosted** in `public/models/`: `pose_landmarker_lite` (scanning — ~2x faster per frame) and `pose_landmarker_full` (live practice precision). WASM served from the installed `@mediapipe/tasks-vision` version — no CDN, no version skew.
- **PWA finish:** PNG icons (192/512 + `apple-touch-icon` 180), service worker precaching app shell + models + WASM, install prompt UX ("Add to Home Screen" walkthrough on iOS). Result: fullscreen standalone launch, practice works offline once assets are cached.
- **Mobile polish:** safe-area insets, ≥44px touch targets in practice flow, orientation handling.
- **Cleanup:** remove deprecated `@supabase/auth-helpers-nextjs` (keep `@supabase/ssr`), delete stray ChatGPT SVGs and `public/test-video.MOV` (3.3MB) from the repo/deploys, prune dead `dance-videos` bucket code paths if unused.

## UI bug sweep

Dedicated pass across landing → auth → dashboard → import → practice → results on mobile Safari (primary) and desktop Chrome: layout breakage, dead buttons, state glitches (blob URL loss, tab restore), loading states. Bugs found are fixed as part of the pillar touching that surface where possible; the remainder as a final punch list.

## Data model changes (Supabase)

- New `scan_cache` table (see Pillar 1) with RLS: link-sourced rows readable by all authenticated users, upload-sourced rows owner-only.
- `practice_sessions` gains `segment_start`, `segment_end` (nullable) so scores attach to sections.
- No stored video bytes anywhere server-side (zero-storage architecture preserved).

## Error handling

- Scan aborted / tab closed mid-scan → partial results discarded; cache written only on completion.
- BPM detection fails → practice still works; cues quantize to a time grid at 100ms resolution and count UI hides until BPM set manually.
- IndexedDB unavailable (private browsing) → fall back to current session-only behavior with a notice.
- Dancer re-tap prompt dismissed → continue with best-guess tracking, mark timeline entries from low-confidence spans so practice UI can de-emphasize them.

## Testing

- Unit tests for `dancerTracker` (synthetic crossing scenarios), timeline quantization (BPM/offset edge cases), and cache keying (hashing, segment bounds).
- Manual device matrix: iPhone Safari (installed PWA + in-browser), desktop Chrome. Test videos: 15s single-dancer TikTok, 3-min multi-dancer K-pop choreo, no-music clip (BPM-fail path).

## Success criteria (Phase 1 / KCON-ready)

1. Re-opening a previously scanned choreo → practicing in <5 seconds, offline OK.
2. New 30s segment of a 3-min video → scanned in well under a minute on an iPhone.
3. Group-video scan follows the chosen dancer through formation changes, asking at most a few re-taps.
4. Every cue appears before its move, labeled with its count; every cue gets hit/miss feedback.
5. Installed from home screen, fullscreen, no Safari chrome.
6. Monthly infra cost: $0.

## Phase 2 (separate spec when Phase 1 ships)

Next 16 / React 19 / Tailwind 4 upgrades; premium groundwork (cloud recording history + side-by-side compare, split-screen export video, per-region analytics — free core untouched, storage-costly features paywalled); PostHog activation/retention instrumentation and the consumer-metrics story (activation = first scored practice completed).
