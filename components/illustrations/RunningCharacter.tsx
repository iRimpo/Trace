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

export default function RunningCharacter({ size = "md", className = "", animated = true, tone = "paper" }: Props) {
  const { w, h } = dims(size);

  const bounce = animated
    ? { animate: { y: [0, -3, 0, -3, 0] }, transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const } }
    : {};

  return (
    <svg width={w} height={h} viewBox="0 0 120 200" fill="none" className={className} style={toneStyle(tone)}>
      <motion.g {...bounce}>
        {/* Tilted forward for speed illusion */}
        <g transform="rotate(5, 60, 100)">
          {/* HEAD */}
          <ellipse cx="60" cy="35" rx="24" ry="32" fill="var(--character-fill)" stroke="currentColor" strokeWidth="10" />
          <circle cx="52" cy="30" r="5" fill="currentColor" />
          <circle cx="68" cy="30" r="5" fill="currentColor" />

          {/* NECK */}
          <line x1="60" y1="67" x2="60" y2="75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

          {/* BODY */}
          <ellipse cx="60" cy="115" rx="26" ry="42" fill="var(--character-fill)" stroke="currentColor" strokeWidth="10" />

          {/* Left Arm Back */}
          {animated ? (
            <motion.path
              animate={{
                d: [
                  "M 38 90 Q 20 100 25 110",
                  "M 38 90 Q 15 88 8 82",
                  "M 38 90 Q 20 100 25 110",
                ],
              }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            />
          ) : (
            <path d="M 38 90 Q 20 100 25 110" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          )}

          {/* Right Arm Forward */}
          {animated ? (
            <motion.path
              animate={{
                d: [
                  "M 82 90 Q 100 85 95 70",
                  "M 82 90 Q 100 100 105 115",
                  "M 82 90 Q 100 85 95 70",
                ],
              }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            />
          ) : (
            <path d="M 82 90 Q 100 85 95 70" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          )}

          {/* Back Leg */}
          {animated ? (
            <motion.path
              animate={{
                d: [
                  "M 48 155 Q 30 165 25 150",
                  "M 48 155 Q 55 170 55 185",
                  "M 48 155 Q 30 165 25 150",
                ],
              }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            />
          ) : (
            <path d="M 48 155 Q 30 165 25 150" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          )}

          {/* Front Leg */}
          {animated ? (
            <motion.path
              animate={{
                d: [
                  "M 72 155 Q 85 165 85 185",
                  "M 72 155 Q 65 165 65 150",
                  "M 72 155 Q 85 165 85 185",
                ],
              }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            />
          ) : (
            <path d="M 72 155 Q 85 165 85 185" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          )}
        </g>
      </motion.g>
    </svg>
  );
}
