"use client";

import type { ReactNode } from "react";
import Panel from "@/components/ui/Panel";

/**
 * Loading, empty, error and success are four *states of one object*, not four
 * unrelated screens — so they are one shell with four skins.
 *
 * They used to be four hand-rolled centred divs: the skeleton was zinc on a
 * 5xl grid, the empty state was a dashed 3xl box at 12 units of padding, the
 * error was a red-50 strip with an underlined `window.location.reload()`, and
 * `components/states/` (unused by anything) was a fifth idea drawn in
 * react-icons. Four visual answers to "the page has nothing to show you yet"
 * reads as four different products.
 *
 * The shell fixes the geometry — 64px plate, bold heading, one supporting line,
 * one action — so the only thing a state chooses is its glyph, its tone and its
 * words.
 */

type Tone = "neutral" | "danger" | "success";

const PLATE: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink/60",
  danger:  "bg-duo-red/10 text-duo-red",
  success: "bg-duo-green/10 text-duo-green",
};

interface Props {
  /** Glyph inside the tinted plate. Ignored when `art` is given. */
  icon?:   ReactNode;
  /** Replaces the plate entirely — for an illustration that carries its own frame. */
  art?:    ReactNode;
  title:   string;
  body?:   ReactNode;
  action?: ReactNode;
  tone?:   Tone;
  /**
   * `status` for progress, `alert` for failures. Without this a state change is
   * only a colour, which is silent to a screen reader.
   */
  live?:   "status" | "alert";
  /** Drop the card when the block already sits inside one. */
  bare?:   boolean;
  className?: string;
}

export default function StateBlock({
  icon,
  art,
  title,
  body,
  action,
  tone = "neutral",
  live,
  bare = false,
  className = "",
}: Props) {
  const inner = (
    <div
      role={live}
      aria-live={live === "alert" ? "assertive" : live ? "polite" : undefined}
      className="flex flex-col items-center text-center"
    >
      {art ?? (
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${PLATE[tone]}`}>
          {icon}
        </div>
      )}
      {/*
        `text-lg`, not `text-xl`. This is an `<h3>` and it lands under the
        dashboard's `text-lg` `<h2>`, so sizing it larger inverted the visual
        hierarchy against the semantic one — the "no videos yet" plate outranked
        the "Your practice" header it was sitting inside. Matching the h2's size
        makes the block subordinate by position rather than by shrinking it,
        which would have made it timid instead of merely well-behaved.
      */}
      <h3 className="mt-5 text-lg font-extrabold tracking-tight text-ink">{title}</h3>
      {body && (
        <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-clay/70">{body}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );

  if (bare) return <div className={`px-6 py-10 ${className}`}>{inner}</div>;

  return (
    <Panel tone="paper" radius="2xl" className={`px-6 py-10 ${className}`}>
      {inner}
    </Panel>
  );
}
