"use client";

import { useEffect } from "react";

/**
 * Registers the precaching service worker (models, WASM, app shell).
 *
 * Development is deliberately excluded. `sw.js` treats `/_next/static/` as
 * cache-first, which is correct in production where Next.js content-hashes
 * every chunk filename — a new deploy simply requests new names. In dev those
 * names are stable (`main-app.js`), so the worker pins the first copy it ever
 * sees and keeps serving it after the code changes. The result is a page that
 * dies with "Cannot read properties of undefined (reading 'call')" inside
 * webpack's module factory and survives clearing .next, restarting the dev
 * server, and hard-reloading — because none of those touch the worker.
 *
 * Any worker registered by an earlier build is also torn down here, so a
 * machine that already has one recovers on the next load instead of needing
 * its caches cleared by hand.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .then(() => (typeof caches !== "undefined" ? caches.keys() : []))
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[Trace] Service worker registration failed:", e);
    });
  }, []);

  return null;
}
