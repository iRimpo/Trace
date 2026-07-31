import { useSyncExternalStore } from "react";

/**
 * Shared layout constants for the practice screen's floating chrome.
 *
 * These exist because three separate layers each guessed at the top offset
 * independently — PracticeView's header applied a safe-area inset but centred
 * the tab bar on the padding box, TraceTab's controls used a bare `top-3` with
 * no inset at all, and the count strip used its own third value. On a Dynamic
 * Island iPhone all three landed on top of each other under the status bar.
 * One value, imported everywhere, is the fix.
 */

/**
 * Height of PracticeView's floating header: the safe-area inset plus a 3rem
 * row (32px of content, 12px bottom padding, and the grid's row gap).
 *
 * Measured, not guessed — at a 59px inset the header's bounding box ends at
 * 105px, so 2.75rem (103px) left a 2px overlap.
 *
 * Anything anchored to the top of the practice screen starts below this.
 */
export const TOP_STACK = "calc(max(0.75rem, env(safe-area-inset-top)) + 3rem)";

/** Standard bottom inset for anything anchored to the bottom edge. */
export const BOTTOM_SAFE = "max(0.5rem, env(safe-area-inset-bottom))";

/**
 * ── The top edge has two rows, not one ───────────────────────────────────
 *
 * `TOP_STACK` fixed the *vertical* offset — everything now starts below the
 * header. It does not allocate *horizontal* room, and that is a second,
 * independent bug: `CountStrip` spans `left-0 right-0` at `TOP_STACK`, and
 * TraceTab's TRACE badge (`left-3`) and utility cluster (`right-3`) sit at the
 * same offset in the same `z-30` layer. The strip renders first, so the badge
 * paints over counts 1–2 and the three utility buttons paint over counts 6–8.
 * The downbeat — the one cell actually being read from ten feet — is under the
 * wordmark. Repro: overlay mode, counts on, paused.
 *
 * The fix is a second row, not a set of horizontal lanes. Lanes were tried
 * first and are arithmetically impossible on the target device: a badge
 * (~7rem) plus three 44px buttons (~10rem) leaves 121px of a 393px screen for
 * eight count cells, or 15px each — narrower than the digit inside them. The
 * top edge simply does not have room for a badge, eight counts and a utility
 * cluster side by side, and any solution that pretends otherwise is trading a
 * visible overlap for an illegible strip.
 *
 * So the badge and the utility cluster share row one, and the count strip owns
 * row two at full width. `TOP_ROW_H` is the tallest thing row one can contain:
 * a 44px touch target plus an 8px gap.
 */

/** Height of the first row of top chrome — one 44px control plus its gap. */
export const TOP_ROW_H = "3.25rem";

/**
 * Top offset for the second row of top chrome. The count strip lives here;
 * anything else anchored to the top edge belongs in row one.
 */
export const TOP_STACK_ROW2 = `calc(${TOP_STACK} + ${TOP_ROW_H})`;

/**
 * True when the viewport is taller than it is wide.
 *
 * **The practice screen branches on this, never on a width breakpoint.** A
 * 393px-wide phone held sideways is a landscape device and wants columns; a
 * 1024px tablet held upright is a portrait device and wants rows. `sm:`/`md:`
 * cannot express that, and every squished practice layout in the app is a
 * width breakpoint applied to an orientation problem.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the media query
 * is external mutable state, and the store form is the one that cannot tear
 * or flash the wrong layout for a frame on mount.
 *
 * The server snapshot is `true` — phones are the majority of use and portrait
 * is the cheaper wrong guess, because the portrait branch is the one that
 * degrades gracefully when it is wrong (a stacked layout on a wide screen is
 * merely wasteful; a two-column layout on a narrow screen is unusable).
 *
 * This file carries no `"use client"` on purpose — it still exports plain
 * constants that any component may import. Every consumer of the hook is
 * already a client component.
 */
export function useIsPortrait(): boolean {
  return useSyncExternalStore(subscribeToOrientation, getIsPortrait, () => true);
}

function subscribeToOrientation(onChange: () => void): () => void {
  const mq = window.matchMedia(PORTRAIT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getIsPortrait(): boolean {
  return window.matchMedia(PORTRAIT_QUERY).matches;
}

const PORTRAIT_QUERY = "(orientation: portrait)";
