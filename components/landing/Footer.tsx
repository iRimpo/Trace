"use client";

import { motion } from "framer-motion";

const CUE_COLORS = ["#00D4FF", "#34D399", "#FBBF24", "#F97316", "#A78BFA", "#60A5FA", "#F472B6"];

export default function Footer() {
  return (
    <footer className="bg-[#f8f4e0] py-10">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:gap-6 sm:px-6 md:flex-row md:text-left lg:px-10"
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-col items-center justify-center rounded-full border-2 border-[#080808] bg-[#080808] shadow">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="2" fill="white"/>
            </svg>
          </div>
          <span className="font-calistoga text-lg text-[#1a0f00]">
            Trace<span className="text-[#080808]">.</span>
          </span>
        </a>

        {/* Cue color dots */}
        <div className="flex items-center gap-1.5">
          {CUE_COLORS.map((c, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>

        <p className="text-xs text-[#5c3d1a]/40">
          &copy; {new Date().getFullYear()} Trace. All rights reserved.
        </p>

        <div className="flex items-center gap-6">
          {["Privacy Policy", "Terms of Service"].map(label => (
            <a key={label} href="#" className="text-xs text-[#5c3d1a]/40 transition-colors duration-200 hover:text-[#1a0f00]">
              {label}
            </a>
          ))}
        </div>
      </motion.div>
    </footer>
  );
}
