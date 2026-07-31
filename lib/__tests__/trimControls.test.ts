import { describe, expect, it } from "vitest";
import {
  MIN_TRIM,
  TRIM_STEP_COARSE,
  TRIM_STEP_FINE,
  clampTrim,
  trimKeyTarget,
  type TrimRange,
} from "../trimControls";

/** A 60s reference with the full range selected. */
const full = (over: Partial<TrimRange> = {}): TrimRange => ({
  start: 0,
  end: 60,
  duration: 60,
  ...over,
});

describe("clampTrim", () => {
  it("passes a legal position through untouched", () => {
    expect(clampTrim("start", 12, full())).toBe(12);
    expect(clampTrim("end", 48, full())).toBe(48);
  });

  it("holds the in-point at zero", () => {
    expect(clampTrim("start", -5, full())).toBe(0);
  });

  it("holds the out-point at the duration", () => {
    expect(clampTrim("end", 99, full())).toBe(60);
  });

  it("keeps the in-point MIN_TRIM clear of the out-point", () => {
    const r = full({ end: 10 });
    expect(clampTrim("start", 30, r)).toBe(10 - MIN_TRIM);
  });

  it("keeps the out-point MIN_TRIM clear of the in-point", () => {
    const r = full({ start: 40 });
    expect(clampTrim("end", 5, r)).toBe(40 + MIN_TRIM);
  });

  it("never shoves the other handle — the moving one yields", () => {
    const r = full({ start: 20, end: 25 });
    // Dragging the in-point far past the out-point moves only the in-point.
    expect(clampTrim("start", 90, r)).toBe(25 - MIN_TRIM);
    expect(r.end).toBe(25);
  });

  it("returns the current value for a non-finite input rather than NaN", () => {
    const r = full({ start: 3, end: 40 });
    expect(clampTrim("start", NaN, r)).toBe(3);
    expect(clampTrim("end", Infinity, r)).toBe(40);
  });
});

describe("trimKeyTarget", () => {
  const press = (key: string, shiftKey = false) => ({ key, shiftKey });

  it("ignores keys it does not own, so the modal keeps its shortcuts", () => {
    for (const key of ["Tab", "Escape", "Enter", " ", "a"]) {
      expect(trimKeyTarget(press(key), "start", full())).toBeNull();
    }
  });

  it("ignores everything before the video has a duration", () => {
    const empty = { start: 0, end: 0, duration: 0 };
    expect(trimKeyTarget(press("ArrowRight"), "start", empty)).toBeNull();
  });

  it("nudges by the fine step on a bare arrow", () => {
    const r = full({ start: 5 });
    expect(trimKeyTarget(press("ArrowRight"), "start", r)).toBe(5 + TRIM_STEP_FINE);
    expect(trimKeyTarget(press("ArrowLeft"), "start", r)).toBe(5 - TRIM_STEP_FINE);
  });

  it("treats vertical arrows as horizontal — the control is a time axis", () => {
    const r = full({ start: 5 });
    expect(trimKeyTarget(press("ArrowUp"), "start", r)).toBe(
      trimKeyTarget(press("ArrowRight"), "start", r),
    );
    expect(trimKeyTarget(press("ArrowDown"), "start", r)).toBe(
      trimKeyTarget(press("ArrowLeft"), "start", r),
    );
  });

  it("jumps by the coarse step with shift held", () => {
    const r = full({ start: 5 });
    expect(trimKeyTarget(press("ArrowRight", true), "start", r)).toBe(5 + TRIM_STEP_COARSE);
  });

  it("jumps by the coarse step on Page keys regardless of shift", () => {
    const r = full({ start: 5 });
    expect(trimKeyTarget(press("PageUp"), "start", r)).toBe(5 + TRIM_STEP_COARSE);
    expect(trimKeyTarget(press("PageDown", true), "start", r)).toBe(5 - TRIM_STEP_COARSE);
  });

  it("runs each handle to its own live limit, not to the video's edges", () => {
    const r = full({ start: 10, end: 40 });
    expect(trimKeyTarget(press("Home"), "start", r)).toBe(0);
    expect(trimKeyTarget(press("End"), "start", r)).toBe(40 - MIN_TRIM);
    expect(trimKeyTarget(press("Home"), "end", r)).toBe(10 + MIN_TRIM);
    expect(trimKeyTarget(press("End"), "end", r)).toBe(60);
  });

  it("lands on a round number after ten fine steps", () => {
    // The reason the result is rounded at all: 0.1 added ten times in binary
    // floating point is 0.9999999999999999, which would read back as noise in
    // aria-valuenow and never compare equal to a whole second.
    let value = 0;
    for (let i = 0; i < 10; i++) {
      value = trimKeyTarget(press("ArrowRight"), "start", full({ start: value }))!;
    }
    expect(value).toBe(1);
  });

  it("produces targets that clampTrim then keeps legal", () => {
    // The two functions are used together, so the contract that matters is the
    // composition: no key may ever produce a selection shorter than MIN_TRIM.
    const keys = ["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"];
    for (const which of ["start", "end"] as const) {
      for (const key of keys) {
        for (const shift of [false, true]) {
          const r = full({ start: 20, end: 20.5 }); // already at the minimum
          const target = trimKeyTarget(press(key, shift), which, r)!;
          const next = clampTrim(which, target, r);
          const start = which === "start" ? next : r.start;
          const end = which === "start" ? r.end : next;
          expect(end - start).toBeGreaterThanOrEqual(MIN_TRIM - 1e-9);
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(r.duration);
        }
      }
    }
  });
});
