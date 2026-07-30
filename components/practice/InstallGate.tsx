"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Pressable from "@/components/ui/Pressable";

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
 *
 * **The screen-space argument is the smaller half of the case, and it was the
 * only one this screen made.** `navigator.storage.persist()` is effectively
 * denied in a normal iOS Safari tab, and iOS evicts IndexedDB after seven days
 * without a visit. Uploaded videos live in IndexedDB (`lib/videoStore.ts`).
 * Installed PWAs are exempt from the eviction. So installing is what keeps his
 * videos — see `docs/HANDOFF.md` §4 — and losing a reference clip a week before
 * an audition is a categorically different cost from a visible address bar.
 * The copy leads with that now.
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
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="fixed inset-0 z-[200] overflow-y-auto bg-stage px-6"
      style={{
        paddingTop:    "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />

        <h2 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight text-stage-text">
          Install Trace to keep your videos
        </h2>

        {/*
          Two reasons, storage first. The old copy only made the screen-space
          argument, which is the one the user can already see for himself.
        */}
        <ul className="mt-6 w-full space-y-3 text-left">
          <Reason
            icon="🎞️"
            title="Your uploads stay put"
            body="iOS wipes a website's stored data after 7 days without a visit, and your videos live in that storage. Apps on the Home Screen are exempt."
          />
          <Reason
            icon="📐"
            title="Full frame"
            body="Safari's address bar covers the bottom of the frame while you dance. Installing removes it."
          />
        </ul>

        <ol className="mt-6 w-full space-y-3 text-left">
          {[
            "Tap the Share button in Safari's toolbar",
            "Scroll down and tap Add to Home Screen",
            "Open Trace from your Home Screen",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-duo-blue text-hud font-extrabold text-white">
                {i + 1}
              </span>
              <span className="text-hud-lg font-bold leading-snug text-stage-text/85">{step}</span>
            </li>
          ))}
        </ol>

        {/* Session-scoped escape hatch — de-emphasised, but a real 44px target
            rather than a 12px underlined link. */}
        <Pressable
          variant="stage"
          size="md"
          className="mt-8"
          onClick={() => { sessionStorage.setItem(SESSION_KEY, "1"); setShow(false); }}
        >
          Continue in browser
        </Pressable>
      </div>
    </motion.div>
  );
}

function Reason({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <span className="text-xl leading-none">{icon}</span>
      <span className="min-w-0">
        <span className="block text-hud-lg font-extrabold text-stage-text">{title}</span>
        <span className="mt-1 block text-hud font-medium leading-relaxed text-stage-text/70">{body}</span>
      </span>
    </li>
  );
}
