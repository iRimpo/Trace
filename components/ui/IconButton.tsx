"use client";

import type { ReactNode } from "react";

/**
 * A square icon control that is 44px whatever it looks like.
 *
 * Icon buttons are where the touch minimum kept getting lost: a 32px circle
 * looks right in a dense transport row and is a coin-flip to hit while dancing.
 * `visual` sets what you see; the hit area is always at least 44px, expanded by
 * the `.touch-target` pseudo-element when the visual is smaller.
 *
 * `aria-label` is required rather than optional. An icon-only control with no
 * label is silent to a screen reader, and making it a type error is the only
 * version of that rule that survives a refactor.
 */

type Tone = "paper" | "stage" | "stage-solid";
type Visual = "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  paper: "text-ink/50 hover:text-ink hover:bg-ink/[0.06]",
  /** Sits directly on video — needs its own fill, not just a text colour. */
  stage:
    "bg-stage-glass text-stage-text/70 backdrop-blur-xl border border-white/10 " +
    "hover:text-stage-text hover:bg-stage/80",
  "stage-solid":
    "bg-stage-raised text-stage-text border border-stage-edge hover:bg-stage-edge",
};

const VISUAL: Record<Visual, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

interface Props {
  children: ReactNode;
  "aria-label": string;
  onClick?: () => void;
  tone?: Tone;
  visual?: Visual;
  /** Pressed / on state — a toggle, not a hover. */
  active?: boolean;
  disabled?: boolean;
  round?: boolean;
  title?: string;
  className?: string;
  id?: string;
}

export default function IconButton({
  children,
  onClick,
  tone = "paper",
  visual = "md",
  active = false,
  disabled = false,
  round = true,
  title,
  className = "",
  id,
  ...aria
}: Props) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={aria["aria-label"]}
      aria-pressed={active || undefined}
      className={[
        "touch-target flex shrink-0 items-center justify-center",
        round ? "rounded-full" : "rounded-xl",
        VISUAL[visual],
        TONE[tone],
        active ? "!bg-duo-blue !text-white !border-duo-blue" : "",
        "transition-ui duration-150 ease-out-strong",
        "active:scale-[0.94] motion-reduce:active:scale-100 motion-reduce:transition-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue focus-visible:ring-offset-2",
        disabled ? "pointer-events-none opacity-40" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
