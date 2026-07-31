/**
 * Drill mode — the bounded, repeatable practice unit.
 *
 * This is how dancers actually learn a section: watch it, try it, watch it,
 * try it, without touching anything in between. Trace already had every
 * primitive for it — A/B loop points, loop enforcement, `[`/`]`/`L` keybinds,
 * a count grid — and no mode that assembled them. You could loop a section,
 * but looping is not drilling: looping gives you the same thing over and over,
 * while drilling alternates *seeing* it with *doing* it.
 *
 * It is also the most Duolingo-shaped thing in the app. A Duolingo lesson is a
 * bounded, repeatable, countable unit of practice, and that is exactly what a
 * rep is here. It is hands-free by construction, which matters more than
 * anything else: it is the only feature in the app that runs a whole practice
 * session without the phone being touched once.
 *
 * ── Why this file is pure ────────────────────────────────────────────────
 *
 * The runtime is a video clock, a rAF loop and React state. The *rules* — what
 * phase am I in, which rep is this, when does it change — are arithmetic, and
 * arithmetic is the part that is worth being certain about. Keeping them
 * separable means the off-by-one that would show up as "it said rep 2 twice"
 * is a unit test rather than a thing you find while dancing.
 */

export type DrillPhase = "watch" | "dance";

export interface DrillConfig {
  /** Consecutive passes spent watching the reference before dancing. */
  watchPasses: number;
  /** Consecutive passes spent dancing with the ghost. */
  dancePasses: number;
}

export const DEFAULT_DRILL: DrillConfig = { watchPasses: 1, dancePasses: 1 };

/**
 * Which phase pass `n` (0-based) falls in.
 *
 * The cycle is `watchPasses` watches then `dancePasses` dances, repeating. A
 * config with zero of either degrades to "always the other one" rather than
 * dividing by zero — a drill that is all dancing is a legitimate thing to want
 * once you know the section, and it should not be an error state.
 */
export function phaseForPass(n: number, config: DrillConfig = DEFAULT_DRILL): DrillPhase {
  const watch = Math.max(0, Math.floor(config.watchPasses));
  const dance = Math.max(0, Math.floor(config.dancePasses));
  if (watch === 0 && dance === 0) return "dance";
  if (watch === 0) return "dance";
  if (dance === 0) return "watch";
  const cycle = watch + dance;
  return ((n % cycle) + cycle) % cycle < watch ? "watch" : "dance";
}

/**
 * How many *dance* passes have been completed at the start of pass `n`.
 *
 * The rep counter counts dances, not passes. Watching is preparation; the rep
 * is the thing you did. A counter that ticked on watches would tell you you
 * had done twice the work you had.
 */
export function repsCompleted(n: number, config: DrillConfig = DEFAULT_DRILL): number {
  const watch = Math.max(0, Math.floor(config.watchPasses));
  const dance = Math.max(0, Math.floor(config.dancePasses));
  if (dance === 0) return 0;
  if (watch === 0) return Math.max(0, Math.floor(n));
  const cycle = watch + dance;
  const clamped = Math.max(0, Math.floor(n));
  const whole = Math.floor(clamped / cycle);
  const within = clamped % cycle;
  return whole * dance + Math.max(0, within - watch);
}

/** Human label for the phase, in the second person the rest of the app uses. */
export function phaseLabel(phase: DrillPhase): string {
  return phase === "watch" ? "Watch" : "Dance";
}

/**
 * Whether the section is long enough to drill.
 *
 * Below ~2s a pass is over before a count-in finishes and the mode becomes a
 * stutter rather than a drill, so the UI offers it as unavailable rather than
 * letting it thrash.
 */
export const MIN_DRILL_SECONDS = 2;

export function canDrill(loopStart: number | null, loopEnd: number | null): boolean {
  if (loopStart === null || loopEnd === null) return false;
  return loopEnd - loopStart >= MIN_DRILL_SECONDS;
}
