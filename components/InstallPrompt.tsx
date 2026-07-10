"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";

const DISMISSED_KEY = "trace_install_prompt_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * One-time "install Trace" nudge. Android/desktop get the native prompt via
 * beforeinstallprompt; iOS Safari (no native API) gets a Share → Add to Home
 * Screen walkthrough. Installed = fullscreen practice, no browser chrome.
 */
export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    if (isIosSafari()) {
      setIos(true);
      // Give the user a moment in the app before nudging
      const t = setTimeout(() => setVisible(true), 12000);
      return () => clearTimeout(t);
    }

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
              {ios ? (
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  Practice fullscreen without Safari in the way: tap the{" "}
                  <span className="font-semibold text-white/90">Share</span> button, then{" "}
                  <span className="font-semibold text-white/90">Add to Home Screen</span>.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  Get the fullscreen app experience — no browser bars during practice.
                </p>
              )}
              {!ios && (
                <button
                  onClick={install}
                  className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
                >
                  Install
                </button>
              )}
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
