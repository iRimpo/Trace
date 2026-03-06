"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// ── Cue colors ────────────────────────────────────────────────────────
const CUE = [
  { label: "Hands",     color: "#00D4FF" },
  { label: "Feet",      color: "#34D399" },
  { label: "Head",      color: "#FBBF24" },
  { label: "Elbows",    color: "#F97316" },
  { label: "Hips",      color: "#A78BFA" },
  { label: "Shoulders", color: "#60A5FA" },
  { label: "Arms",      color: "#F472B6" },
];

// ── Skeleton data ─────────────────────────────────────────────────────
const JOINTS = [
  { x: 110, y: 28,  r: 18, label: "head",     color: "#FBBF24" },
  { x: 78,  y: 88,  r: 6,  label: "lShoulder", color: "#60A5FA" },
  { x: 142, y: 88,  r: 6,  label: "rShoulder", color: "#60A5FA" },
  { x: 52,  y: 148, r: 5,  label: "lElbow",    color: "#F97316" },
  { x: 168, y: 148, r: 5,  label: "rElbow",    color: "#F97316" },
  { x: 30,  y: 200, r: 5,  label: "lHand",     color: "#00D4FF" },
  { x: 190, y: 200, r: 5,  label: "rHand",     color: "#00D4FF" },
  { x: 90,  y: 200, r: 6,  label: "lHip",      color: "#A78BFA" },
  { x: 130, y: 200, r: 6,  label: "rHip",      color: "#A78BFA" },
  { x: 80,  y: 275, r: 5,  label: "lKnee",     color: "#34D399" },
  { x: 140, y: 275, r: 5,  label: "rKnee",     color: "#34D399" },
  { x: 70,  y: 345, r: 5,  label: "lFoot",     color: "#34D399" },
  { x: 150, y: 345, r: 5,  label: "rFoot",     color: "#34D399" },
];

const BONES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6],
  [1, 7], [2, 8], [7, 8], [7, 9], [8, 10], [9, 11], [10, 12],
];

// ── Skeleton SVG ──────────────────────────────────────────────────────
function DancerSvg({ progress, dimmed }: { progress: number; dimmed?: boolean }) {
  return (
    <svg width="200" height="360" viewBox="0 0 220 380" fill="none">
      {BONES.map(([a, b], i) => {
        const ja = JOINTS[a], jb = JOINTS[b];
        const bp = dimmed ? 0 : Math.min(1, Math.max(0, (progress - i * 0.04) * 3));
        return (
          <line key={i}
            x1={ja.x} y1={ja.y} x2={jb.x} y2={jb.y}
            stroke={`rgba(26,15,0,${dimmed ? 0.08 : 0.08 + bp * 0.18})`}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      {JOINTS.map((j, i) => {
        const jp = dimmed ? 0 : Math.min(1, Math.max(0, (progress - i * 0.04) * 3));
        const isHead = j.label === "head";
        return (
          <g key={i}>
            {jp > 0.15 && (
              <circle cx={j.x} cy={j.y} r={(j.r + 10) * jp}
                fill={j.color} opacity={0.18 * jp}
              />
            )}
            <circle cx={j.x} cy={j.y} r={j.r}
              fill={dimmed ? "rgba(26,15,0,0.12)" : jp > 0.4 ? j.color : "rgba(26,15,0,0.12)"}
              opacity={dimmed ? 1 : 0.25 + jp * 0.75}
            />
            {isHead && (
              <circle cx={j.x} cy={j.y} r={j.r - 7}
                fill={dimmed ? "rgba(26,15,0,0.05)" : jp > 0.4 ? j.color : "rgba(26,15,0,0.05)"}
                opacity={0.4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Floating orb ──────────────────────────────────────────────────────
function Orb({ color, size, x, y, delay }: { color: string; size: number; x: string; y: string; delay: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, backgroundColor: color, filter: "blur(60px)", opacity: 0.12 }}
      animate={{ y: [0, -18, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

// ── Hero ──────────────────────────────────────────────────────────────
export default function Hero() {
  const [skelProgress, setSkelProgress] = useState(0);

  // Animate skeleton joints on mount
  useEffect(() => {
    const start = Date.now();
    const duration = 1600;
    let raf: number;
    const begin = setTimeout(() => {
      function tick() {
        const p = Math.min((Date.now() - start) / duration, 1);
        setSkelProgress(p);
        if (p < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, 500);
    return () => { clearTimeout(begin); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#f8f4e0] flex items-center">

      {/* Background orbs */}
      <Orb color="#A78BFA" size={340} x="65%"  y="10%"  delay={0}   />
      <Orb color="#00D4FF" size={260} x="72%"  y="50%"  delay={1.2} />
      <Orb color="#34D399" size={200} x="55%"  y="70%"  delay={2.1} />
      <Orb color="#FBBF24" size={180} x="5%"   y="60%"  delay={1.7} />

      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(26,15,0,0.04) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-20 sm:gap-16 sm:px-6 sm:py-24 lg:flex-row lg:items-center lg:gap-12 lg:px-10">

        {/* ── Left: Text ───────────────────────────────────────── */}
        <div className="flex-1">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mb-5 flex items-center gap-2"
          >
            <motion.div
              className="h-2 w-2 rounded-full bg-[#34D399]"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c3d1a]/45">
              AI-Powered Dance Analysis
            </span>
          </motion.div>

          {/* Headline — staggered words */}
          <h1 className="font-calistoga text-[clamp(2.2rem,5.5vw,5rem)] leading-[1.06] tracking-tight text-[#1a0f00]">
            {["Dance", "smarter.", "Move", "without", "limits."].map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.15 + i * 0.09, ease: [0.075, 0.82, 0.165, 1] as [number,number,number,number] }}
                className="inline-block mr-[0.22em]"
              >
                {word}
              </motion.span>
            ))}
          </h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.65 }}
            className="mt-5 max-w-sm text-base leading-relaxed text-[#5c3d1a]/55"
          >
            Trace maps every joint, syncs every beat, and shows you exactly when and where to move — in real time.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.82 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href="#waitlist"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#080808] px-7 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#1a1a1a] active:scale-95"
            >
              Sign up
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <a
              href="/login"
              className="inline-flex h-11 items-center rounded-full border border-[#1a0f00]/14 px-7 text-sm font-medium text-[#1a0f00]/55 transition-all duration-200 hover:bg-[#1a0f00]/06"
            >
              Log in
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center rounded-full border border-[#1a0f00]/14 px-7 text-sm font-medium text-[#1a0f00]/55 transition-all duration-200 hover:bg-[#1a0f00]/06"
            >
              See how it works
            </a>
          </motion.div>

          {/* Joint cue chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 1.05 }}
            className="mt-9 flex flex-wrap items-center gap-1.5"
          >
            {CUE.map(({ label, color }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 1.1 + i * 0.06 }}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: `${color}18` }}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Right: Skeleton comparison ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.075, 0.82, 0.165, 1] as [number,number,number,number] }}
          className="relative flex-shrink-0 scale-[0.7] sm:scale-[0.85] lg:scale-100 origin-center"
        >
          {/* Soft glow behind skeleton */}
          <div className="absolute inset-0 -m-12 rounded-full bg-[#A78BFA]/12 blur-3xl" />

          <div className="relative flex items-center gap-4 sm:gap-8">

            {/* Reference dancer */}
            <div className="relative">
              <DancerSvg progress={1} dimmed />
              <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.2em] text-[#1a0f00]/25">Reference</p>
            </div>

            {/* Seam divider with animated cue dots */}
            <div className="relative h-60 w-px sm:h-80">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a0f00]/12 to-transparent" />
              {CUE.map(({ color }, i) => (
                <motion.div
                  key={i}
                  className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                  style={{ top: `${8 + i * 12}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
                />
              ))}
            </div>

            {/* Analyzed dancer */}
            <div className="relative">
              <DancerSvg progress={skelProgress} />
              <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.2em] text-[#1a0f00]/25">You</p>
            </div>
          </div>

          {/* BPM / beat floating badge */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="absolute -top-4 right-0 flex items-center gap-1.5 rounded-full border border-[#1a0f00]/08 bg-white/80 px-3 py-1.5 backdrop-blur-sm"
          >
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-[#34D399]"
              animate={{ scale: [1, 1.6, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-mono text-[11px] font-semibold text-[#1a0f00]/60">120 BPM</span>
          </motion.div>

          {/* Count badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.6 }}
            className="absolute -bottom-2 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#1a0f00]/08 bg-white/80 backdrop-blur-sm"
          >
            <span className="font-calistoga text-lg font-bold text-[#1a0f00]">3</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Checkered stripe */}
      <div className="absolute bottom-0 inset-x-0 h-6 checkered-brown opacity-35" />
    </section>
  );
}
