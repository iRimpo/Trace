"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import IconButton from "@/components/ui/IconButton";

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
    /*
      A dark solid surface rather than the hand-rolled `bg-brand-primary` card
      it was: this toast is mounted in the root layout, so it lands on cream
      pages *and* on the practice stage, and `stage-solid` is the one tone that
      holds its own contrast on both. Type floor is `text-hud` throughout — the
      body copy and the Install button were both 12px-and-under paper sizes on
      a surface that can appear over a camera feed.
    */
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <Panel tone="stage-solid" radius="2xl" className="p-4">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-hud-lg font-extrabold text-stage-text">Install Trace</p>
                <p className="mt-1 text-hud font-medium leading-relaxed text-stage-text/70">
                  Full screen while you practise, and your uploaded videos stop
                  depending on the browser keeping them.
                </p>
                <Pressable variant="primary" size="sm" className="mt-3" onClick={install}>
                  Install
                </Pressable>
              </div>
              <IconButton
                tone="stage-solid"
                visual="sm"
                aria-label="Dismiss install prompt"
                onClick={dismiss}
              >
                <FaTimes className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </Panel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
