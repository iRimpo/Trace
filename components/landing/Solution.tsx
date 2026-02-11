"use client";

import { motion } from "framer-motion";
import Stagger, { staggerItem } from "@/components/ui/Stagger";
import FadeIn from "@/components/ui/FadeIn";

const steps = [
  {
    num: "01",
    title: "Upload a reference",
    description: "Pick any dance video as your target — a tutorial, a pro performance, or your own best take.",
  },
  {
    num: "02",
    title: "Record yourself",
    description: "Film yourself attempting the same choreography. Any camera, any angle.",
  },
  {
    num: "03",
    title: "AI does the work",
    description: "Trace maps your skeleton onto the reference in real time using pose estimation.",
  },
  {
    num: "04",
    title: "See the difference",
    description: "Get a visual diff highlighting every deviation — angle by angle, frame by frame.",
  },
];

export default function Solution() {
  return (
    <section
      id="how-it-works"
      className="bg-brand-dark px-8 py-20 sm:py-28 lg:px-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-20">
          {/* Left */}
          <div>
            <FadeIn blur>
              <p className="font-mono text-xs uppercase tracking-widest text-white/25">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Meet Ghost Mirror
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-white/35 sm:text-lg">
                Your AI-powered dance coach that sees what you can&apos;t.
                Record, compare, improve — in minutes.
              </p>
            </FadeIn>

            {/* Preview */}
            <FadeIn delay={0.3}>
              <div className="group relative mt-12 aspect-video cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] transition-all duration-500 hover:border-white/10 hover:bg-white/[0.05]">
                <div className="flex h-full items-center justify-center">
                  {/* Play button */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 transition-colors duration-300 group-hover:bg-brand-purple/30"
                  >
                    <svg className="ml-1 h-6 w-6 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </motion.div>
                </div>

                {/* Progress bar */}
                <div className="absolute inset-x-0 bottom-0 px-4 py-3">
                  <div className="h-[2px] w-full rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-[2px] rounded-full bg-brand-purple"
                      initial={{ width: "0%" }}
                      whileInView={{ width: "65%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 2.5, delay: 0.8, ease: [0.075, 0.82, 0.165, 1] }}
                    />
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Right — steps */}
          <Stagger className="flex flex-col justify-center" staggerDelay={0.1}>
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                variants={staggerItem}
                className={`group border-white/[0.06] py-7 ${
                  i < steps.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="flex items-start gap-6">
                  <span className="font-mono text-2xl font-bold text-white/20 sm:text-3xl">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white transition-transform duration-300 group-hover:translate-x-1 sm:text-lg">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/30">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
