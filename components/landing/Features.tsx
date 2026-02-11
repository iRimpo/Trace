"use client";

import { motion } from "framer-motion";
import Stagger, { staggerItem } from "@/components/ui/Stagger";
import FadeIn from "@/components/ui/FadeIn";

const features = [
  {
    title: "Skeleton Overlay",
    description:
      "AI-powered pose estimation maps your body's key points and overlays them on the reference dancer for instant visual comparison.",
    color: "bg-brand-purple",
  },
  {
    title: "Angle Analysis",
    description:
      "Measures joint angles across every frame and highlights where you deviate from the reference — down to the degree.",
    color: "bg-brand-red",
  },
  {
    title: "Timing Sync",
    description:
      "Automatically aligns your video to the reference using audio and motion cues, so comparisons are beat-accurate.",
    color: "bg-brand-green",
  },
  {
    title: "Progress Tracking",
    description:
      "Log your sessions, see accuracy scores improve over time, and identify patterns in the mistakes you keep making.",
    color: "bg-brand-dark",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-white px-8 py-20 sm:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <FadeIn blur>
          <p className="font-mono text-xs uppercase tracking-widest text-brand-dark/25">
            Features
          </p>
          <h2 className="mt-4 max-w-lg text-3xl font-bold leading-tight tracking-tight text-brand-dark sm:text-5xl">
            Everything you need to level up
          </h2>
        </FadeIn>

        <Stagger
          className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-brand-dark/[0.06] bg-brand-dark/[0.06] sm:grid-cols-2"
          staggerDelay={0.1}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={staggerItem}
              whileHover={{ backgroundColor: "rgba(0,0,0,0.015)" }}
              className="group flex h-full flex-col bg-white p-8 transition-colors duration-300 sm:p-10"
            >
              <motion.div
                className={`h-2.5 w-2.5 rounded-full ${feature.color}`}
                whileHover={{ scale: 1.6 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              />
              <h3 className="mt-6 text-lg font-bold text-brand-dark transition-transform duration-300 group-hover:translate-x-1">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-dark/40">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
