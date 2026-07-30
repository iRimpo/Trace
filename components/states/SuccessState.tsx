"use client";

import { motion, useReducedMotion } from "framer-motion";
import StateBlock from "./StateBlock";
import { CheckIcon } from "./icons";

interface Props {
  message: string;
  detail?: string;
  bare?: boolean;
  className?: string;
}

/**
 * The success state.
 *
 * The only place in this vocabulary that earns a spring: it is seen rarely and
 * it is the one moment the app has something to celebrate. Bounce is kept low
 * and the mark starts at 0.6, never 0 — nothing in the real world appears out
 * of nothing.
 *
 * The plate is *not* what makes the copy visible: only the glyph animates, so a
 * mid-flight failure still leaves a readable state rather than a blank card.
 */
export function SuccessState({ message, detail, bare = true, className = "" }: Props) {
  const reduce = useReducedMotion();

  return (
    <StateBlock
      bare={bare}
      tone="success"
      live="status"
      title={message}
      body={detail}
      className={className}
      icon={
        <motion.span
          initial={reduce ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.42, bounce: 0.3 }}
          className="flex"
        >
          <CheckIcon />
        </motion.span>
      }
    />
  );
}

export default SuccessState;
