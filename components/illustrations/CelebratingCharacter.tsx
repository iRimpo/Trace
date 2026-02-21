"use client";

import { motion } from "framer-motion";
import { dims } from "./logoStyle";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
}

export default function CelebratingCharacter({ size = "md", className = "", animated = true }: Props) {
  const { w, h } = dims(size);

  const jump = animated
    ? { animate: { y: [0, -6, -8, -6, 0, 0] }, transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const } }
    : {};

  return (
    <svg width={w} height={h} viewBox="0 0 120 200" fill="none" className={className}>
      <motion.g {...jump}>
        {/* HEAD */}
        <ellipse cx="60" cy="35" rx="24" ry="32" fill="white" stroke="black" strokeWidth="10" />
        <circle cx="52" cy="30" r="5" fill="black" />
        <circle cx="68" cy="30" r="5" fill="black" />

        {/* NECK */}
        <line x1="60" y1="67" x2="60" y2="75" stroke="black" strokeWidth="10" strokeLinecap="round" />

        {/* BODY */}
        <ellipse cx="60" cy="115" rx="26" ry="42" fill="white" stroke="black" strokeWidth="10" />

        {/* Both Arms High V-Shape */}
        <path d="M 38 90 Q 15 60 10 30" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
        <path d="M 82 90 Q 105 60 110 30" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />

        {/* Legs Wide */}
        <path d="M 48 155 Q 35 175 30 190" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
        <path d="M 72 155 Q 85 175 90 190" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
