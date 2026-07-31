"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";

// ── Tutorial steps ──────────────────────────────────────────────────

const STEPS = [
  {
    id: "welcome",
    emoji: "🕺",
    title: "Welcome to TRACE!",
    body: "Practice with a reference dancer as an overlay or side-by-side with your webcam.",
    targetId: undefined as string | undefined,
  },
  {
    id: "loop",
    emoji: "🔄",
    title: "Loop a Section",
    body: "Drag the A and B handles on the timeline to set a loop section. Then toggle Loop ON to repeat just that part — great for drilling hard moves.",
    targetId: "trace-timeline" as string | undefined,
  },
  {
    id: "feedback",
    emoji: "💡",
    title: "Real-Time Feedback",
    body: "Enable Feedback to see live movement cues overlaid on the video — shapes and arrows appear on each body part showing you which direction to move to match the reference dancer.",
    targetId: "trace-feedback-pill" as string | undefined,
  },
  {
    id: "counts",
    emoji: "🎵",
    title: "Beat Counts & Rhythm",
    body: "Counts show which beat of the 8-count you're on. If they look wrong, pause the video on a beat you recognize, then tap Adjust to re-label it.",
    targetId: "trace-bpm-count" as string | undefined,
  },
  {
    id: "controls",
    emoji: "⚙️",
    title: "Speed & Opacity",
    body: "Slow to 0.5× to learn tricky moves. The Opacity slider controls how strongly the reference ghost appears over your webcam.",
    targetId: "trace-controls-row" as string | undefined,
  },
  {
    id: "ready",
    emoji: "🎉",
    title: "You're All Set!",
    body: "When you feel ready, click the checkmark to switch to Test mode and record yourself. Tap the 📚 button anytime to see this guide again.",
    targetId: undefined as string | undefined,
  },
];

// ── Spotlight ───────────────────────────────────────────────────────

function Spotlight({ targetId, padding = 10 }: { targetId?: string; padding?: number }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetId) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.getElementById(targetId);
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [targetId]);

  return rect ? (
    <div
      className="pointer-events-none fixed z-[90] rounded-2xl"
      style={{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
      }}
    />
  ) : (
    <div className="pointer-events-none fixed inset-0 z-[90] bg-black/75" />
  );
}

// ── Component ───────────────────────────────────────────────────────

export default function TraceTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  function finish() {
    localStorage.setItem("trace_tutorial_v1_done", "1");
    onClose();
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(s => s - 1);
  }

  const isLast = step === STEPS.length - 1;

  return (
    /*
      Ground: the stage — see `docs/DESIGN_SYSTEM.md` §1. This card was white
      glass with 10–12px ink copy, floating over the same camera feed the rest
      of the practice chrome sits on. White glass over video in a bright room
      is the brightest thing on screen, and it was pointing at controls the
      user could no longer see past it.
    */
    <>
      <Spotlight targetId={current.targetId} />

      {/* Card — fixed center of screen */}
      <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-auto w-[min(400px,92vw)]"
          >
            <Panel tone="stage" radius="2xl" className="relative px-5 pb-4 pt-5">
              {/* Skip. A text link at 10px was a decoration, not a control. */}
              <Pressable
                variant="stage"
                size="sm"
                className="absolute right-3 top-3"
                onClick={finish}
              >
                Skip
              </Pressable>

              {/* Content */}
              <div className="mb-4 flex items-start gap-3 pr-16">
                <span className="text-3xl leading-none">{current.emoji}</span>
                <div className="min-w-0">
                  <h3 className="text-hud-lg font-extrabold tracking-tight text-stage-text">{current.title}</h3>
                  <p className="mt-1.5 text-hud font-medium leading-relaxed text-stage-text/75">{current.body}</p>
                </div>
              </div>

              {/*
                Where-am-I, at a size that survives the room. The current step
                is a wide filled bar rather than a 1.5px dot with a 20%-tint
                sibling — a fill/no-fill difference is the one that reads at
                distance (same reasoning as TogglePill).
              */}
              <div
                className="mb-3 flex items-center justify-center gap-1.5"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={STEPS.length}
                aria-valuenow={step + 1}
                aria-label={`Step ${step + 1} of ${STEPS.length}`}
              >
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out-strong motion-reduce:transition-none ${
                      i === step ? "w-6 bg-duo-blue" : "w-1.5 bg-white/20"
                    }`}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <Pressable variant="stage" size="md" onClick={back} disabled={step === 0} className="flex-1">
                  Back
                </Pressable>
                {/* The one green "go" on this surface is the one that ends it. */}
                <Pressable variant={isLast ? "primary" : "secondary"} size="md" onClick={next} className="flex-1">
                  {isLast ? "Finish" : "Next"}
                </Pressable>
              </div>
            </Panel>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
