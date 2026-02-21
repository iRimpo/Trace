"use client";

import { motion } from "framer-motion";
import { dims } from "./logoStyle";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
}

export default function JumpingCharacter({ size = "md", className = "", animated = true }: Props) {
  const { w, h } = dims(size);

  const jump = animated
    ? {
        animate: { y: [0, 2, 2, -12, -14, -12, -4, 0, 0] },
        transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const, times: [0, 0.1, 0.2, 0.4, 0.5, 0.6, 0.75, 0.9, 1] },
      }
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

        {/* Both Arms Up */}
        <path d="M 38 90 Q 25 65 20 45" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
        <path d="M 82 90 Q 95 65 100 45" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />

        {/* Legs tucked/together */}
        <path d="M 52 155 Q 50 175 48 190" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
        <path d="M 68 155 Q 70 175 72 190" fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
