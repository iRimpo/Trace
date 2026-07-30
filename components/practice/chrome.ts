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
