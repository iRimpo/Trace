/**
 * Brand colours for contexts Tailwind classes cannot reach — SVG attributes,
 * canvas, inline style objects, and data structures that carry a colour.
 *
 * `tailwind.config.ts` mirrors these for class usage (`bg-brand-primary`);
 * this module is the source for everywhere else. The split matters: before it
 * existed, `#080808` appeared as a literal in 76 places across components, so
 * changing the app's primary meant finding every copy and the casing drifted.
 *
 * The cue colours live in [lib/cuePalette.ts] — they are a different system
 * with their own semantics, and merging them would invite using a body-region
 * colour as chrome.
 */
export const BRAND = {
  /** The near-black everything actionable is drawn in. */
  primary: "#080808",
  /** Hover/raised variant of primary. */
  accent:  "#1a1a1a",
  /** Page background. */
  cream:   "#f8f4e0",
  /** Warm near-black used for text on cream. */
  ink:     "#1a0f00",
  /** Secondary brown for supporting copy. */
  clay:    "#5c3d1a",
  white:   "#ffffff",
} as const;

/**
 * Duolingo-structure action palette. Each pressable colour pairs with the
 * darker shade used as its bottom chunk — see components/ui/Pressable.tsx.
 */
export const ACTION = {
  green:     "#58CC02",
  greenDark: "#43A302",
  blue:      "#1CB0F6",
  blueDark:  "#1899D6",
  gold:      "#FFC800",
  goldDark:  "#E5A600",
  red:       "#FF4B4B",
  redDark:   "#E23A3A",
  edge:      "#E0DCC8",
} as const;
