"use client";

import { motion } from "framer-motion";
import FadeIn from "@/components/ui/FadeIn";

export default function Testimonial() {
  return (
    <section className="bg-brand-red px-8 py-20 sm:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <FadeIn blur>
          <p className="font-mono text-xs uppercase tracking-widest text-white/30">
            Why Trace
          </p>
        </FadeIn>

        <FadeIn delay={0.15} blur>
          <blockquote className="mt-8 max-w-3xl text-3xl font-bold leading-snug tracking-tight text-white sm:text-5xl lg:text-6xl">
            &ldquo;The experience of a private coach, the flexibility of an app,
            and the precision of{" "}
            <motion.span
              className="inline-block italic"
              whileInView={{ opacity: [0.4, 1] }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.6 }}
            >
              motion capture
            </motion.span>
            .&rdquo;
          </blockquote>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-10 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-white/20" />
            <div>
              <p className="text-sm font-semibold text-white">Trace Team</p>
              <p className="text-xs text-white/40">
                Building the future of dance practice
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
