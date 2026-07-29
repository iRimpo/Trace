"use client";

import { MotionConfig } from "framer-motion";

/**
 * Honour the OS "reduce motion" setting across every framer-motion component.
 *
 * `globals.css` already respects `prefers-reduced-motion` for CSS animations,
 * but the ~200 framer components ignored it — the bulk of the app's motion.
 * `reducedMotion="user"` makes framer skip transform and opacity animations
 * when the OS asks for it, without touching any call site.
 *
 * This matters more here than in most apps: users are watching for movement
 * cues while dancing, and vestibular triggers are a real accessibility
 * concern for a product built around full-body motion.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
