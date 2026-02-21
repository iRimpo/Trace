"use client";

import { motion } from "framer-motion";
import { FaQuestionCircle, FaCheckCircle, FaTimes, FaCheck } from "react-icons/fa";

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

export default function Problem() {
  return (
    <section className="relative overflow-hidden bg-brand-dark px-8 py-24 sm:py-32 lg:px-16">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob absolute -top-32 -left-32 h-[400px] w-[400px] bg-brand-accent opacity-20" />
        <div className="blob absolute -bottom-32 -right-32 h-[400px] w-[400px] bg-brand-primary opacity-20" />
      </div>

      <div className="relative mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs font-bold tracking-widest text-brand-primary/80 uppercase">
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
            className="rounded-3xl border border-brand-accent/20 bg-brand-accent/5 p-8 lg:p-10"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent/15">
                <FaQuestionCircle className="text-brand-accent text-lg" />
              </div>
              <div>
                <div className="font-mono text-xs text-brand-accent/70 tracking-widest uppercase">Without Trace</div>
                <h3 className="font-hero font-bold text-xl text-white mt-0.5">The frustration</h3>
              </div>
            </div>

            <blockquote className="mb-8 rounded-2xl border border-brand-accent/15 bg-black/20 p-5 italic text-white/60 text-sm leading-relaxed">
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
                  className="flex items-start gap-3 text-sm text-white/50"
                >
                  <FaTimes className="mt-0.5 shrink-0 text-brand-accent/70" />
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
            className="rounded-3xl border border-brand-primary/25 bg-brand-primary/8 p-8 lg:p-10"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/15">
                <FaCheckCircle className="text-brand-primary text-lg" />
              </div>
              <div>
                <div className="font-mono text-xs text-brand-primary/70 tracking-widest uppercase">With Trace</div>
                <h3 className="font-hero font-bold text-xl text-white mt-0.5">The solution</h3>
              </div>
            </div>

            <p className="mb-8 rounded-2xl border border-brand-primary/15 bg-black/20 p-5 text-white/80 text-sm leading-relaxed font-medium">
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
                  <FaCheck className="mt-0.5 shrink-0 text-brand-primary" />
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
