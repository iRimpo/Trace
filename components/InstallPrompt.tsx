"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";

const DISMISSED_KEY = "trace_install_prompt_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * One-time "install Trace" nudge for Android and desktop, via the native
 * `beforeinstallprompt` event.
 *
 * iOS is deliberately not handled here. It has no native prompt, and the
 * Share → Add to Home Screen walkthrough now lives in `InstallGate` on the
 * practice route, where the user has an actual reason to want the app
 * installed. Two nudges for the same thing was one too many.
 */
export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, [installEvent]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-2xl border border-white/10 bg-[#080808] p-4 shadow-2xl"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Install Trace</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Get the fullscreen app experience — no browser bars during practice.
              </p>
              <button
                onClick={install}
                className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
              >
                Install
              </button>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-white/30 hover:text-white/70">
              <FaTimes className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
