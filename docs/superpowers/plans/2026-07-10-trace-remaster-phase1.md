# Trace Remaster Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Trace's practice pipeline so a dancer goes from video → section → locked dancer → count-aligned anticipatory cues in seconds, with everything cached for instant repeat sessions — at $0/month infra.

**Architecture:** All pose AI stays on-device (MediaPipe tasks-vision). Scan-time work expands (dancer tracking, beat-quantized timeline building, density capping) so practice-time becomes deterministic playback of a cached timeline. Reference videos persist in IndexedDB; timelines cache in a new Supabase `scan_cache` table keyed by video identity + segment. PWA completed with self-hosted models and a precaching service worker.

**Tech Stack:** Next.js 14 (App Router, no upgrade this phase), TypeScript, MediaPipe tasks-vision 0.10.x, Supabase (`@supabase/ssr` only), Tailwind 3, Vitest (new, unit tests only), fake-indexeddb (new, tests).

**Spec:** `docs/superpowers/specs/2026-07-10-trace-remaster-design.md`

## Global Constraints

- $0/month: no new paid services; no server-side video processing; no video bytes stored in Supabase.
- Free core: nothing in this phase may be gated.
- Zero-storage architecture preserved (spec: "No stored video bytes anywhere server-side").
- No framework upgrades (Next 14 / React 18 / Tailwind 3 stay).
- `scan_version` constant starts at `1`; bump whenever detector/timeline output changes shape.
- Cue lead time default 600ms, user-tunable.
- IndexedDB video budget: 2GB default, LRU eviction, always confirm with user before evicting.
- All new lib code: pure functions/classes, no React imports, unit-testable.

---

### Task 1: Vitest test infrastructure

**Files:**
- Modify: `package.json` (devDependencies + `"test": "vitest run"` script)
- Create: `vitest.config.ts`
- Create: `lib/__tests__/smoke.test.ts` (deleted again in Task 2 once real tests exist)

**Interfaces:**
- Produces: `npm test` runs Vitest over `lib/__tests__/**/*.test.ts` with jsdom + fake-indexeddb available.

- [ ] **Step 1: Install dev deps**

```bash
npm i -D vitest fake-indexeddb @vitest/coverage-v8 jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "jsdom",
    include: ["lib/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Smoke test + script**

`lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => { it("runs", () => expect(1 + 1).toBe(2)); });
```
Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Run `npm test`** — Expected: 1 passed.

- [ ] **Step 5: Commit** — `chore: add vitest test infrastructure`

---

### Task 2: `lib/choreoTimeline.ts` — beat-quantized timeline builder

**Files:**
- Create: `lib/choreoTimeline.ts`
- Test: `lib/__tests__/choreoTimeline.test.ts`
- Delete: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: `MovementEvent` from `lib/movementEventDetector`, `CountGrid` from `lib/countGrid`.
- Produces:
```ts
export interface TimelineEntry {
  id: number;                    // stable index within timeline
  time: number;                  // quantized video time (s)
  rawTime: number;               // original event videoTime (s)
  count: number | null;          // 1–8, null when no BPM
  measureIndex: number | null;
  accent: "downbeat" | "snare" | "offbeat" | null;
  type: EventType;
  jointIndex: number;
  jointName: string;
  x: number; y: number; anchorX: number; anchorY: number;
  dx: number; dy: number; magnitude: number;
  personBounds?: { x1: number; y1: number; x2: number; y2: number };
  lowConfidence?: boolean;       // set for events from low-confidence tracking spans
}
export interface ChoreoTimeline {
  version: number;               // SCAN_VERSION
  bpm: number | null;
  beatOneOffset: number;
  videoHeight: number;
  entries: TimelineEntry[];      // sorted by time asc
}
export const SCAN_VERSION = 1;
export function buildChoreoTimeline(
  events: MovementEvent[],
  grid: CountGrid | null,
  videoHeight: number,
): ChoreoTimeline;
```

**Behavior (implement exactly):**
1. Quantize each event's `videoTime` to the nearest **half-count** when `grid?.hasBpm` (grid spacing = `60 / bpm / 2` anchored at `beatOneOffset`); otherwise to a 100ms grid (spec error-handling path).
2. Bucket by quantized time. Within a bucket: dedupe per `jointIndex` keeping max `magnitude`; then keep top 3 by `(priority desc, magnitude desc)` with priority table `{ step: 5, "arm-both": 4, move: 3, head: 2, hip: 2, elbow: 1, shoulder: 1 }` (moved here from `cueScheduler.ts`).
3. Fill `count`/`measureIndex`/`accent` from `grid.count(quantizedTime)` when BPM known, else nulls.
4. Entries sorted by `time`, `id` = array index.

- [ ] **Step 1: Write failing tests** covering: half-count snapping (bpm 120, offset 0 → event at 0.26s snaps to 0.25s); 100ms fallback without grid; per-joint dedupe keeps larger magnitude; bucket cap of 3 honoring priority; count/accent populated (bpm 120: t=0 → count 1 downbeat); sort + ids stable.
- [ ] **Step 2: `npx vitest run lib/__tests__/choreoTimeline.test.ts`** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement `lib/choreoTimeline.ts`** per behavior above.
- [ ] **Step 4: Run tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: beat-quantized choreo timeline builder`

---

### Task 3: `lib/videoIdentity.ts` — stable identity for videos

**Files:**
- Create: `lib/videoIdentity.ts`
- Test: `lib/__tests__/videoIdentity.test.ts`

**Interfaces:**
- Produces:
```ts
export type VideoIdentity =
  | { kind: "youtube"; id: string }
  | { kind: "tiktok"; id: string }
  | { kind: "file"; sha256: string };
export function parseLinkIdentity(url: string): VideoIdentity | null; // youtube.com/watch?v=, youtu.be/, shorts/, tiktok.com/@user/video/<id>, vm.tiktok.com unsupported → null
export async function fileIdentity(file: Blob): Promise<VideoIdentity>; // WebCrypto SHA-256 of bytes, hex
export function identityKey(v: VideoIdentity): string; // "youtube:<id>" | "tiktok:<id>" | "file:<sha256>"
```

- [ ] **Step 1: Failing tests** — each URL shape above (+ garbage URL → null); `fileIdentity(new Blob(["abc"]))` → known SHA-256 (`ba7816bf...`); `identityKey` formats.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (WebCrypto `crypto.subtle.digest`; jsdom provides it via Node webcrypto).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** — `feat: video identity parsing + hashing`

---

### Task 4: `lib/videoStore.ts` — IndexedDB reference-video persistence

**Files:**
- Create: `lib/videoStore.ts`
- Test: `lib/__tests__/videoStore.test.ts` (use `fake-indexeddb/auto` import at top)

**Interfaces:**
- Consumes: `identityKey` strings from Task 3.
- Produces:
```ts
export interface StoredVideo {
  key: string;             // identityKey
  blob: Blob;
  fileName: string;
  songName: string;
  thumbnailUrl?: string;
  bytes: number;
  lastUsedAt: number;      // epoch ms — updated on get
}
export async function putVideo(v: Omit<StoredVideo, "bytes" | "lastUsedAt">): Promise<void>;
export async function getVideo(key: string): Promise<StoredVideo | null>;   // bumps lastUsedAt
export async function listVideos(): Promise<Omit<StoredVideo, "blob">[]>;   // metadata only, lastUsedAt desc
export async function deleteVideo(key: string): Promise<void>;
export async function evictionCandidates(budgetBytes?: number): Promise<Omit<StoredVideo, "blob">[]>; // LRU overflow above 2GB default — caller must confirm with user before deleteVideo (spec)
export function idbAvailable(): boolean;
```
DB name `trace-videos`, store `videos` keyed by `key`. All functions no-throw on missing IDB: `idbAvailable()` false → callers fall back to session-only behavior (spec error-handling).

- [ ] **Step 1: Failing tests** — put/get roundtrip preserves blob bytes + metadata; `getVideo` bumps `lastUsedAt`; list sorted desc; delete removes; `evictionCandidates(100)` with two stored videos returns the older one when over budget.
- [ ] **Step 2: Run — FAIL.** / **Step 3: Implement** (raw IndexedDB, no new deps). / **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** — `feat: IndexedDB reference video store`

---

### Task 5: `scan_cache` — migration + client

**Files:**
- Create: `supabase/migrations/007_scan_cache.sql`
- Create: `lib/scanCache.ts`
- Test: `lib/__tests__/scanCache.test.ts` (pure key/serialization parts only; Supabase I/O mocked with a stub client)

**Interfaces:**
- Consumes: `ChoreoTimeline`/`SCAN_VERSION` (Task 2), `VideoIdentity`/`identityKey` (Task 3).
- Produces:
```ts
export interface ScanCacheKey { identity: VideoIdentity; segmentStart: number; segmentEnd: number; }
export function cacheRowKey(k: ScanCacheKey): { video_identity: string; segment_start: number; segment_end: number; scan_version: number }; // segment bounds rounded to 0.1s
export async function getCachedTimeline(k: ScanCacheKey): Promise<ChoreoTimeline | null>;
export async function putCachedTimeline(k: ScanCacheKey, t: ChoreoTimeline, isUpload: boolean): Promise<void>; // best-effort: swallow errors (offline OK)
```

**Migration `007_scan_cache.sql`:**
```sql
create table if not exists public.scan_cache (
  id uuid primary key default gen_random_uuid(),
  video_identity text not null,
  segment_start numeric(8,1) not null default 0,
  segment_end   numeric(8,1) not null default 0,
  scan_version  int not null,
  timeline      jsonb not null,
  is_upload     boolean not null default false,
  owner_id      uuid references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (video_identity, segment_start, segment_end, scan_version, owner_id)
);
alter table public.scan_cache enable row level security;
create policy "link scans readable by all authed" on public.scan_cache
  for select using (auth.role() = 'authenticated' and (not is_upload or owner_id = auth.uid()));
create policy "insert own scans" on public.scan_cache
  for insert with check (auth.uid() = owner_id or (not is_upload and owner_id is null));
alter table public.practice_sessions
  add column if not exists segment_start numeric(8,1),
  add column if not exists segment_end   numeric(8,1);
```
Link-sourced rows insert with `owner_id null, is_upload false` (shared); uploads insert `owner_id = auth.uid(), is_upload true`.

- [ ] **Step 1: Failing tests** for `cacheRowKey` rounding + version stamping; get/put against a stubbed `.from()` chain returning canned rows.
- [ ] **Step 2–4: FAIL → implement → PASS.**
- [ ] **Step 5:** Append migration to `supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql` runbook and note in `supabase/README_MIGRATIONS.md`. **User must run it in the Supabase SQL editor** (flag in final report).
- [ ] **Step 6: Commit** — `feat: scan cache table + client`

---

### Task 6: `lib/dancerTracker.ts` — velocity + IoU tracker with confidence

**Files:**
- Create: `lib/dancerTracker.ts`
- Test: `lib/__tests__/dancerTracker.test.ts`
- Modify: `lib/videoPreScan.ts` (replace inline nearest-center logic, lines ~148–196)

**Interfaces:**
- Consumes: `Keypoint` from `lib/mediapipe`.
- Produces:
```ts
export interface TrackStep { kps: Keypoint[] | null; confidence: number; needsReacquire: boolean; }
export class DancerTracker {
  constructor(opts?: { maxCoastFrames?: number /*default 8*/; reacquireBelow?: number /*default 0.35*/ });
  lock(center: { x: number; y: number }): void;           // normalized 0–1
  step(allPoses: Keypoint[][], vW: number, vH: number): TrackStep;
  get center(): { x: number; y: number } | null;
}
```
**Matching (implement exactly):** predicted center = last center + EMA velocity (α=0.5). Candidate score = `0.6 * (1 - min(dist(pred, cand)/0.3, 1)) + 0.4 * IoU(lastBounds, candBounds)`. Best candidate wins; `confidence` = best score, reduced by `0.15` when runner-up is within `0.05` of best (crowding ambiguity). Below `reacquireBelow`: coast (return `kps: null`, keep prediction advancing) up to `maxCoastFrames` consecutive frames, then `needsReacquire: true`.

**videoPreScan changes:** replace `trackedCenter`/`MAX_DRIFT` block with `DancerTracker`; extend `onPersonChoice` so it is also invoked mid-scan when `needsReacquire` (pause the loop, await user tap, `tracker.lock(chosen)`); events emitted while `confidence < 0.5` get `lowConfidence` marking (consumed by Task 2's entries via the event object). `preScanVideo` now returns `{ timeline: ChoreoTimeline }` built via `buildChoreoTimeline` (accept a `CountGrid | null` param from caller).

- [ ] **Step 1: Failing tests** — synthetic scenarios with fabricated keypoint arrays (helper `mkPose(cx, cy)` building 33 kps around a center): (a) straight-line motion stays locked; (b) two dancers crossing paths: tracker follows velocity through the cross (nearest-center would swap — assert it doesn't); (c) occlusion 3 frames → coasts, re-locks; (d) occlusion > maxCoastFrames → `needsReacquire`; (e) crowded ambiguity lowers confidence.
- [ ] **Step 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Refactor `videoPreScan.ts`** to the new return shape + reacquire callback; update the one caller (`components/practice/TraceTab.tsx:283` `runScan`) minimally so build passes (full UI wiring is Task 8): treat `result.timeline.entries` as the events list (`TimelineEntry` is a superset of what `FeedbackCanvas` reads: time/x/y/type/…) — rename prop plumbing in Task 7.
- [ ] **Step 6: `npm run build`** — Expected: compiles.
- [ ] **Step 7: Commit** — `feat: dancer tracker with velocity prediction + mid-scan reacquire`

---

### Task 7: Cue runtime — deterministic anticipatory playback

**Files:**
- Create: `lib/cueRuntime.ts`
- Test: `lib/__tests__/cueRuntime.test.ts`
- Modify: `components/practice/FeedbackCanvas.tsx` (consume timeline + runtime instead of `MovementEvent[]` + `CueScheduler`)
- Modify: `lib/overlayRenderer.ts` (Cue type source)
- Delete: `lib/cueScheduler.ts` (after consumers migrated; `CountGrid` untouched)

**Interfaces:**
- Consumes: `ChoreoTimeline`, `TimelineEntry` (Task 2).
- Produces:
```ts
export type CueState = "upcoming" | "active" | "hit" | "partial" | "miss";
export interface RuntimeCue { entry: TimelineEntry; state: CueState; progress: number /*0–1 through its window*/; }
export class CueRuntime {
  constructor(timeline: ChoreoTimeline, opts?: { leadMs?: number /*default 600*/; activeMs?: number /*default 700*/ });
  cuesAt(videoTime: number): RuntimeCue[];   // pure function of video time — deterministic, seek-safe
  resolve(entryId: number, state: "hit" | "partial" | "miss"): void;
  resetResolutions(): void;                  // on seek backwards / loop restart
}
export function judgeCue(entry: TimelineEntry, userFrames: PoseFrame[], toleranceMs?: number /*default 300*/): "hit" | "partial" | "miss";
```
`cuesAt` window per cue: visible from `entry.time - leadMs/1000` (state `upcoming`, progress ramps 0→1 until `entry.time`), `active` until `entry.time + activeMs/1000`, then resolved state persists until scrolled past. `judgeCue`: within ±tolerance of `entry.time`, does the user's same-joint displacement magnitude reach ≥40% of `entry.magnitude` (scaled by relative video heights) → hit; ≥15% → partial; else miss.

- [ ] **Step 1: Failing tests** — cue appears exactly leadMs early; progress ramp values; deterministic across repeated/seeked calls; loop reset clears resolutions; `judgeCue` hit/partial/miss thresholds with synthetic user frames.
- [ ] **Step 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Migrate `FeedbackCanvas`** — props change `preScannedEvents: MovementEvent[]` → `timeline: ChoreoTimeline | null`; internal rAF loop calls `runtime.cuesAt(video.currentTime)` and hands cues to `overlayRenderer`; count display uses `entry.count` ("on 5" labels). Wire `judgeCue` against the live user pose buffer (already recorded via `poseRecorder`) at `entry.time + tolerance`, call `runtime.resolve`. Update `TraceTab.tsx` prop plumbing (line ~659) and lead-time state (slider in settings UI, default 600, persisted to `localStorage["trace_cue_lead_ms"]`).
- [ ] **Step 6: Delete `lib/cueScheduler.ts`**; move `Cue` type needs into `cueRuntime` (`overlayRenderer.ts:1` import updated).
- [ ] **Step 7: `npm run build` + `npm test`** — Expected: green.
- [ ] **Step 8: Commit** — `feat: deterministic anticipatory cue runtime with count labels + hit/miss`

---

### Task 8: Guided import flow + cache wiring

**Files:**
- Modify: `app/practice/page.tsx` (import: link/file → trim → dancer pick, IndexedDB save, duration nudge >60s)
- Modify: `components/practice/CalibrationModal.tsx` (reuse existing trim/person UI; ensure it feeds segment + center forward — keep, don't rebuild)
- Modify: `components/practice/TraceTab.tsx` `runScan` (check `getCachedTimeline` before scanning; `putCachedTimeline` after; keep in-memory Map as L1)
- Modify: `lib/sessionVideoStorage.ts` (restore-from-IndexedDB path when sessionStorage blob is gone)

**Interfaces:**
- Consumes: Tasks 3, 4, 5 APIs as declared.

- [ ] **Step 1:** In `app/practice/page.tsx`: on file select → `fileIdentity(file)` → `putVideo({...})`; on link paste → `parseLinkIdentity(url)`. Persist chosen `identityKey` with the session handoff (extend `VideoSession` with `identityKey?: string`). Over-60s videos: banner "Long video — pick the section you're learning first" before continuing (segment select happens in the existing calibration trim UI).
- [ ] **Step 2:** In `lib/sessionVideoStorage.ts`: `loadVideoSession()` — when `blobUrl` is dead/absent but `identityKey` present → `getVideo(key)` → recreate object URL. `idbAvailable()` false → current behavior + one-time notice string returned for UI.
- [ ] **Step 3:** In `runScan`: before `preScanVideo`, `await getCachedTimeline({identity, segmentStart: start ?? 0, segmentEnd: end ?? 0})` → on hit, use it and skip scanning entirely; on scan completion, fire-and-forget `putCachedTimeline` (`isUpload` from identity kind).
- [ ] **Step 4:** Dashboard "recent videos": list `listVideos()` entries so a stored choreo is one tap from practice.
- [ ] **Step 5: Manual test:** upload flow, close tab, reopen → video present, scan instant (from cache). Run `npm run build`.
- [ ] **Step 6: Commit** — `feat: guided import with persistent videos + instant cached scans`

---

### Task 9: Self-hosted models, service worker, installable PWA

**Files:**
- Create: `public/models/pose_landmarker_lite.task`, `public/models/pose_landmarker_full.task` (downloaded), `public/mediapipe-wasm/*` (copied from node_modules)
- Create: `public/sw.js`, `components/ServiceWorkerRegistrar.tsx`, `components/InstallPrompt.tsx`
- Create: `scripts/generate-icons.mjs` (+ `sharp` devDep) → `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- Modify: `lib/mediapipe.ts` (local WASM + model paths; `initPoseDetection(model: "lite" | "full")`), `lib/videoPreScan.ts` (use lite), `public/manifest.json` (PNG icons), `app/layout.tsx` (registrar, apple-touch-icon link)

- [ ] **Step 1: Fetch assets**
```bash
curl -Lo public/models/pose_landmarker_lite.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
curl -Lo public/models/pose_landmarker_full.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task
mkdir -p public/mediapipe-wasm && cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe-wasm/
```
- [ ] **Step 2:** `lib/mediapipe.ts`: `FilesetResolver.forVisionTasks("/mediapipe-wasm")`, `modelAssetPath: "/models/pose_landmarker_<variant>.task"`; scan path uses `lite`, live practice `full`.
- [ ] **Step 3:** `public/sw.js`: install-time precache `["/", "/manifest.json", "/models/pose_landmarker_lite.task", "/models/pose_landmarker_full.task"]` + all `/mediapipe-wasm/` files; cache-first for those, network-first for everything else; version-keyed cache name for busting. Registrar client component in `app/layout.tsx`.
- [ ] **Step 4:** Icons: `node scripts/generate-icons.mjs` (sharp: render `trace_logo.svg` on `#080808` at 192/512/180); update `manifest.json` icons array; add `<link rel="apple-touch-icon">`.
- [ ] **Step 5:** `InstallPrompt.tsx`: `beforeinstallprompt` capture (Android/desktop) + iOS Safari detection with "Share → Add to Home Screen" walkthrough; show once, dismissible, `localStorage` flag.
- [ ] **Step 6:** Manual: Lighthouse PWA installable check; `npm run build`.
- [ ] **Step 7: Commit** — `feat: self-hosted pose models, service worker, installable PWA`

---

### Task 10: Dependency + repo cleanup

**Files:**
- Modify: `package.json`; Delete: junk `public/` assets; audit `app/api/videos/route.ts`, `app/api/signed-url/route.ts`

- [ ] **Step 1:** `npm rm @supabase/auth-helpers-nextjs` after `grep -rn "auth-helpers" app lib components context middleware.ts` and migrating any hit to `@supabase/ssr` equivalents.
- [ ] **Step 2:** `git rm` the eight `ChatGPT Image*.svg` files + `public/test-video.MOV`; grep for references first; fix any.
- [ ] **Step 3:** If `dance-videos` bucket paths are unreachable from UI (grep for `/api/signed-url` and `/api/videos` callers), delete the dead branches.
- [ ] **Step 4:** `npm run build && npm test` — green. **Step 5: Commit** — `chore: remove deprecated deps and junk assets`

---

### Task 11: Mobile polish + UI bug sweep

**Files:** touched as found; expected: `app/globals.css`, practice components, `TabNavigation.tsx`

- [ ] **Step 1:** Safe-area: `viewport-fit=cover` in layout viewport export + `env(safe-area-inset-*)` padding on fixed practice chrome; audit touch targets < 44px in practice flow.
- [ ] **Step 2:** Systematic pass (mobile viewport in devtools, then real iPhone Safari): landing → signup → login → dashboard → import → calibrate → practice (Trace/Sync/Test tabs) → results. Log every bug found in `docs/superpowers/plans/2026-07-10-bug-sweep-log.md` (file, symptom, fix commit).
- [ ] **Step 3:** Fix in priority order: broken function > broken layout > polish. Commit per logical group.
- [ ] **Step 4:** Success-criteria walkthrough from spec (all 6) on device; record results in the bug-sweep log.
- [ ] **Step 5: Commit** — `fix: mobile safe areas + UI bug sweep`

---

## Self-Review

**Spec coverage:** Pillar 1 → Tasks 3/4/5/8; Pillar 2 → Task 6; Pillar 3 → Tasks 2/7; Pillar 4 → Tasks 9/10/11; bug sweep → Task 11; error-handling paths land in Tasks 4 (IDB fallback), 5 (best-effort puts), 6 (reacquire/lowConfidence), 2 (no-BPM grid). Data model changes → Task 5. ✓
**Placeholders:** none — every step names exact files, commands, thresholds, and signatures. Integration steps reference existing anchors (`TraceTab.tsx:283`, `overlayRenderer.ts:1`). ✓
**Type consistency:** `TimelineEntry`/`ChoreoTimeline` (T2) consumed by T5/T6/T7/T8 under the same names; `identityKey` string used as `videoStore` key and `scan_cache.video_identity`. `preScanVideo` return change (T6) is consumed by T7/T8. ✓
