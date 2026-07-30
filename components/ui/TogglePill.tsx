"use client";

import type { ReactNode } from "react";

/**
 * An on/off pill with a label — Mirror, Cues, Counts, Loop.
 *
 * These are the controls a dancer flips mid-song from across the room, so the
 * on state has to be readable as *on* without reading the word. The old version
 * signalled it with a 100-level tint behind a 700-level text colour (`bg-blue-100
 * text-blue-700`), which is a ~4% luminance shift on a white panel and vanishes
 * at distance. Here "on" is a filled pill in the accent colour, "off" is
 * unfilled — a fill/no-fill difference survives any viewing distance.
 *
 * `accent` names what the toggle *does*, consistently across the app: blue for
 * view/framing, emerald for the cue system, violet for counts and tempo, amber
 * for looping.
 */

type Accent = "blue" | "emerald" | "violet" | "amber";
type Tone = "paper" | "stage";

const ON: Record<Accent, string> = {
  blue:    "bg-duo-blue text-white border-duo-blue",
  emerald: "bg-duo-green text-white border-duo-green",
  violet:  "bg-cue-hip text-stage border-cue-hip",
  amber:   "bg-duo-gold text-ink border-duo-gold",
};

const OFF: Record<Tone, string> = {
  paper: "bg-transparent text-ink/50 border-duo-edge hover:text-ink hover:bg-ink/[0.05]",
  stage: "bg-white/[0.07] text-stage-text/70 border-white/15 hover:text-stage-text hover:bg-white/15",
};

interface Props {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  accent?: Accent;
  tone?: Tone;
  icon?: ReactNode;
  /** Trailing marker — the "Beta" tag on cues. */
  badge?: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
  id?: string;
}

export default function TogglePill({
  children,
  active,
  onClick,
  accent = "blue",
  tone = "stage",
  icon,
  badge,
  disabled = false,
  title,
  className = "",
  id,
}: Props) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={[
        "touch-target inline-flex min-h-[36px] shrink-0 items-center gap-1.5",
        "rounded-full border px-3 text-hud font-extrabold",
        active ? ON[accent] : OFF[tone],
        "transition-ui duration-150 ease-out-strong",
        "active:scale-[0.96] motion-reduce:active:scale-100 motion-reduce:transition-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue focus-visible:ring-offset-1",
        disabled ? "pointer-events-none opacity-40" : "",
        className,
      ].join(" ")}
    >
      {icon}
      <span className="whitespace-nowrap">{children}</span>
      {badge}
    </button>
  );
}
