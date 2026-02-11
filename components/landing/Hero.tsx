"use client";

import { motion } from "framer-motion";
import Marquee from "@/components/ui/Marquee";
import CountUp from "@/components/ui/CountUp";

const headlineWords = ["Stop", "guessing", "why", "your", "moves", "don't", "look", "right"];

const brands = [
  "TikTok", "YouTube", "Instagram", "Steezy", "CLI Studios",
  "Apple Music", "Spotify", "SoundCloud",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white px-8 pb-0 pt-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        {/* Mono label */}
        <motion.p
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.075, 0.82, 0.165, 1] }}
          className="font-mono text-xs uppercase tracking-widest text-brand-dark/30"
        >
          AI-Powered Dance Analysis
        </motion.p>

        {/* Giant staggered headline */}
        <h1 className="mt-6 max-w-5xl text-5xl font-bold leading-[1.08] tracking-tight text-brand-dark sm:text-7xl lg:text-[5.5rem]">
          {headlineWords.map((word, i) => (
            <motion.span
              key={i}
              className="mr-[0.28em] inline-block"
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.7,
                delay: 0.2 + i * 0.06,
                ease: [0.075, 0.82, 0.165, 1],
              }}
            >
              {word === "moves" ? (
                <span className="italic text-brand-purple">{word}</span>
              ) : (
                word
              )}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle + CTA */}
        <div className="mt-10 flex flex-col gap-8 sm:mt-14 lg:flex-row lg:items-end lg:justify-between">
          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.075, 0.82, 0.165, 1] }}
            className="max-w-md text-base leading-relaxed text-brand-dark/40 sm:text-lg"
          >
            Trace uses AI motion analysis to show you exactly where your
            technique breaks down — frame by frame, angle by angle.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85, ease: [0.075, 0.82, 0.165, 1] }}
            className="flex items-center gap-5"
          >
            <a
              href="#waitlist"
              className="rounded-full bg-brand-red px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-brand-red/20"
            >
              Join the Waitlist →
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-brand-dark/40 underline decoration-brand-dark/10 underline-offset-4 transition-all duration-300 hover:text-brand-dark hover:decoration-brand-dark/30"
            >
              Learn more
            </a>
          </motion.div>
        </div>

        {/* Stats with count-up */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="mt-16 grid grid-cols-3 border-t border-brand-dark/[0.06] pt-8 sm:mt-24"
        >
          {[
            { end: 200, suffix: "+", label: "Dancers on waitlist" },
            { end: 30, suffix: " fps", label: "Frame-by-frame analysis" },
            { end: 98, suffix: "%", label: "Pose accuracy" },
          ].map((stat) => (
            <div key={stat.label} className="pr-4">
              <p className="text-2xl font-bold tabular-nums text-brand-dark sm:text-4xl">
                <CountUp end={stat.end} suffix={stat.suffix} />
              </p>
              <p className="mt-1.5 text-xs text-brand-dark/30 sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Logo marquee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
        className="mt-16 border-t border-brand-dark/[0.06] py-8 sm:mt-20"
      >
        <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-widest text-brand-dark/20">
          Inspired by platforms dancers love
        </p>
        <Marquee speed={25}>
          {brands.map((brand) => (
            <span
              key={brand}
              className="whitespace-nowrap px-6 text-sm font-medium text-brand-dark/20 transition-colors duration-300 hover:text-brand-dark/50"
            >
              {brand}
            </span>
          ))}
        </Marquee>
      </motion.div>
    </section>
  );
}
