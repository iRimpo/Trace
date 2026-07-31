/**
 * Trim-handle semantics for the calibration step.
 *
 * This is pure arithmetic deliberately kept out of `CalibrationModal`: the
 * clamp had been written out three times inside that component's pointer
 * handlers, and adding a keyboard path would have made it five. One set of
 * rules, one place, and — because it is pure — actually testable, which a
 * closure over component state was not.
 */

/** The shortest selection the trim step allows, in seconds. */
export const MIN_TRIM = 0.5;
/** Arrow key. Small enough to land on a beat, large enough to feel. */
export const TRIM_STEP_FINE = 0.1;
/** Shift+arrow, PageUp/PageDown. */
export const TRIM_STEP_COARSE = 1;

export type TrimHandle = "start" | "end";

export interface TrimRange {
  start: number;
  end: number;
  duration: number;
}

/**
 * Snap a proposed handle position into the legal range.
 *
 * The two handles constrain each other rather than being clamped to the video:
 * the in-point may not come within `MIN_TRIM` of the out-point, and vice versa.
 * Whichever handle is moving yields, so dragging one never shoves the other.
 */
export function clampTrim(which: TrimHandle, seconds: number, range: TrimRange): number {
  const { start, end, duration } = range;
  if (!isFinite(seconds)) return which === "start" ? start : end;

  return which === "start"
    ? Math.max(0, Math.min(seconds, end - MIN_TRIM))
    : Math.min(duration, Math.max(seconds, start + MIN_TRIM));
}

/**
 * Where a keystroke wants to put a handle, or `null` if the key is not ours.
 *
 * `null` matters: the component only calls `preventDefault` when this returns a
 * number, so Tab, Escape and the modal's own shortcuts still work while a thumb
 * holds focus.
 *
 * Home/End run to each handle's *live* limit rather than to 0 and duration, so
 * `MIN_TRIM` stays an invariant the user cannot fight instead of a wall they
 * hit. The result is rounded to centiseconds: ten 0.1 steps must land on 1.0,
 * not 0.9999…, or `aria-valuenow` reads back float noise.
 */
export function trimKeyTarget(
  event: { key: string; shiftKey: boolean },
  which: TrimHandle,
  range: TrimRange,
): number | null {
  const { start, end, duration } = range;
  if (duration <= 0) return null;

  const current = which === "start" ? start : end;
  const step = event.shiftKey ? TRIM_STEP_COARSE : TRIM_STEP_FINE;
  let next: number;

  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      next = current - step;
      break;
    case "ArrowRight":
    case "ArrowUp":
      next = current + step;
      break;
    case "PageDown":
      next = current - TRIM_STEP_COARSE;
      break;
    case "PageUp":
      next = current + TRIM_STEP_COARSE;
      break;
    case "Home":
      next = which === "start" ? 0 : start + MIN_TRIM;
      break;
    case "End":
      next = which === "start" ? end - MIN_TRIM : duration;
      break;
    default:
      return null;
  }

  return Math.round(next * 100) / 100;
}
