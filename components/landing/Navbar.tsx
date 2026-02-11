"use client";

import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

export default function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  const paddingX = useTransform(scrollY, [0, 100], [24, 6]);
  const paddingY = useTransform(scrollY, [0, 100], [10, 4]);

  return (
    <div className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-4">
      <motion.nav
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.075, 0.82, 0.165, 1] }}
        style={{ paddingLeft: paddingX, paddingRight: paddingX, paddingTop: paddingY, paddingBottom: paddingY }}
        className={`flex items-center gap-1 rounded-[22px] transition-all duration-500 ${
          scrolled
            ? "bg-brand-dark/90 shadow-2xl shadow-black/20 backdrop-blur-2xl"
            : "bg-brand-dark/80 shadow-xl shadow-black/10 backdrop-blur-xl"
        }`}
      >
        {/* Liquid glass border effect */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] border border-white/[0.08]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[21px] border border-white/[0.04]" />

        {/* Inner glow */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/[0.08] to-transparent" style={{ height: "50%" }} />

        {/* Logo */}
        <a
          href="#"
          className="relative z-10 px-3 py-1.5 text-sm font-bold tracking-tight text-white transition-opacity duration-200 hover:opacity-70"
        >
          Trace<span className="text-brand-purple">.</span>
        </a>

        {/* Separator dot */}
        <div className="relative z-10 h-1 w-1 rounded-full bg-white/20" />

        {/* Nav links */}
        <div className="relative z-10 hidden items-center gap-0.5 sm:flex">
          {["How it works", "Features"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/ /g, "-")}`}
              className="rounded-full px-3 py-1.5 text-xs text-white/50 transition-all duration-300 hover:bg-white/[0.08] hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Separator dot */}
        <div className="relative z-10 h-1 w-1 rounded-full bg-white/20" />

        {/* CTA */}
        <a
          href="#waitlist"
          className="relative z-10 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-brand-dark transition-all duration-300 hover:bg-brand-purple hover:text-white"
        >
          Join Waitlist
        </a>
      </motion.nav>
    </div>
  );
}
