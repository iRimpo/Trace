"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A scroll entrance that cannot hide content.
 *
 * The previous page animated `opacity: 0 → 1` on nearly every section with
 * framer's `whileInView`. Framer writes the `initial` values straight into the
 * server-rendered markup, so anything that stopped the animation from finishing
 * — a hydration error, an interrupted load, a screenshot taken mid-flight —
 * left the section permanently invisible. That is exactly how this page shipped
 * rendering nearly blank (docs/HANDOFF.md).
 *
 * So the entrance here is **transform only**. There is no opacity in it. The
 * worst case if the animation never runs is a block sitting 16px lower than it
 * should; it is never a block you cannot read. `docs/DESIGN_SYSTEM.md` §4:
 * entrance animation is an enhancement over already-visible content, never the
 * thing that reveals it.
 *
 * 240ms and `ease-out-strong` — the same curve `Pressable` and the login card
 * use, so the page moves like the rest of the app rather than like a deck.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.24, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
