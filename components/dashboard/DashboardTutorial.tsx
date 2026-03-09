"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Cue palette ────────────────────────────────────────────────────────────
const CUE_COLORS = ["#00D4FF", "#34D399", "#FBBF24", "#F97316", "#A78BFA", "#60A5FA", "#F472B6"];

// ── Step visuals ───────────────────────────────────────────────────────────

function VisualSkeleton() {
  const joints = [
    { x: 50, y: 10, r: 9,   color: "#FBBF24", delay: 0.1 },
    { x: 32, y: 30, r: 4.5, color: "#60A5FA", delay: 0.2 },
    { x: 68, y: 30, r: 4.5, color: "#60A5FA", delay: 0.25 },
    { x: 18, y: 52, r: 4,   color: "#F97316", delay: 0.3 },
    { x: 82, y: 52, r: 4,   color: "#F97316", delay: 0.35 },
    { x: 6,  y: 70, r: 4,   color: "#00D4FF", delay: 0.4 },
    { x: 94, y: 70, r: 4,   color: "#00D4FF", delay: 0.45 },
    { x: 40, y: 70, r: 5,   color: "#A78BFA", delay: 0.5 },
    { x: 60, y: 70, r: 5,   color: "#A78BFA", delay: 0.55 },
    { x: 36, y: 88, r: 4,   color: "#34D399", delay: 0.6 },
    { x: 64, y: 88, r: 4,   color: "#34D399", delay: 0.65 },
  ];
  const bones: [number, number][] = [
    [0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[1,7],[2,8],[7,8],[7,9],[8,10],
  ];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {bones.map(([a, b], i) => (
        <motion.line key={i}
          x1={joints[a].x} y1={joints[a].y} x2={joints[b].x} y2={joints[b].y}
          stroke="rgba(26,15,0,0.18)" strokeWidth="1.5" strokeLinecap="round"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: joints[a].delay, duration: 0.3 }}
        />
      ))}
      {joints.map((j, i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: j.delay, duration: 0.3, type: "spring", stiffness: 260, damping: 18 }}
          style={{ transformOrigin: `${j.x}px ${j.y}px` }}
        >
          <circle cx={j.x} cy={j.y} r={j.r + 5} fill={j.color} opacity={0.2} />
          <circle cx={j.x} cy={j.y} r={j.r} fill={j.color} opacity={0.95} />
        </motion.g>
      ))}
    </svg>
  );
}

function VisualGhostMirror() {
  return (
    <div className="relative flex items-center justify-center gap-6 h-full">
      {/* Reference ghost */}
      <div className="relative opacity-30">
        <svg viewBox="0 0 60 100" className="h-28 w-16">
          <line x1="30" y1="8" x2="18" y2="30" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="8" x2="42" y2="30" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="18" y1="30" x2="28" y2="65" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="42" y1="30" x2="32" y2="65" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="28" y1="65" x2="22" y2="92" stroke="#34D399" strokeWidth="2" strokeLinecap="round"/>
          <line x1="32" y1="65" x2="38" y2="92" stroke="#34D399" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="30" cy="8" r="6" fill="#FBBF24"/>
          <circle cx="18" cy="30" r="3.5" fill="#60A5FA"/>
          <circle cx="42" cy="30" r="3.5" fill="#60A5FA"/>
          <circle cx="28" cy="65" r="3.5" fill="#A78BFA"/>
          <circle cx="32" cy="65" r="3.5" fill="#A78BFA"/>
        </svg>
        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-[#1a0f00]/30 mt-1">Reference</p>
      </div>

      {/* Blend arrow */}
      <motion.div animate={{ x: [-3, 3, -3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
        <div className="h-px w-8 bg-gradient-to-r from-[#A78BFA] to-[#00D4FF]" />
      </motion.div>

      {/* User skeleton */}
      <div className="relative">
        <svg viewBox="0 0 60 100" className="h-28 w-16">
          <line x1="30" y1="8" x2="15" y2="28" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="8" x2="45" y2="28" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="15" y1="28" x2="26" y2="63" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="45" y1="28" x2="34" y2="63" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="26" y1="63" x2="20" y2="90" stroke="#34D399" strokeWidth="2" strokeLinecap="round"/>
          <line x1="34" y1="63" x2="40" y2="90" stroke="#34D399" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="30" cy="8" r="6" fill="#FBBF24"/>
          <circle cx="15" cy="28" r="3.5" fill="#60A5FA"/>
          <circle cx="45" cy="28" r="3.5" fill="#60A5FA"/>
          <circle cx="26" cy="63" r="3.5" fill="#A78BFA"/>
          <circle cx="34" cy="63" r="3.5" fill="#A78BFA"/>
          {/* cue arrows on wrists */}
          <motion.g animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>
            <circle cx="8" cy="50" r="4" fill="#00D4FF" opacity={0.9}/>
            <circle cx="52" cy="50" r="4" fill="#00D4FF" opacity={0.9}/>
          </motion.g>
        </svg>
        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-[#1a0f00]/30 mt-1">You</p>
      </div>
    </div>
  );
}

function VisualBeatCounts() {
  const [active, setActive] = useState(1);
  // Cycle counts automatically
  useState(() => {
    const id = setInterval(() => setActive(n => n === 8 ? 1 : n + 1), 500);
    return () => clearInterval(id);
  });
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#A78BFA]/40 bg-[#A78BFA]/10"
        >
          <span className="font-calistoga text-5xl font-bold text-[#A78BFA]">{active}</span>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-1.5">
        {[1,2,3,4,5,6,7,8].map(n => (
          <motion.div key={n}
            animate={{ scale: active === n ? 1.4 : 1, opacity: active === n ? 1 : 0.25 }}
            transition={{ duration: 0.15 }}
            className="h-2 w-2 rounded-full bg-[#A78BFA]"
          />
        ))}
      </div>
    </div>
  );
}

function VisualFeedback() {
  const parts = [
    { label: "Hands",     color: "#00D4FF", x: "15%", y: "45%" },
    { label: "Hands",     color: "#00D4FF", x: "78%", y: "42%" },
    { label: "Feet",      color: "#34D399", x: "30%", y: "88%" },
    { label: "Feet",      color: "#34D399", x: "65%", y: "88%" },
    { label: "Hips",      color: "#A78BFA", x: "48%", y: "60%" },
    { label: "Shoulders", color: "#60A5FA", x: "30%", y: "28%" },
    { label: "Shoulders", color: "#60A5FA", x: "65%", y: "28%" },
  ];
  return (
    <div className="relative h-full w-full">
      {/* Stick figure base */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
        <line x1="50" y1="12" x2="30" y2="30" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="50" y1="12" x2="70" y2="30" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="30" y1="30" x2="22" y2="55" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="70" y1="30" x2="78" y2="55" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="50" y1="30" x2="45" y2="62" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="50" y1="30" x2="55" y2="62" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="45" y1="62" x2="38" y2="88" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <line x1="55" y1="62" x2="63" y2="88" stroke="rgba(26,15,0,0.1)" strokeWidth="2"/>
        <circle cx="50" cy="8" r="5" fill="rgba(26,15,0,0.12)"/>
      </svg>
      {parts.map((p, i) => (
        <motion.div key={i}
          className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ left: p.x, top: p.y, background: p.color, boxShadow: `0 0 10px ${p.color}` }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function VisualSpeed() {
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5];
  const [sel, setSel] = useState(0.5);
  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full">
      <div className="flex items-center gap-1 rounded-xl bg-[#1a0f00]/06 p-1">
        {speeds.map(s => (
          <button key={s} onClick={() => setSel(s)}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-bold transition-all ${sel === s ? "bg-white text-[#1a0f00] shadow" : "text-[#1a0f00]/30"}`}
          >{s}x</button>
        ))}
      </div>
      <motion.div
        key={sel}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-2xl font-bold text-[#1a0f00]">{sel}×</p>
        <p className="text-xs text-[#1a0f00]/40">
          {sel <= 0.5 ? "Great for learning new moves" : sel < 1 ? "Slower — build muscle memory" : sel === 1 ? "Normal speed" : "Challenge mode"}
        </p>
      </motion.div>
    </div>
  );
}

// ── Steps config ───────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Welcome to Trace",
    body: "Your personal AI dance coach. We'll overlay a reference dancer on your webcam so you can match every move, every beat.",
    visual: <VisualSkeleton />,
    accent: "#A78BFA",
  },
  {
    title: "Mirror the Reference",
    body: "The reference dancer appears as a ghost over your webcam feed. Match their pose, their timing, their energy.",
    visual: <VisualGhostMirror />,
    accent: "#60A5FA",
  },
  {
    title: "Stay on the Beat",
    body: "Beat counts (1–8) sync to the music so you always know exactly where you are in the choreography.",
    visual: <VisualBeatCounts />,
    accent: "#A78BFA",
  },
  {
    title: "Color-Coded Cues",
    body: "Each body part has its own color. Glowing cues appear on the joints you need to move — no guessing.",
    visual: <VisualFeedback />,
    accent: "#00D4FF",
  },
  {
    title: "Drill at Any Speed",
    body: "Slow down to 0.25× to learn tricky sections, then ramp up as you get comfortable.",
    visual: <VisualSpeed />,
    accent: "#34D399",
  },
  {
    title: "You're Ready!",
    body: "Upload a dance video, go through a quick camera setup, and start tracing. You can always re-watch this from Settings.",
    visual: (
      <div className="flex flex-col items-center justify-center gap-4 h-full">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100"
        >
          <svg className="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </motion.div>
        <div className="flex gap-2">
          {CUE_COLORS.map((c, i) => (
            <motion.div key={i} className="h-3 w-3 rounded-full" style={{ background: c }}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
      </div>
    ),
    accent: "#34D399",
  },
];

// ── Component ──────────────────────────────────────────────────────────────

interface DashboardTutorialProps {
  onDone: () => void;
  /**
   * When provided the tutorial shows every time (great for practice sessions).
   * Only setting this key via "Don't show again" prevents future appearances.
   * When omitted the built-in key is set on any finish/skip (one-time onboarding).
   */
  dismissKey?: string;
}

export default function DashboardTutorial({ onDone, dismissKey }: DashboardTutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    if (!dismissKey) localStorage.setItem("trace_onboarding_v1_done", "1");
    onDone();
  }

  function dismiss() {
    const key = dismissKey ?? "trace_onboarding_v1_done";
    localStorage.setItem(key, "1");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#1a0f00]/08 bg-white shadow-2xl"
      >
        {/* Skip */}
        <button
          onClick={finish}
          className="absolute right-4 top-4 z-10 text-[11px] font-semibold text-[#1a0f00]/30 hover:text-[#1a0f00]/60 transition-colors"
        >
          Skip
        </button>

        {/* Visual area */}
        <div className="relative h-52 w-full overflow-hidden bg-[#f8f4e0]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className="absolute inset-0 p-6"
            >
              {current.visual}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-5">
          {/* Progress dots */}
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}>
                <motion.div
                  animate={{
                    width: i === step ? 20 : 6,
                    background: i === step ? current.accent : "rgba(26,15,0,0.12)",
                  }}
                  transition={{ duration: 0.2 }}
                  className="h-1.5 rounded-full"
                />
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-calistoga text-xl text-[#1a0f00]">{current.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5c3d1a]/55">{current.body}</p>
            </motion.div>
          </AnimatePresence>

          {/* Buttons */}
          <div className="mt-5 flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-none rounded-xl border border-[#1a0f00]/10 px-4 py-2.5 text-sm font-semibold text-[#1a0f00]/40 transition-all hover:text-[#1a0f00]/70"
              >
                ←
              </button>
            )}
            <button
              onClick={isLast ? finish : () => setStep(s => s + 1)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: current.accent }}
            >
              {isLast ? "Let's go →" : "Next →"}
            </button>
          </div>
          {dismissKey && (
            <button
              onClick={dismiss}
              className="mt-3 w-full text-center text-[11px] text-[#1a0f00]/30 hover:text-[#1a0f00]/55 transition-colors"
            >
              Don&apos;t show again
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
