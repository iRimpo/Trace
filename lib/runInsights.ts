import type { ScoredFrame, ScoreRegion } from "./poseScore";

/**
 * What actually happened in a run, in sentences a dancer can act on.
 *
 * The feedback this replaces was ten fixed strings keyed on region and band —
 * "Left arm almost there — pay attention to how fully you extend on the
 * downbeats." It is not wrong, but it is the same sentence on your first run
 * and your fortieth, it never mentions anything you did, and every weak arm
 * gets it regardless of *how* the arm was weak.
 *
 * The app now knows more than that. It has a score per frame with a timestamp,
 * so it can tell the difference between the two situations that matter most,
 * and which need opposite advice:
 *
 * - **Spiky.** 90 for most of the run and 40 for six seconds. You know the
 *   choreography; there is one transition you have not learned. The action is
 *   to loop those six seconds, and the app can hand you the timestamp.
 * - **Steady.** 65 the whole way through. Nothing is broken in one place —
 *   the move itself is not in your body yet. Looping a section will not help;
 *   slowing the whole thing down will.
 *
 * Telling someone to "drill the weakest bar" when their run is uniformly
 * mediocre sends them to a bar that is no worse than any other, and telling
 * someone with one bad transition that they need to slow the whole song down
 * wastes their session. That distinction is the point of this module.
 *
 * Everything here is pure and takes plain data, so the thresholds can be
 * argued with in a test rather than discovered on stage.
 */

export type RunShape =
  /** Loss concentrated in one stretch — drill that stretch. */
  | "spiky"
  /** Loss spread evenly — drill the move, slower. */
  | "steady"
  /** Second half notably worse — stamina, or the back half is less learned. */
  | "fading"
  /** First half notably worse — slow to settle into it. */
  | "warming"
  /** Not enough frames to say anything honest. */
  | "unknown";

export interface Finding {
  kind: "shape" | "region" | "coverage" | "strength";
  /** One sentence, second person, no jargon. */
  text: string;
  /** Where in the run it refers to, if anywhere. */
  atMs?: number;
}

/** Fewer than this and any shape claim is noise. */
const MIN_FRAMES_FOR_SHAPE = 12;

/** A window must be this far below the typical window to count as a spike. */
const SPIKE_GAP = 15;

/** Half-to-half difference that counts as fading or warming. */
const HALF_GAP = 8;

/** Default window for "where did it go wrong" — about two bars at 120bpm. */
export const WINDOW_MS = 4000;

export interface Window {
  startMs: number;
  endMs: number;
  score: number;
}

/** Split the run into fixed windows and average each. Empty windows are dropped. */
export function windows(frames: ScoredFrame[], windowMs = WINDOW_MS): Window[] {
  if (frames.length === 0 || windowMs <= 0) return [];
  const end = frames[frames.length - 1].t;
  const out: Window[] = [];
  for (let start = 0; start <= end; start += windowMs) {
    const stop = start + windowMs;
    const inWin = frames.filter(f => f.t >= start && f.t < stop);
    if (inWin.length === 0) continue;
    out.push({
      startMs: start,
      endMs: stop,
      score: Math.round(inWin.reduce((s, f) => s + f.score, 0) / inWin.length),
    });
  }
  return out;
}

/** The lowest-scoring window, or null when there is nothing to say. */
export function worstWindow(frames: ScoredFrame[], windowMs = WINDOW_MS): Window | null {
  const w = windows(frames, windowMs);
  if (w.length === 0) return null;
  return w.reduce((a, b) => (b.score < a.score ? b : a));
}

function mean(ns: number[]): number {
  return ns.length === 0 ? 0 : ns.reduce((a, b) => a + b, 0) / ns.length;
}

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The shape of the run.
 *
 * Spiky wins over fading/warming when both apply: a specific timestamp to
 * drill is more actionable than a general observation about the back half.
 */
export function runShape(frames: ScoredFrame[], windowMs = WINDOW_MS): RunShape {
  if (frames.length < MIN_FRAMES_FOR_SHAPE) return "unknown";
  const w = windows(frames, windowMs);
  if (w.length < 3) return "unknown";

  const scores = w.map(x => x.score);
  const worst = Math.min(...scores);
  if (median(scores) - worst >= SPIKE_GAP) return "spiky";

  const half = Math.floor(w.length / 2);
  const first = mean(scores.slice(0, half));
  const second = mean(scores.slice(w.length - half));
  if (first - second >= HALF_GAP) return "fading";
  if (second - first >= HALF_GAP) return "warming";

  return "steady";
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const REGION_NAME: Record<ScoreRegion, string> = {
  torso: "core", leftArm: "left arm", rightArm: "right arm",
  leftLeg: "left leg", rightLeg: "right leg",
};

export interface SummaryInput {
  frames: ScoredFrame[];
  regions: Record<ScoreRegion, number>;
  overall: number | null;
  coverage: number;
}

/**
 * Up to three findings, most actionable first.
 *
 * Deliberately few. A list of five things to fix is a list nobody acts on, and
 * the point of a practice tool is that you leave it knowing the one thing to
 * do next.
 */
export function summariseRun(input: SummaryInput): Finding[] {
  const { frames, regions, overall, coverage } = input;
  const out: Finding[] = [];

  if (overall === null || frames.length === 0) return out;

  // Coverage leads when it is bad, because it changes how much the rest means.
  if (coverage < 0.6) {
    out.push({
      kind: "coverage",
      text: `Only ${Math.round(coverage * 100)}% of this run could be scored, so treat the number as rough — step back until your whole body is in frame.`,
    });
  }

  const shape = runShape(frames);
  const worst = worstWindow(frames);

  if (shape === "spiky" && worst) {
    out.push({
      kind: "shape",
      atMs: worst.startMs,
      text: `Most of what you lost is in one place — ${fmt(worst.startMs)}–${fmt(worst.endMs)} scored ${worst.score}. Loop just that and the rest of the run is already there.`,
    });
  } else if (shape === "fading") {
    out.push({
      kind: "shape",
      text: "You start stronger than you finish. That is usually the back half being less rehearsed rather than tiredness — drill from the middle out.",
    });
  } else if (shape === "warming") {
    out.push({
      kind: "shape",
      text: "The opening costs you the most and it improves as you go. Use the count-in and start with the first eight already in your head.",
    });
  } else if (shape === "steady" && overall < 80) {
    out.push({
      kind: "shape",
      text: "The gap is spread evenly rather than sitting in one spot, which usually means the move itself rather than one transition. Slow the reference to 0.5× and take it in pieces.",
    });
  }

  // The single weakest region, named, with what it is relative to the rest.
  const valid = (Object.keys(regions) as ScoreRegion[]).filter(r => regions[r] >= 0);
  if (valid.length >= 2) {
    const sorted = [...valid].sort((a, b) => regions[a] - regions[b]);
    const weakest = sorted[0];
    const rest = mean(sorted.slice(1).map(r => regions[r]));
    if (rest - regions[weakest] >= 10) {
      out.push({
        kind: "region",
        text: `Your ${REGION_NAME[weakest]} is the outlier at ${regions[weakest]}, against ${Math.round(rest)} for everything else. That is the one to isolate.`,
      });
    } else if (overall >= 80) {
      out.push({
        kind: "strength",
        text: `Nothing stands out as weak — your lowest region is ${REGION_NAME[weakest]} at ${regions[weakest]}, and the rest is close behind. Push tempo rather than accuracy next.`,
      });
    }
  }

  return out.slice(0, 3);
}
