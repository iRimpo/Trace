/**
 * The motion system — every duration and spring in the app comes from here.
 *
 * Before this file there were eight spring literals across the practice
 * surfaces and no two agreed: 480/40, 420/42, 420/40, 400/35, 380/34, 380/32,
 * 420/30, 260/18. None of those differences were decisions — they were each
 * the result of somebody typing plausible numbers into a `transition` prop
 * while building something else. A sliding pill in `Segmented` and a sliding
 * pill in `TabNavigation` are the same object to the eye and they were moving
 * at visibly different rates.
 *
 * ── The bands ────────────────────────────────────────────────────────────
 *
 * `DESIGN_SYSTEM.md` §4 already states the bands in prose. This is that prose,
 * executable. The rule behind them is that duration is a function of how far
 * the eye has to travel and how much the user is waiting on the result:
 *
 *   PRESS        the finger already knows what happened; the pixels are just
 *                confirming it. Anything above ~160ms reads as lag.
 *   ENTER        something new arrived and the eye needs to find it.
 *   CROSS_SCREEN only for something traversing the whole viewport. A modal, a
 *                route, a sheet. Rare by construction.
 *   CELEBRATE    the one deliberate exception, for the score reveal. It is
 *                allowed to be slow because it is rare and it is the payoff.
 *
 * **Exits are faster than entrances.** An entrance is information arriving and
 * the eye has to catch it; an exit is information the user has already
 * finished with, and making them wait for it is the single most common way an
 * interface feels sluggish. `EXIT` is ~0.7× `ENTER`.
 *
 * ── Springs ──────────────────────────────────────────────────────────────
 *
 * Two, and only two. `SPRING_UI` is critically-ish damped — it moves and it
 * stops, with no visible overshoot, because a control that wobbles reads as
 * broken rather than playful. `SPRING_POP` has real bounce and is reserved for
 * celebration, where overshoot is the point.
 *
 * Anything the finger is dragging gets a spring, not a duration: a duration
 * cannot honour the velocity the finger handed over at release.
 *
 * ── Units ────────────────────────────────────────────────────────────────
 *
 * Framer Motion takes **seconds**; CSS and the Web Animations API take
 * **milliseconds**. Both forms are exported for each band and named so the
 * wrong one is hard to reach for by accident. `MS.PRESS` is 110, and
 * `SEC.PRESS` is 0.11.
 */

/** Durations in milliseconds — for CSS custom properties and WAAPI. */
export const MS = {
  /** 110ms. Press feedback: the button collapsing under a finger. */
  PRESS: 110,
  /** 160ms. The upper edge of the press band, for larger pressed surfaces. */
  PRESS_LARGE: 160,
  /** 220ms. Something arriving: a panel, a list item, a badge. */
  ENTER: 220,
  /** 150ms. Departures are faster than arrivals — see the note above. */
  EXIT: 150,
  /** 380ms. Only for something crossing the whole viewport. */
  CROSS_SCREEN: 380,
  /** 500ms. The score reveal, and nothing else. */
  CELEBRATE: 500,
} as const;

/** The same bands in seconds — the unit Framer Motion's `duration` expects. */
export const SEC = {
  PRESS: MS.PRESS / 1000,
  PRESS_LARGE: MS.PRESS_LARGE / 1000,
  ENTER: MS.ENTER / 1000,
  EXIT: MS.EXIT / 1000,
  CROSS_SCREEN: MS.CROSS_SCREEN / 1000,
  CELEBRATE: MS.CELEBRATE / 1000,
} as const;

/**
 * The workhorse spring. Sliding pills, sheets, drawers, anything a finger
 * drags. Settles without visible overshoot.
 */
export const SPRING_UI = { type: "spring", stiffness: 420, damping: 42 } as const;

/**
 * Snappier sibling of `SPRING_UI` for small objects travelling short
 * distances — a 32px pill inside a segmented control. Same character, less
 * mass, because a small object that moves at a large object's rate reads as
 * heavy.
 */
export const SPRING_UI_SNAPPY = { type: "spring", stiffness: 480, damping: 40 } as const;

/**
 * Celebration only. Real overshoot. Do not use this on a control — a button
 * that bounces after you press it reads as a bug, not as delight.
 */
export const SPRING_POP = { type: "spring", duration: SEC.CELEBRATE, bounce: 0.25 } as const;

/** Standard entrance transition. Pair with `RISE`. */
export const ENTER = { duration: SEC.ENTER, ease: EASE_OUT_STRONG() } as const;

/** Standard exit transition. */
export const EXIT = { duration: SEC.EXIT, ease: EASE_OUT_STRONG() } as const;

/**
 * The house easing curve, matching Tailwind's `ease-out-strong`. Strongly
 * front-loaded: most of the distance is covered in the first third, so the
 * motion reads as decisive rather than as a fade.
 *
 * These four numbers must stay identical to `transitionTimingFunction.out-strong`
 * in `tailwind.config.ts:159`. A Framer entrance and a CSS transition on the
 * same element easing differently is the kind of mismatch nobody can name but
 * everybody can see.
 *
 * A function rather than a constant because Framer mutates the arrays it is
 * handed in some code paths, and a shared frozen literal has bitten this
 * codebase's shape of bug before.
 */
export function EASE_OUT_STRONG(): [number, number, number, number] {
  return [0.23, 1, 0.32, 1];
}

/**
 * Stagger delay between siblings in a list entrance, in seconds.
 *
 * 50ms is the middle of the 40–60ms band. Below ~40ms the stagger stops being
 * legible and you have just made the list slower; above ~60ms the last item in
 * a ten-item list is arriving half a second after the first, and the user has
 * started reading before the list finished appearing.
 */
export const STAGGER_STEP = 0.05;

/**
 * Total stagger for a list, clamped. A long list must not take longer to
 * appear than a short one feels — past ~8 items the per-item delay compresses
 * so the whole entrance still lands inside `CROSS_SCREEN`.
 */
export function staggerDelay(index: number, count: number): number {
  const budget = SEC.CROSS_SCREEN;
  const step = count > 1 ? Math.min(STAGGER_STEP, budget / (count - 1)) : 0;
  return index * step;
}

/** The standard entrance offset: content rises into place. */
export const RISE = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } } as const;

/** The standard entrance offset for something dropping from the top edge. */
export const DROP = { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 } } as const;
