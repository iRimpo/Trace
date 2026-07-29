/**
 * The cue palette — one colour per body region, used by the practice overlay
 * and echoed by the marketing and onboarding illustrations so the product and
 * the pitch show the same thing.
 *
 * These seven values were previously re-declared in 13 files (139 literal
 * occurrences), with the casing drifting between `#00D4FF` and `#00d4ff`.
 * Changing a cue colour meant finding every copy, and the illustrations could
 * silently disagree with the overlay the user actually practises against.
 *
 * `tailwind.config.ts` mirrors these under `colors.cue` for class usage
 * (`text-cue-hand`); this module is the source for canvas, SVG and inline
 * styles, which cannot use Tailwind classes.
 */
export const CUE_PALETTE = {
  hand:     "#00D4FF", // Cyan     — wrists, fingers
  foot:     "#34D399", // Teal     — knees, ankles, heels, toes
  head:     "#FBBF24", // Amber    — nose/head
  elbow:    "#F97316", // Orange   — elbows
  hip:      "#A78BFA", // Purple   — hips
  shoulder: "#60A5FA", // Sky blue — shoulders
  armBoth:  "#F472B6", // Pink     — both-arms compound
  body:     "#E879F9", // Fuchsia  — torso rolls and waves
} as const;

export type CueRegion = keyof typeof CUE_PALETTE;

/**
 * Display order for legends and swatch rows.
 *
 * Deliberately excludes `body`: `CUE_COLORS` derives from this order and feeds
 * decorative swatch sequences in onboarding and marketing, where an eighth dot
 * would be an unrelated visual change.
 */
export const CUE_ORDER: readonly CueRegion[] = [
  "hand", "foot", "head", "elbow", "hip", "shoulder", "armBoth",
] as const;

/** Human-readable labels, for legends in onboarding and marketing. */
export const CUE_LABELS: Record<CueRegion, string> = {
  hand:     "Hands",
  foot:     "Feet",
  head:     "Head",
  elbow:    "Elbows",
  hip:      "Hips",
  shoulder: "Shoulders",
  armBoth:  "Arms",
  body:     "Body",
};

/** Flat list in display order — for decorative swatch/dot sequences. */
export const CUE_COLORS: readonly string[] = CUE_ORDER.map(r => CUE_PALETTE[r]);
