/**
 * How a sync score is coloured, in one place.
 *
 * `scoreColor()` used to be copy-pasted into `SongCard` and `ProgressGraph`,
 * each returning raw hex (`#10B981`, `#EAB308`, `#EF4444`) into an inline
 * `style`, which is both a palette that cannot be changed in one edit and six
 * of the repo's scanned hex budget.
 *
 * Three bands, not four. The old fourth band borrowed `cue.elbow` — a *joint*
 * colour — for a UI meaning, which is exactly the reuse the design system
 * forbids: orange has to keep meaning "elbow" on the practice overlay.
 *
 * Only fills are exported, never text colours. `duo-gold` is a signal colour
 * chosen to be seen from across a room, and at 4.5:1 it is not a body-text
 * colour. Every number in the dashboard is drawn in `ink`, and the bar beside
 * it carries the band — so the score stays readable and the colour stays
 * glanceable.
 */

export type ScoreBand = "green" | "gold" | "red";

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "green";
  if (score >= 55) return "gold";
  return "red";
}

/** Solid fill for meters and bars. */
export const BAND_FILL: Record<ScoreBand, string> = {
  green: "bg-duo-green",
  gold:  "bg-duo-gold",
  red:   "bg-duo-red",
};

/** Tinted plate behind a band, for chips and callouts. */
export const BAND_SOFT: Record<ScoreBand, string> = {
  green: "bg-duo-green/10",
  gold:  "bg-duo-gold/15",
  red:   "bg-duo-red/10",
};

/** What the band means, in words, for anyone who cannot use the colour. */
export const BAND_LABEL: Record<ScoreBand, string> = {
  green: "Strong",
  gold:  "Getting there",
  red:   "Needs work",
};
