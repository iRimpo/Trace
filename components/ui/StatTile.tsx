"use client";

import type { ReactNode } from "react";

/**
 * A single glanceable number.
 *
 * The old dashboard stats were 4 columns of 10px labels on near-black at
 * white/50 — legible on a desk, not from across a room, and the label competed
 * with the number for attention. Here the number is the element and the label
 * is subordinate: heavy, tabular, high contrast, with the label small and
 * uppercase beneath it.
 *
 * `accent` colours the number only. Colouring the whole tile turns a stat row
 * into a stack of competing blocks, which is the opposite of glanceable.
 */

interface Props {
  value:   ReactNode;
  label:   string;
  accent?: "green" | "blue" | "gold" | "ink";
  icon?:   ReactNode;
}

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  green: "text-duo-green",
  blue:  "text-duo-blue",
  gold:  "text-duo-gold",
  ink:   "text-ink",
};

export default function StatTile({ value, label, accent = "ink", icon }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-2 py-3 shadow-card">
      {icon && <div className="mb-0.5">{icon}</div>}
      <p className={`text-2xl font-extrabold leading-none tabular-nums sm:text-3xl ${ACCENT[accent]}`}>
        {value}
      </p>
      <p className="text-hud uppercase tracking-[0.18em] text-clay/60">
        {label}
      </p>
    </div>
  );
}
