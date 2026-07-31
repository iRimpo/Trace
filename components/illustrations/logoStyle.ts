import { BRAND, STAGE } from "@/lib/brandTokens";

/**
 * Trace character style — LINE DRAWING with consistent thick stroke.
 *
 * Style: Clean, simple, continuous flowing lines
 * - Head: Smooth oval OUTLINE (ellipse, white fill, black stroke)
 * - Body: Elongated oval OUTLINE (ellipse, white fill, black stroke)
 * - Neck: Short connecting line
 * - Limbs: Smooth curved LINES (path, NO fill, just stroke)
 * - Stroke: Consistent 10px throughout everything
 * - Eyes: Simple filled black circles
 *
 * ViewBox for single character: 0 0 120 200
 */

export const S = {
  // -- Stroke (consistent everywhere) --
  sw: 10,
  color: "black",
  fill: "white",
  cap: "round" as const,

  // -- Head (oval) --
  headCx: 60,
  headCy: 35,
  headRx: 24,
  headRy: 32,

  // -- Eyes --
  eyeR: 5,
  eyeLx: 52,
  eyeRx: 68,
  eyeY: 30,

  // -- Neck --
  neckX: 60,
  neckY1: 67,
  neckY2: 75,

  // -- Body (elongated oval) --
  bodyCx: 60,
  bodyCy: 115,
  bodyRx: 26,
  bodyRy: 42,

  // -- Arm attachment points --
  armLx: 38,
  armRx: 82,
  armY: 90,

  // -- Leg attachment points --
  legLx: 48,
  legRx: 72,
  legY: 155,

  // -- ViewBox --
  vw: 120,
  vh: 200,
} as const;

/** Scale map for component sizes */
export const SCALES: Record<string, number> = {
  sm: 0.5,
  md: 0.8,
  lg: 1,
  xl: 1.5,
};

export function dims(size: string) {
  const sc = SCALES[size] ?? 1;
  return { w: S.vw * sc, h: S.vh * sc };
}


/**
 * Which ground the character is standing on.
 *
 * The art is black line-work with white fills, which is correct on *paper* and
 * invisible on the *stage*: black strokes on a #0B0B0C card leave nothing but
 * the white head and body floating as unattached blobs. Same failure as the
 * TRACE badge drawing its mark in the paper ink colour over a camera feed.
 *
 * So stroke and eyes are `currentColor` and the fills read a CSS variable, and
 * a tone sets both. Two values, one per ground, rather than a colour prop that
 * every call site guesses at.
 */
export type CharacterTone = "paper" | "stage";

export function toneStyle(tone: CharacterTone): React.CSSProperties {
  const t = tone === "stage"
    ? { color: STAGE.text, fill: STAGE.base }
    : { color: BRAND.primary, fill: BRAND.white };
  return { color: t.color, ["--character-fill" as string]: t.fill } as React.CSSProperties;
}
