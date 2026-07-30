"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * The one text input on paper.
 *
 * Auth had three pages hand-rolling the same `rounded-xl border border-ink/12
 * px-4 py-3` string, each with its own label markup and its own idea of what an
 * error looks like. Consolidating matters less for the pixels than for the
 * wiring: the label is bound to the input by a generated id, and the error is
 * announced rather than merely coloured, which no copy of the hand-rolled
 * version did.
 *
 * `py-3` on a 14px input is 46px tall — over the touch minimum without needing
 * an explicit height, so the field can still grow with its content.
 */

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** Rendered opposite the label — "Forgot password?", a hint, a counter. */
  action?: ReactNode;
  /** Rendered inside the field's right edge — a reveal toggle, a unit. */
  trailing?: ReactNode;
  error?: string;
}

const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, action, trailing, error, id, ...input },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-bold text-clay">
          {label}
        </label>
        {action}
      </div>

      <div className="relative">
        <input
          {...input}
          id={fieldId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={[
            "w-full rounded-2xl border-2 bg-white px-4 py-3 text-sm font-medium text-ink",
            "placeholder-ink/25 outline-none transition-ui duration-150",
            trailing ? "pr-12" : "",
            // The error border is the state, not a decoration layered on top of
            // one — so it replaces the resting border rather than adding a ring.
            error
              ? "border-duo-red focus:border-duo-red"
              : "border-duo-edge focus:border-duo-blue",
          ].join(" ")}
        />
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-duo-red">
          {error}
        </p>
      )}
    </div>
  );
});

export default Field;
