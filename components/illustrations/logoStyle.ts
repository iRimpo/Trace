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
