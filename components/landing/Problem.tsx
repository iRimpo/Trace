"use client";

import { motion } from "framer-motion";

const problemItems = [
  "Watching the same 10-second clip 100× times",
  "Never knowing which body part is actually wrong",
  "Reinforcing bad muscle memory every rep",
  "No feedback until you film yourself again",
];

const solutionItems = [
  "Frame-by-frame skeleton overlay on your feed",
  "Joint-by-joint deviation score in real time",
  "Instant correction before bad habits form",
  "Session history to track every improvement",
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Problem() {
  return (
    <section className="relative overflow-hidden bg-brand-dark px-8 py-24 sm:py-32 lg:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob absolute -bottom-32 -right-32 h-[400px] w-[400px] bg-[#A78BFA] opacity-10" />
      </div>

      <div className="relative mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs font-bold tracking-widest text-[#60A5FA]/80 uppercase">
            The Reality
          </span>
          <h2 className="mt-3 font-hero font-bold text-4xl lg:text-5xl text-white tracking-tight">
            Sound familiar?
          </h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Problem card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.075, 0.82, 0.165, 1] }}
            className="rounded-3xl border border-zinc-700/50 bg-zinc-800/30 p-8 lg:p-10"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700/40">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-zinc-400">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 5.5v4M9 12h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="font-mono text-xs text-zinc-500 tracking-widest uppercase">Without Trace</div>
                <h3 className="font-hero font-bold text-xl text-white mt-0.5">The frustration</h3>
              </div>
            </div>

            <div className="mb-8 flex justify-center">
              <img src="/ChatGPT-Image-Feb-15_-2026_-06_45_31-PM_5_.svg" width="140" height="140" alt="" className="rounded-2xl" />
            </div>

            <blockquote className="mb-8 rounded-2xl border border-zinc-700/40 bg-black/20 p-5 italic text-zinc-400 text-sm leading-relaxed">
              &ldquo;I&apos;ve watched this video 100 times, why don&apos;t my moves look right?&rdquo;
            </blockquote>

            <ul className="space-y-3">
              {problemItems.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm text-zinc-400"
                >
                  <XIcon className="mt-0.5 shrink-0 text-zinc-500" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Solution card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.075, 0.82, 0.165, 1] }}
            className="rounded-3xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 p-8 lg:p-10"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D4FF]/15">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-[#00D4FF]">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6 9.5L8 11.5L12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="font-mono text-xs text-[#00D4FF]/70 tracking-widest uppercase">With Trace</div>
                <h3 className="font-hero font-bold text-xl text-white mt-0.5">The solution</h3>
              </div>
            </div>

            <p className="mb-8 rounded-2xl border border-[#00D4FF]/15 bg-black/20 p-5 text-white/80 text-sm leading-relaxed font-medium">
              See exactly what your body should look like — in real time, frame by frame.
            </p>

            <ul className="space-y-3">
              {solutionItems.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm text-white/70"
                >
                  <CheckIcon className="mt-0.5 shrink-0 text-[#34D399]" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
