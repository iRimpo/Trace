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
  /**
   * Extra classes on the input itself. Deliberately narrow: this exists for
   * fields where the *characters* matter individually — an invite code wants
   * `font-mono tracking-[0.2em] uppercase` — not as a general escape hatch back
   * to hand-rolled inputs. The border, radius, padding and states stay owned
   * here, so `inputClassName` cannot reintroduce the divergence Field removed.
   */
  inputClassName?: string;
}

const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, action, trailing, error, inputClassName = "", id, ...input },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;

  /**
   * The error id has to *join* whatever the caller passed, not replace it.
   * Overwriting it meant a password-requirements list sitting right under the
   * input was visible but never announced as its description — the caller had
   * no way to associate it.
   */
  const describedBy = [input["aria-describedby"], error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

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
          aria-describedby={describedBy}
          className={[
            "w-full rounded-2xl border-2 bg-white px-4 py-3 text-sm font-medium text-ink",
            "placeholder-ink/25 outline-none transition-ui duration-150",
            trailing ? "pr-12" : "",
            inputClassName,
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
