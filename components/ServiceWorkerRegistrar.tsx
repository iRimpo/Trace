"use client";

import { useEffect } from "react";

/** Registers the precaching service worker (models, WASM, app shell). */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[Trace] Service worker registration failed:", e);
    });
  }, []);
  return null;
}
