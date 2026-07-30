"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";

// ── Cue palette ────────────────────────────────────────────────────────────
// Canonical definition lives in lib/cuePalette.ts — onboarding must show the
// same colours the practice overlay actually draws.
import { CUE_PALETTE, CUE_COLORS } from "@/lib/cuePalette";

/**
 * First-run onboarding.
 *
 * The illustrations are unchanged — they are the one place in the app where
 * motion is doing explanation rather than decoration, and they are seen exactly
 * once. The *chrome* around them was still the old app: hand-rolled pill
 * buttons, a "Skip" at 11px, six progress dots that were 6×6 tap targets, and a
 * next button whose fill came from an inline `style` so it changed colour every
 * step and never matched a button anywhere else in the product.
 *
 * Now the chrome is the design system — `Panel`, `Pressable`, real 44px targets
 * — so the last thing a new user sees before the dashboard looks like the
 * dashboard. The forward button is `ink`, the same neutral commit the signup
 * wizard uses, because green in this product means "start practising" and
 * nothing else; the step's accent survives in the progress dot, which is the
 * only thing it was ever really identifying.
 */

// ── Step visuals ───────────────────────────────────────────────────────────

function VisualSkeleton() {
  const joints = [
    { x: 50, y: 10, r: 9,   color: CUE_PALETTE.head, delay: 0.1 },
    { x: 32, y: 30, r: 4.5, color: CUE_PALETTE.shoulder, delay: 0.2 },
    { x: 68, y: 30, r: 4.5, color: CUE_PALETTE.shoulder, delay: 0.25 },
    { x: 18, y: 52, r: 4,   color: CUE_PALETTE.elbow, delay: 0.3 },
    { x: 82, y: 52, r: 4,   color: CUE_PALETTE.elbow, delay: 0.35 },
    { x: 6,  y: 70, r: 4,   color: CUE_PALETTE.hand, delay: 0.4 },
    { x: 94, y: 70, r: 4,   color: CUE_PALETTE.hand, delay: 0.45 },
    { x: 40, y: 70, r: 5,   color: CUE_PALETTE.hip, delay: 0.5 },
    { x: 60, y: 70, r: 5,   color: CUE_PALETTE.hip, delay: 0.55 },
    { x: 36, y: 88, r: 4,   color: CUE_PALETTE.foot, delay: 0.6 },
    { x: 64, y: 88, r: 4,   color: CUE_PALETTE.foot, delay: 0.65 },
  ];
  const bones: [number, number][] = [
    [0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[1,7],[2,8],[7,8],[7,9],[8,10],
  ];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      {bones.map(([a, b], i) => (
        <motion.line key={i}
          x1={joints[a].x} y1={joints[a].y} x2={joints[b].x} y2={joints[b].y}
          stroke="rgba(26,15,0,0.18)" strokeWidth="1.5" strokeLinecap="round"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: joints[a].delay, duration: 0.3 }}
        />
      ))}
      {joints.map((j, i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
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
    <div className="relative flex h-full items-center justify-center gap-6" aria-hidden="true">
      {/* Reference ghost */}
      <div className="relative opacity-30">
        <svg viewBox="0 0 60 100" className="h-28 w-16">
          <line x1="30" y1="8" x2="18" y2="30" stroke={CUE_PALETTE.hip} strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="8" x2="42" y2="30" stroke={CUE_PALETTE.hip} strokeWidth="2" strokeLinecap="round"/>
          <line x1="18" y1="30" x2="28" y2="65" stroke={CUE_PALETTE.hip} strokeWidth="2" strokeLinecap="round"/>
          <line x1="42" y1="30" x2="32" y2="65" stroke={CUE_PALETTE.hip} strokeWidth="2" strokeLinecap="round"/>
          <line x1="28" y1="65" x2="22" y2="92" stroke={CUE_PALETTE.foot} strokeWidth="2" strokeLinecap="round"/>
          <line x1="32" y1="65" x2="38" y2="92" stroke={CUE_PALETTE.foot} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="30" cy="8" r="6" fill={CUE_PALETTE.head}/>
          <circle cx="18" cy="30" r="3.5" fill={CUE_PALETTE.shoulder}/>
          <circle cx="42" cy="30" r="3.5" fill={CUE_PALETTE.shoulder}/>
          <circle cx="28" cy="65" r="3.5" fill={CUE_PALETTE.hip}/>
          <circle cx="32" cy="65" r="3.5" fill={CUE_PALETTE.hip}/>
        </svg>
        <p className="mt-1 text-center text-hud uppercase tracking-[0.18em] text-clay/60">Reference</p>
      </div>

      {/* Blend arrow */}
      <motion.div animate={{ x: [-3, 3, -3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
        <div className="h-px w-8 bg-gradient-to-r from-cue-hip to-cue-hand" />
      </motion.div>

      {/* User skeleton */}
      <div className="relative">
        <svg viewBox="0 0 60 100" className="h-28 w-16">
          <line x1="30" y1="8" x2="15" y2="28" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="8" x2="45" y2="28" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="15" y1="28" x2="26" y2="63" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="45" y1="28" x2="34" y2="63" stroke="rgba(26,15,0,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="26" y1="63" x2="20" y2="90" stroke={CUE_PALETTE.foot} strokeWidth="2" strokeLinecap="round"/>
          <line x1="34" y1="63" x2="40" y2="90" stroke={CUE_PALETTE.foot} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="30" cy="8" r="6" fill={CUE_PALETTE.head}/>
          <circle cx="15" cy="28" r="3.5" fill={CUE_PALETTE.shoulder}/>
          <circle cx="45" cy="28" r="3.5" fill={CUE_PALETTE.shoulder}/>
          <circle cx="26" cy="63" r="3.5" fill={CUE_PALETTE.hip}/>
          <circle cx="34" cy="63" r="3.5" fill={CUE_PALETTE.hip}/>
          <motion.g animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>
            <circle cx="8" cy="50" r="4" fill={CUE_PALETTE.hand} opacity={0.9}/>
            <circle cx="52" cy="50" r="4" fill={CUE_PALETTE.hand} opacity={0.9}/>
          </motion.g>
        </svg>
        <p className="mt-1 text-center text-hud uppercase tracking-[0.18em] text-clay/60">You</p>
      </div>
    </div>
  );
}

function VisualBeatCounts() {
  const [active, setActive] = useState(1);

  // This was written as `useState(() => …)`, whose initialiser runs once and
  // whose return value becomes *state*, not a cleanup — so the interval was
  // never cleared and the returned function was stored as the count. It only
  // appeared to work because the tutorial unmounts quickly.
  useEffect(() => {
    const id = setInterval(() => setActive(n => (n === 8 ? 1 : n + 1)), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4" aria-hidden="true">
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-cue-hip/40 bg-cue-hip/10"
        >
          <span className="text-5xl font-extrabold tabular-nums text-cue-hip">{active}</span>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-1.5">
        {[1,2,3,4,5,6,7,8].map(n => (
          <motion.div key={n}
            animate={{ scale: active === n ? 1.4 : 1, opacity: active === n ? 1 : 0.25 }}
            transition={{ duration: 0.15 }}
            className="h-2 w-2 rounded-full bg-cue-hip"
          />
        ))}
      </div>
    </div>
  );
}

function VisualFeedback() {
  const parts = [
    { color: CUE_PALETTE.hand, x: "15%", y: "45%" },
    { color: CUE_PALETTE.hand, x: "78%", y: "42%" },
    { color: CUE_PALETTE.foot, x: "30%", y: "88%" },
    { color: CUE_PALETTE.foot, x: "65%", y: "88%" },
    { color: CUE_PALETTE.hip, x: "48%", y: "60%" },
    { color: CUE_PALETTE.shoulder, x: "30%", y: "28%" },
    { color: CUE_PALETTE.shoulder, x: "65%", y: "28%" },
  ];
  return (
    <div className="relative h-full w-full" aria-hidden="true">
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
    <div className="flex h-full flex-col items-center justify-center gap-5">
      {/* Real buttons with real hit areas — the tutorial demonstrates a control,
          so the demonstration should not be the one control you cannot press. */}
      <div role="group" aria-label="Playback speed demo" className="flex items-center gap-0.5 rounded-2xl bg-ink/[0.06] p-1">
        {speeds.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSel(s)}
            aria-pressed={sel === s}
            className={`touch-target min-h-[32px] rounded-xl px-2 text-hud transition-ui duration-150 ${sel === s ? "bg-white text-ink shadow-card" : "text-ink/40"}`}
          >
            {s}×
          </button>
        ))}
      </div>
      <motion.div key={sel} initial={{ y: 6 }} animate={{ y: 0 }} transition={{ duration: 0.18 }} className="text-center">
        <p className="text-2xl font-extrabold tabular-nums text-ink">{sel}×</p>
        <p className="text-xs font-medium text-clay/70">
          {sel <= 0.5 ? "Great for learning new moves" : sel < 1 ? "Slower — build muscle memory" : sel === 1 ? "Normal speed" : "Challenge mode"}
        </p>
      </motion.div>
    </div>
  );
}

function VisualReady() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4" aria-hidden="true">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-duo-green/10">
        <svg className="h-10 w-10 text-duo-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div className="flex gap-2">
        {CUE_COLORS.map((c, i) => (
          <motion.div key={i} className="h-3 w-3 rounded-full" style={{ background: c }}
            animate={{ y: [0, -6, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Steps config ───────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Welcome to Trace",
    body: "Your personal AI dance coach. We'll overlay a reference dancer on your webcam so you can match every move, every beat.",
    visual: <VisualSkeleton />,
    accent: CUE_PALETTE.hip,
  },
  {
    title: "Mirror the reference",
    body: "The reference dancer appears as a ghost over your webcam feed. Match their pose, their timing, their energy.",
    visual: <VisualGhostMirror />,
    accent: CUE_PALETTE.shoulder,
  },
  {
    title: "Stay on the beat",
    body: "Beat counts (1–8) sync to the music so you always know exactly where you are in the choreography.",
    visual: <VisualBeatCounts />,
    accent: CUE_PALETTE.hip,
  },
  {
    title: "Colour-coded cues",
    body: "Each body part has its own colour. Glowing cues appear on the joints you need to move — no guessing.",
    visual: <VisualFeedback />,
    accent: CUE_PALETTE.hand,
  },
  {
    title: "Drill at any speed",
    body: "Slow down to 0.25× to learn tricky sections, then ramp up as you get comfortable.",
    visual: <VisualSpeed />,
    accent: CUE_PALETTE.foot,
  },
  {
    title: "You're ready",
    body: "Upload a dance video, run a quick camera setup, and start tracing. You can always re-watch this from Settings.",
    visual: <VisualReady />,
    accent: CUE_PALETTE.foot,
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

  // Escape leaves. A full-screen overlay with no keyboard exit is a trap.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && !isLast) setStep(s => s + 1);
      if (e.key === "ArrowLeft") setStep(s => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How Trace works"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 backdrop-blur-sm"
    >
      <motion.div
        // Modals stay centre-origin — there is no trigger to grow from.
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm"
      >
        <Panel tone="paper" radius="2xl" className="relative overflow-hidden border-2 border-duo-edge">
          {/* Skip — `touch-target` gives it 44px without a button-sized box in
              the corner of a 384px card. */}
          <button
            type="button"
            onClick={finish}
            className="touch-target absolute right-3 top-3 z-10 rounded-xl px-2 py-1 text-hud uppercase tracking-[0.18em] text-clay/60 transition-ui duration-150 hover:text-ink"
          >
            Skip
          </button>

          {/* Visual area */}
          <div className="relative h-52 w-full overflow-hidden bg-brand-cream">
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

          <div className="px-5 pb-5 pt-4">
            {/* Progress dots. Each was a 6×6 hit area; each is now a 44px
                target with a name, so the step list is navigable rather than
                decorative. */}
            <div className="mb-3 flex items-center justify-center gap-0.5">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.title}`}
                  aria-current={i === step ? "step" : undefined}
                  className="touch-target flex h-6 items-center justify-center px-1"
                >
                  {/* scaleX, not width: width is a layout property and relayouts
                      the whole dot row on every frame of the transition. */}
                  <motion.span
                    animate={{ scaleX: i === step ? 1 : 0.32 }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    style={{ background: i === step ? current.accent : undefined }}
                    className={`block h-1.5 w-[22px] rounded-full ${i === step ? "" : "bg-ink/15"}`}
                  />
                </button>
              ))}
            </div>

            {/* The heading is not inside the AnimatePresence swap on its own —
                title and body move together, so a stalled exit can never leave
                a card with a body and no title. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-extrabold tracking-tight text-ink">{current.title}</h2>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-clay/80">
                  {current.body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex items-center gap-2">
              {step > 0 && (
                <Pressable variant="quiet" size="md" ariaLabel="Previous step" onClick={() => setStep(s => s - 1)}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                </Pressable>
              )}
              {/*
                `ink`, not green. Green is the one "start practising" colour —
                "New session", "Practise again", "Start session". Advancing a
                wizard is a neutral commit, which is exactly what the signup
                wizard's "Continue" two screens earlier already is, and a user
                arriving here straight from signup should not meet the same
                control in a different colour.
              */}
              <Pressable
                variant="ink"
                size="md"
                block
                onClick={isLast ? finish : () => setStep(s => s + 1)}
              >
                {isLast ? "Let's go" : "Next"}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Pressable>
            </div>

            {dismissKey && (
              <button
                type="button"
                onClick={dismiss}
                className="touch-target mt-2 flex w-full items-center justify-center text-hud text-clay/60 transition-ui duration-150 hover:text-ink"
              >
                Don&apos;t show again
              </button>
            )}
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
