"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { FaArrowRight, FaPlay, FaCheck, FaBolt, FaShieldAlt } from "react-icons/fa";

// Float animation applied inline via motion props

const statItems = [
  { value: "160+", label: "Beta testers"     },
  { value: "24fps", label: "Analysis speed"  },
  { value: "78%",   label: "Avg. improvement"},
];

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-brand-bg pt-36 pb-20 lg:pt-44 lg:pb-32">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob absolute -top-40 -left-40 h-[600px] w-[600px] bg-brand-primary" />
        <div className="blob absolute -bottom-20 -right-20 h-[500px] w-[500px] bg-brand-accent" />
        <div className="blob absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 bg-brand-purple" />
      </div>

      {/* Grid dot layer */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-50" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-start">

          {/* ── Left column ── */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.075, 0.82, 0.165, 1] }}
            className="flex-1 text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-brand-primary/8 px-4 py-1.5"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
              <span className="font-mono text-xs font-bold tracking-widest text-brand-primary">
                AI-POWERED DANCE ANALYSIS
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="font-hero font-bold text-5xl lg:text-[4.5rem] text-brand-dark tracking-tight leading-[1.08]">
              Stop Guessing <br className="hidden lg:block" />
              Why Your Moves{" "}
              <span
                className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent"
              >
                Don&apos;t Look Right
              </span>
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-6 text-lg text-brand-dark/55 leading-relaxed max-w-md mx-auto lg:mx-0"
            >
              Practice with a pro&apos;s skeleton overlay. Trace uses AI to compare your
              movement frame by frame — so you know exactly where to fix.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:items-start"
            >
              {/* Primary */}
              <a
                href="#waitlist"
                className="group relative flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-xl shadow-brand-primary/30"
              >
                <div className="absolute left-2 h-8 w-8 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[30]" />
                <span className="relative z-10 pl-12 pr-4 py-2.5 text-sm font-noname font-semibold text-white transition-colors duration-[900ms] group-hover:text-white">
                  Join the Waitlist
                </span>
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white mr-0.5">
                  <FaArrowRight className="text-xs" />
                </div>
              </a>

              {/* Secondary */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 text-sm font-semibold text-brand-dark/60 hover:text-brand-dark transition-colors"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-primary/20 bg-white shadow-md shadow-brand-primary/10">
                  <FaPlay className="text-brand-primary text-[9px] ml-0.5" />
                </span>
                Watch How It Works
              </motion.button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="mt-12 border-t border-brand-primary/10 pt-8 flex gap-10 justify-center lg:justify-start"
            >
              {statItems.map(({ value, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <div className="text-2xl font-hero font-bold text-brand-dark">
                    {value}
                  </div>
                  <div className="text-xs text-brand-dark/40 mt-0.5">{label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* ── Right column ── */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.075, 0.82, 0.165, 1] }}
            className="flex-1 relative flex justify-center lg:justify-end pt-4"
          >
            {/* Glow */}
            <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-brand-primary via-brand-purple to-brand-accent opacity-25 blur-3xl" />

            {/* 3D-tilt dancer card */}
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden cursor-pointer [transform:perspective(1200px)_rotateX(6deg)_rotateY(-4deg)_scale(0.95)] hover:[transform:perspective(1200px)_rotateX(0deg)_rotateY(0deg)_scale(1)] transition-[transform] duration-700"
            >
              <Image
                src="https://images.unsplash.com/photo-1574550746174-fb20150b03d4?w=800&q=80"
                alt="Dancer performing"
                width={800}
                height={960}
                className="w-full object-cover"
                priority
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-transparent to-transparent" />

              {/* Sync score chip */}
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-white/60 uppercase tracking-widest">
                    Sync Score
                  </div>
                  <div className="text-2xl font-hero font-bold text-white leading-none mt-0.5">
                    94.2
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 border border-emerald-400/30">
                    <FaCheck className="text-emerald-400 text-xs" />
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/20 border border-brand-primary/30">
                    <FaBolt className="text-brand-primary text-xs" />
                  </div>
                </div>
              </div>

              {/* Top label */}
              <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-brand-primary/90 backdrop-blur-sm px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-white tracking-widest">
                  LIVE ANALYSIS
                </span>
              </div>
            </motion.div>

            {/* Floating badge — Ghost Mirror */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: "backOut" }}
              className="absolute -bottom-4 -left-4 lg:-left-10 rounded-2xl bg-white shadow-2xl border border-gray-100 p-3 flex items-center gap-3 z-10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
                <FaShieldAlt className="text-brand-primary text-sm" />
              </div>
              <div>
                <div className="text-xs font-bold text-brand-dark">Ghost Mirror</div>
                <div className="text-[10px] text-brand-dark/40">Real-time Overlay Active</div>
              </div>
              <div className="ml-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </motion.div>

            {/* Floating accuracy card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.6, ease: "backOut" }}
              className="absolute -top-4 -right-2 lg:-right-8 rounded-2xl bg-white shadow-2xl border border-gray-100 p-3 z-10"
            >
              <div className="text-[10px] text-brand-dark/40 font-mono uppercase tracking-wider">
                Arm Alignment
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
                    initial={{ width: "0%" }}
                    animate={{ width: "88%" }}
                    transition={{ delay: 1.2, duration: 1, ease: "easeOut" }}
                  />
                </div>
                <span className="text-xs font-bold text-brand-dark">88%</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
