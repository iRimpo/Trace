import type { BeatCue } from "./cueScript";
import type { PoseFrame } from "./poseRecorder";

/**
 * Scoring a cue against what the dancer actually did.
 *
 * This used to run inside the Trace overlay's render loop, and it was the one
 * thing keeping that overlay from being fully precomputed: verdicts came from
 * the live webcam, were cached per cue id, and only cleared on backward seeks,
 * so skipping forward showed stale hit/miss marks over the reference video.
 *
 * Trace is now purely instructional. Judging belongs to the Test tab, which
 * does not consume this yet — it is kept and tested so that wiring it up is a
 * self-contained piece of work rather than a rewrite.
 */

const HIT_RATIO = 0.4;
const PARTIAL_RATIO = 0.15;
export const JUDGE_TOLERANCE_MS = 300;

/**
 * Judge one cue against the user's recorded pose frames.
 * Frame times (`t`) are milliseconds on the same clock as the reference
 * video (practice keeps them in sync). Magnitudes are compared normalized
 * by each video's height so camera resolution doesn't skew scoring.
 */
export function judgeCue(
  cue: BeatCue,
  refVideoHeight: number,
  userFrames: PoseFrame[],
  userVideoHeight: number,
  toleranceMs: number = JUDGE_TOLERANCE_MS,
): "hit" | "partial" | "miss" {
  const centerMs = cue.time * 1000;
  const inWindow = userFrames.filter(
    f => Math.abs(f.t - centerMs) <= toleranceMs && f.kps[cue.jointIndex],
  );
  if (inWindow.length < 2) return "miss";

  // Max travel of the cue's joint across the window, normalized by height
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of inWindow) {
    const [x, y, score] = f.kps[cue.jointIndex];
    if ((score ?? 0) < 0.2) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return "miss";

  const userTravel = Math.hypot(maxX - minX, maxY - minY) / userVideoHeight;
  const refTravel = cue.magnitude / refVideoHeight;
  if (refTravel <= 0) return "hit";

  const ratio = userTravel / refTravel;
  if (ratio >= HIT_RATIO) return "hit";
  if (ratio >= PARTIAL_RATIO) return "partial";
  return "miss";
}
