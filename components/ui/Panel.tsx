"use client";

import type { ReactNode } from "react";

/**
 * A surface. Either a paper card or a stage panel — the two grounds the app has.
 *
 * The distinction is not decorative. On cream, depth is a solid unblurred edge
 * (`shadow-card`): the ground is static, so a hard edge reads as a physical
 * layer. Over the practice camera feed there is no static ground to cast onto,
 * so depth there is a blur plus a translucent fill, and the panel earns its
 * separation from the video by contrast instead of by edge.
 *
 * Getting this backwards is what made the old practice chrome white glass —
 * paper depth applied to a stage surface.
 */

type Tone = "paper" | "stage" | "stage-solid";

const TONE: Record<Tone, string> = {
  paper: "bg-white shadow-card",
  stage: "bg-stage-glass backdrop-blur-xl border border-white/10 shadow-stage",
  "stage-solid": "bg-stage-raised border border-stage-edge shadow-stage",
};

interface Props {
  children: ReactNode;
  tone?: Tone;
  /** Softer corners for full-width sheets, tighter for inline chips. */
  radius?: "lg" | "xl" | "2xl";
  className?: string;
  id?: string;
}

const RADIUS = { lg: "rounded-xl", xl: "rounded-2xl", "2xl": "rounded-3xl" } as const;

export default function Panel({
  children,
  tone = "paper",
  radius = "xl",
  className = "",
  id,
}: Props) {
  return (
    <div id={id} className={`${RADIUS[radius]} ${TONE[tone]} ${className}`}>
      {children}
    </div>
  );
}
