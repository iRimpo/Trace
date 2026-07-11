# UI Bug Sweep Log — Remaster Phase 1

Static/code-level pass (2026-07-10). Device verification checklist at the bottom
is for the real-iPhone pass before deploying to production.

## Fixed

| # | Bug | Root cause | Fix |
|---|-----|-----------|-----|
| 1 | Hairline borders/backgrounds missing across the whole app (39 class uses on landing, dashboard, practice, upload) | `border-[#1a0f00]/08` — Tailwind does not parse leading-zero opacity, so these classes generated **no CSS** and silently rendered nothing | Replaced all `/08` with `/[0.08]` (verified generated CSS) |
| 2 | Reference video lost on hard reload / tab restore → black player, forced re-upload | Blob object URLs die with the document; sessionStorage kept a dead URL | `restoreVideoSession()` re-mints the URL from IndexedDB via `identityKey` |
| 3 | Practice chrome under the iPhone notch / behind the home-bar in installed (standalone) mode | No `env(safe-area-inset-*)` on absolutely-positioned chrome | Safe-area insets on PracticeView header, TraceTab satellites + transport, SyncTab playback bar (InstallPrompt shipped with it) |
| 4 | Cues appearing at/after the move, or never (dropped by priority queue) | Reactive scheduler design | Full cue-engine rebuild (see spec Pillar 3) — anticipatory lead, deterministic |
| 5 | Wrong dancer followed after formation crossings in group videos | Greedy nearest-center tracking | DancerTracker rebuild (spec Pillar 2) |
| 6 | Session-page loading screen showed a raw ChatGPT-named SVG; 4 junk SVG filenames with spaces/parens served in production | Leftover assets | Renamed the four referenced character SVGs, deleted the rest + 3.3MB test video, removed dev test pages |
| 7 | Every cold start re-downloaded ~9MB model from Google CDN + version-skewed WASM (pinned 0.10.18 vs installed 0.10.32+) | CDN-hosted model/wasm | Self-hosted in `public/`, service-worker precached, lite model for scans |
| 8 | iOS "Add to Home Screen" produced a broken/blank icon | Manifest only had an SVG icon; no apple-touch-icon | Generated PNG 192/512/180 icons, updated manifest + layout metadata |

## Known-not-fixed (deliberate)

- `vm.tiktok.com` short links don't resolve to an identity (needs a network
  resolve) — videos still work, they just skip the shared scan cache.
- `useSignedUrl` / `dance-videos` legacy API paths kept for historical
  server-stored videos (pre-zero-storage accounts).

## Device verification checklist (run on iPhone Safari + installed PWA)

1. Install from Share → Add to Home Screen: correct icon, opens fullscreen to /dashboard, no Safari chrome.
2. Upload a >60s video → section nudge appears → calibrate/trim → scan shows progress + ETA.
3. Kill the app, reopen → video listed under "On this device" → tap → practicing in <5s with **no rescan** (scan cache hit; requires migration 007 applied).
4. Group K-pop video → dancer picker appears → tracking follows chosen member; re-tap prompt on hard crossings.
5. Cues appear *before* moves with count labels; hit/miss rings after each cue; Lead slider (Tools panel) shifts anticipation.
6. Airplane mode after one full load → practice still works end-to-end on a cached video.
7. Rotate + notch check: no controls under notch/home bar in both orientations.
