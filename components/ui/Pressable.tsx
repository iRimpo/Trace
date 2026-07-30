"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The one pressable in the app.
 *
 * Duolingo's signature is not its green — it is the *chunk*: a solid, unblurred
 * bottom edge that collapses when you press, so the control reads as a physical
 * object. That matters here more than in a language app, because you are looking
 * at a phone propped several feet away while dancing. A flat button at that
 * distance is indistinguishable from a label.
 *
 * Press uses translateY rather than scale: collapsing the chunk *is* the
 * feedback, and it stays transform-only so it runs on the GPU. 110ms, because
 * button feedback belongs in the 100-160ms band — slower reads as lag at the
 * exact moment the user is watching most closely.
 *
 * Every variant is >= 44px tall. This is the control that used to be ~100 raw
 * button elements with hand-rolled padding, half of them under the touch
 * minimum.
 */

type Variant = "primary" | "secondary" | "quiet" | "danger" | "ink" | "stage";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, { face: string; chunk: string; text: string }> = {
  primary:   { face: "bg-duo-green", chunk: "shadow-chunk-green", text: "text-white" },
  secondary: { face: "bg-duo-blue",  chunk: "shadow-chunk-blue",  text: "text-white" },
  quiet:     { face: "bg-white",     chunk: "shadow-chunk-quiet", text: "text-ink" },
  danger:    { face: "bg-duo-red",   chunk: "shadow-chunk-red",   text: "text-white" },
  /**
   * Neutral commit on paper — "Log in", "Continue". A form's submit button is
   * not the same promise as "Start practising", and colouring both green makes
   * neither read as the primary action on its own screen.
   */
  ink:       { face: "bg-ink",       chunk: "shadow-chunk-ink",   text: "text-white" },
  /** The same object, sitting on the dark stage instead of on paper. */
  stage:     { face: "bg-stage-raised border border-stage-edge", chunk: "shadow-chunk-stage", text: "text-stage-text" },
};

const SIZE: Record<Size, string> = {
  // min-h rather than h: the chunk lives outside the box, and text must be able
  // to wrap on a 320px viewport without clipping. 44px is the floor at every
  // size — `sm` buys horizontal room, never a smaller target.
  sm: "min-h-[44px] px-3.5 text-hud",
  md: "min-h-[44px] px-5 text-sm",
  lg: "min-h-[56px] px-7 text-base",
};

interface Props {
  children:   ReactNode;
  onClick?:   () => void;
  href?:      string;
  type?:      "button" | "submit";
  variant?:   Variant;
  size?:      Size;
  disabled?:  boolean;
  /** Stretch to the container. Forms want this; toolbars never do. */
  block?:     boolean;
  className?: string;
  ariaLabel?: string;
}

export default function Pressable({
  children,
  onClick,
  href,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  block = false,
  className = "",
  ariaLabel,
}: Props) {
  const v = VARIANT[variant];

  const classes = [
    block ? "flex w-full" : "inline-flex",
    "select-none items-center justify-center gap-2",
    "rounded-2xl font-extrabold tracking-tight",
    SIZE[size],
    v.face,
    v.text,
    v.chunk,
    // The press: drop by the chunk height and remove the chunk, so the face
    // lands exactly where the chunk was. No net layout shift.
    "transition-[transform,box-shadow] duration-[110ms] ease-out-strong",
    "active:translate-y-[4px] active:shadow-none",
    // Hover only where hovering is real; touch fires hover on tap.
    "[@media(hover:hover)and(pointer:fine)]:hover:brightness-[1.06]",
    "motion-reduce:transition-none motion-reduce:active:translate-y-0",
    // Keyboard focus has to survive on both grounds, so the ring is offset off
    // the face rather than tinted to match it.
    "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue focus-visible:ring-offset-2",
    disabled ? "pointer-events-none opacity-40" : "",
    className,
  ].join(" ");

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  );
}
