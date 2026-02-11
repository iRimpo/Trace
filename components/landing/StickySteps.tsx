"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Upload a reference video",
    description:
      "Pick any dance video as your target — a tutorial, a choreographer's original, or your own personal best.",
    accent: "text-brand-purple",
    dot: "bg-brand-purple",
  },
  {
    num: "02",
    title: "Record yourself dancing",
    description:
      "Film yourself attempting the same routine. Any camera works — your phone is more than enough.",
    accent: "text-brand-red",
    dot: "bg-brand-red",
  },
  {
    num: "03",
    title: "AI maps your skeleton",
    description:
      "Trace uses pose estimation to extract body keypoints from both videos and align them frame by frame.",
    accent: "text-brand-green",
    dot: "bg-brand-green",
  },
  {
    num: "04",
    title: "See exactly what's off",
    description:
      "Ghost Mirror overlays both skeletons so you can see every deviation — joint angles, timing gaps, weight shifts — all visualized.",
    accent: "text-brand-purple",
    dot: "bg-brand-purple",
  },
];

export default function StickySteps() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [activeIndex, setActiveIndex] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const index = Math.min(
      steps.length - 1,
      Math.floor(latest * steps.length)
    );
    setActiveIndex(index);
  });

  // Progress indicator
  const indicatorHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const activeStep = steps[activeIndex];

  return (
    <section
      ref={containerRef}
      id="how-it-works"
      className="relative bg-white"
      style={{ height: `${steps.length * 100}vh` }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-8 lg:px-20">
        <div className="mx-auto grid w-full max-w-7xl gap-16 lg:grid-cols-2 lg:gap-20">
          {/* Left — sticky label + progress bar */}
          <div className="flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-widest text-brand-dark/20">
              How it works
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-brand-dark sm:text-3xl">
              Four steps to
              <br />
              <span className="text-brand-dark/30">perfect form.</span>
            </h2>

            {/* Step indicators */}
            <div className="mt-10 flex items-start gap-4">
              {/* Vertical progress line */}
              <div className="relative h-40 w-px bg-brand-dark/[0.06]">
                <motion.div
                  className="absolute left-0 top-0 w-px bg-brand-purple"
                  style={{ height: indicatorHeight }}
                />
              </div>

              {/* Step numbers */}
              <div className="flex h-40 flex-col justify-between">
                {steps.map((step, i) => (
                  <div
                    key={step.num}
                    className={`flex items-center gap-2 transition-opacity duration-300 ${
                      i <= activeIndex ? "opacity-100" : "opacity-20"
                    }`}
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${step.dot}`}
                    />
                    <span className="font-mono text-sm font-semibold text-brand-dark/40">
                      {step.num}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — animated step content */}
          <div className="relative flex min-h-[300px] items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${activeStep.dot}`}
                  />
                  <span className="font-mono text-sm font-semibold text-brand-dark/30 sm:text-base">
                    Step {activeStep.num}
                  </span>
                </div>
                <h3
                  className={`mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl ${activeStep.accent}`}
                >
                  {activeStep.title}
                </h3>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-brand-dark/40 sm:text-lg">
                  {activeStep.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
