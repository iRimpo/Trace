"use client";

import { motion } from "framer-motion";
import { dims } from "./logoStyle";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
}

export default function ThinkingCharacter({ size = "md", className = "", animated = true }: Props) {
  const { w, h } = dims(size);

  const tilt = animated
    ? { animate: { rotate: [0, -3, -4, -3, 0] }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const } }
    : {};

  return (
    <svg width={w} height={h} viewBox="0 0 120 200" fill="none" className={className}>
      <motion.g {...tilt} style={{ originX: "60px", originY: "115px" }}>
        {/* HEAD */}
        <ellipse cx="60" cy="35" rx="24" ry="32" fill="white" stroke="black" strokeWidth="10" />
        <circle cx="52" cy="30" r="5" fill="black" />
        <circle cx="68" cy="30" r="5" fill="black" />

        {/* NECK */}
        <line x1="60" y1="67" x2="60" y2="75" stroke="black" strokeWidth="10" strokeLinecap="round" />

        {/* BODY */}
        <ellipse cx="60" cy="115" rx="26" ry="42" fill="white" stroke="black" strokeWidth="10" />

        {/* Left Arm on Hip */}
        <path d="M 38 90 Q 20 105 30 120" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />

        {/* Right Arm to Chin */}
        <path d="M 82 90 Q 110 80 90 55" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />

        {/* Question Mark */}
        <text x="95" y="40" fontFamily="sans-serif" fontSize="24" fill="black">?</text>

        {/* LEGS */}
        <path d="M 48 155 Q 45 175 42 190" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
        <path d="M 72 155 Q 75 175 78 190" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
