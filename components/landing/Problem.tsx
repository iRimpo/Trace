"use client";

import { motion } from "framer-motion";
import Stagger, { staggerItem } from "@/components/ui/Stagger";
import FadeIn from "@/components/ui/FadeIn";

const frustrations = [
  {
    num: "01",
    title: "Mirror Lies",
    description:
      "You look in the mirror and think it looks fine — then see the video and cringe. Your brain auto-corrects the flipped image.",
  },
  {
    num: "02",
    title: "Repeat Without Progress",
    description:
      "You drill the same combo 50 times but can't pinpoint what's off. Without frame-by-frame feedback, practice just reinforces bad habits.",
  },
  {
    num: "03",
    title: "Video Isn't Enough",
    description:
      "Recording yourself helps, but you're still guessing. Is it the timing? The angle? The weight shift? You need analysis, not just footage.",
  },
];

export default function Problem() {
  return (
    <section className="bg-brand-purple px-8 py-20 sm:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <FadeIn blur>
          <p className="font-mono text-xs uppercase tracking-widest text-brand-dark/40">
            The problem
          </p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight text-brand-dark sm:text-5xl">
            Every dancer knows this frustration
          </h2>
        </FadeIn>

        <Stagger className="mt-16 grid gap-0 border-t border-brand-dark/10 sm:grid-cols-3" staggerDelay={0.12}>
          {frustrations.map((item, i) => (
            <motion.div
              key={item.num}
              variants={staggerItem}
              className={`group border-brand-dark/10 py-10 pr-8 ${
                i < 2 ? "sm:border-r" : ""
              } ${i > 0 ? "sm:pl-8" : ""}`}
            >
              <p className="font-mono text-2xl font-bold text-brand-dark/25 sm:text-3xl">
                {item.num}
              </p>
              <h3 className="mt-4 text-2xl font-bold text-brand-dark transition-transform duration-300 group-hover:translate-x-1 sm:text-xl">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-dark/50">
                {item.description}
              </p>
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
