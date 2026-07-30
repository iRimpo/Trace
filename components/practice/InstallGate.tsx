"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const SESSION_KEY = "trace_install_gate_bypassed";
const LEGACY_KEY  = "trace_install_prompt_dismissed";

function isIos(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Full-screen Add-to-Home-Screen walkthrough on the practice route.
 *
 * iPhone Safari has no Fullscreen API, so `requestFullscreen` is dead code
 * there and installing is the only way to practise without the address bar
 * eating the bottom of the frame. The previous nudge was a 12-second toast
 * that wrote a permanent localStorage dismissal, so a single tap silenced it
 * forever. This one is bypassable but session-scoped.
 */
export default function InstallGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // The old permanent flag would otherwise keep suppressing the nudge for
    // anyone who dismissed it once.
    localStorage.removeItem(LEGACY_KEY);
    if (!isIos() || isStandalone() || sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080808] px-6 text-center"
      style={{
        paddingTop:    "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
      <h2 className="mt-5 text-lg font-bold text-white">Add Trace to your Home Screen</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/55">
        Safari&apos;s address bar covers the bottom of the frame while you dance.
        Installing removes it — same app, full screen.
      </p>

      <ol className="mt-7 w-full max-w-xs space-y-3 text-left">
        {[
          "Tap the Share button in Safari's toolbar",
          "Scroll down and tap Add to Home Screen",
          "Open Trace from your Home Screen",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black">
              {i + 1}
            </span>
            <span className="text-sm leading-snug text-white/80">{step}</span>
          </li>
        ))}
      </ol>

      <button
        onClick={() => { sessionStorage.setItem(SESSION_KEY, "1"); setShow(false); }}
        className="mt-8 text-xs font-semibold text-white/35 underline underline-offset-4"
      >
        Continue in browser
      </button>
    </motion.div>
  );
}
