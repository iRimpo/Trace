"use client";

import { useEffect, useRef } from "react";

/**
 * Hold a screen wake lock for as long as the component is mounted.
 *
 * Practice means propping the phone up and dancing several feet away, so the
 * screen sleeping mid-song makes the app unusable. The browser drops the lock
 * whenever the page is hidden (tab switch, app background, screen off), so it
 * has to be re-acquired on visibilitychange rather than requested once.
 *
 * No-ops where the API is unavailable — notably any non-secure context, which
 * includes viewing a dev server over a LAN IP.
 */
export function useWakeLock(enabled = true): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (sentinelRef.current !== null) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        // Fires on OS-initiated release too, so clear the ref either way.
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Rejected (low battery, permissions policy, unsupported) — practice
        // still works, the screen just isn't held awake.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [enabled]);
}
