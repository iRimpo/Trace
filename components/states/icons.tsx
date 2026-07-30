"use client";

/**
 * The three glyphs the state vocabulary is drawn from.
 *
 * These used to come from `react-icons/fa`, which meant the loading, error and
 * success states of this app were drawn in a different icon language from every
 * other icon in it — different stroke weight, different corner radius, filled
 * where everything else is stroked. Inline SVG at `strokeWidth 2.5` matches the
 * rest of the app's vocabulary and costs nothing to ship.
 */

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    // Reduced motion keeps the pulse rather than freezing: rotation is a
    // vestibular trigger, opacity is not, and an indicator that stops
    // indicating is worse than one that pulses.
    <svg className={`${className} animate-spin motion-reduce:animate-pulse`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V1C5.925 1 1 5.925 1 12h3z" />
    </svg>
  );
}

export function AlertIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
    </svg>
  );
}

export function CheckIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.75l5 5 10-11" />
    </svg>
  );
}
