"use client";

import { motion } from "framer-motion";
import { dims, toneStyle, type CharacterTone } from "./logoStyle";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
  /** Which ground this sits on. `stage` inverts for the dark practice ground. */
  tone?: CharacterTone;
}

export default function IdleCharacter({ size = "md", className = "", animated = true, tone = "paper" }: Props) {
  const { w, h } = dims(size);

  const bob = animated
    ? { animate: { y: [0, -2, 0] }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const } }
    : {};

  return (
    <svg width={w} height={h} viewBox="0 0 120 200" fill="none" className={className} style={toneStyle(tone)}>
      <motion.g {...bob}>
        {/* HEAD */}
        <ellipse cx="60" cy="35" rx="24" ry="32" fill="var(--character-fill)" stroke="currentColor" strokeWidth="10" />
        <circle cx="52" cy="30" r="5" fill="currentColor" />
        <circle cx="68" cy="30" r="5" fill="currentColor" />

        {/* NECK */}
        <line x1="60" y1="67" x2="60" y2="75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

        {/* BODY */}
        <ellipse cx="60" cy="115" rx="26" ry="42" fill="var(--character-fill)" stroke="currentColor" strokeWidth="10" />

        {/* ARMS - relaxed at sides */}
        <path d="M 38 90 Q 18 100 15 115" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="M 82 90 Q 102 100 105 115" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

        {/* LEGS - standing */}
        <path d="M 48 155 Q 45 175 42 190" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="M 72 155 Q 75 175 78 190" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
