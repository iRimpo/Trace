/**
 * Trace service worker.
 * Precaches the heavy on-device AI assets (pose models + WASM runtime) and
 * the app shell so practice starts instantly and works offline once loaded.
 * Bump CACHE_VERSION when precached assets change.
 */
// Bumped to v2: the activate handler deletes every cache whose key doesn't
// match, so raising this is how already-installed clients (including phones
// with the PWA on their home screen) drop a stale app shell and pick up the
// current build. Anyone still on v1 could be running app code from an earlier
// deploy regardless of what has shipped since.
const CACHE_VERSION = "trace-v2";

const PRECACHE = [
  "/",
  "/manifest.json",
  "/trace_logo.svg",
  "/models/pose_landmarker_lite.task",
  "/models/pose_landmarker_full.task",
  "/mediapipe-wasm/vision_wasm_internal.js",
  "/mediapipe-wasm/vision_wasm_internal.wasm",
  "/mediapipe-wasm/vision_wasm_nosimd_internal.js",
  "/mediapipe-wasm/vision_wasm_nosimd_internal.wasm",
];

// Heavy immutable assets: cache-first (never re-download a 9MB model)
const CACHE_FIRST_PREFIXES = ["/models/", "/mediapipe-wasm/", "/icons/", "/_next/static/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  const cacheFirst = CACHE_FIRST_PREFIXES.some((p) => url.pathname.startsWith(p));

  if (cacheFirst) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) => hit ?? fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Everything else: network-first with cache fallback (offline app shell)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && url.pathname === "/") {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("/"))),
  );
});
