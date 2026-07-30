"use client";

import { motion } from "framer-motion";
import { useId } from "react";

/**
 * A segmented control — pick exactly one of a short, fixed set.
 *
 * Written three separate times on the practice screen (view mode, playback
 * speed, and the count picker), each at a different height, each at a different
 * text size, two of them below the touch minimum. This is the one.
 *
 * The selection is a `layoutId` pill that slides between segments rather than a
 * background that cuts. Sliding says "the same thing moved"; a cut says "a
 * different thing appeared", and for a control whose whole job is to show which
 * of N you are on, the first is the true statement.
 */

type Tone = "paper" | "stage";

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: Tone;
  /** Accessible name for the group — "Playback speed", "View mode". */
  label: string;
  className?: string;
}

const TRACK: Record<Tone, string> = {
  paper: "bg-ink/[0.06]",
  stage: "bg-white/10",
};

const PILL: Record<Tone, string> = {
  paper: "bg-white shadow-sm",
  stage: "bg-white",
};

const TEXT: Record<Tone, { on: string; off: string }> = {
  paper: { on: "text-ink", off: "text-ink/45 hover:text-ink/75" },
  stage: { on: "text-stage", off: "text-stage-text/60 hover:text-stage-text" },
};

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = "paper",
  label,
  className = "",
}: Props<T>) {
  // Two segmented controls on one screen must not share a layoutId, or the pill
  // teleports between them.
  const groupId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex items-center gap-0.5 rounded-2xl p-1 ${TRACK[tone]} ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={[
              "touch-target relative flex min-h-[36px] flex-1 items-center justify-center",
              "rounded-xl px-3 text-hud font-extrabold transition-ui duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue",
              on ? TEXT[tone].on : TEXT[tone].off,
            ].join(" ")}
          >
            {on && (
              <motion.span
                layoutId={`segmented-${groupId}`}
                className={`absolute inset-0 rounded-xl ${PILL[tone]}`}
                transition={{ type: "spring", stiffness: 480, damping: 40 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
