"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The page-level failure of a form — not a state of the page.
 *
 * `StateBlock` is the wrong home for this: that shell is a centred 64px plate
 * that replaces whatever the page was showing, and this is a strip that lands
 * *inside* a form the user is still filling in. But the three auth screens had
 * each drawn their own copy of the same strip, so the one piece of markup that
 * exists to say "that didn't work" was maintained in three places.
 *
 * It reads its own reduced-motion preference rather than taking one as a prop —
 * login's copy had simply omitted the check, which is the failure mode a prop
 * invites.
 */
interface Props {
  message: string;
  className?: string;
}

export function FormError({ message, className = "" }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      // Announced, not merely coloured — a red border is silent to a screen
      // reader, and a failed submit is exactly the moment nothing else moves.
      role="alert"
      className={`rounded-2xl border-2 border-duo-red/30 bg-duo-red/[0.07] px-4 py-3 ${className}`}
    >
      <p className="text-sm font-semibold text-duo-red">{message}</p>
    </motion.div>
  );
}

export default FormError;
