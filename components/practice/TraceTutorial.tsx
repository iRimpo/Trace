"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  return (
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
            transition={{ duration: 0.2 }}
            className="pointer-events-auto relative w-[min(380px,90vw)] rounded-2xl border border-black/10 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur-xl"
          >
            {/* Skip */}
            <button
              onClick={finish}
              className="absolute right-3 top-3 text-[10px] font-semibold text-[#1a0f00]/30 hover:text-[#1a0f00]/60"
            >
              Skip
            </button>

            {/* Content */}
            <div className="mb-3 flex items-start gap-3">
              <span className="text-2xl">{current.emoji}</span>
              <div>
                <h3 className="text-sm font-bold text-[#1a0f00]">{current.title}</h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[#1a0f00]/60">{current.body}</p>
              </div>
            </div>

            {/* Progress dots */}
            <div className="mb-3 flex items-center justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-4 bg-[#1a0f00]" : "w-1.5 bg-[#1a0f00]/20"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={back}
                disabled={step === 0}
                className="flex-1 rounded-lg border border-[#1a0f00]/12 py-1.5 text-[11px] font-semibold text-[#1a0f00]/40 transition-all hover:text-[#1a0f00]/70 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ← Back
              </button>
              <button
                onClick={next}
                className="flex-1 rounded-lg bg-[#080808] py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-[#1a1a1a]"
              >
                {step === STEPS.length - 1 ? "Finish 🎉" : "Next →"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
