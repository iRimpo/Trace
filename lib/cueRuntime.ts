import type { ChoreoTimeline, TimelineEntry } from "./choreoTimeline";
import type { PoseFrame } from "./poseRecorder";

/**
 * Deterministic, anticipatory cue playback — the practice-time half of the
 * cue engine. The timeline already decided *what* and *when* (scan time);
 * this class only answers "which cues are visible at video time T, in what
 * state". Rhythm-game model: a cue appears leadMs BEFORE its moment so the
 * dancer can anticipate, stays active through a short window, then resolves
 * to hit/partial/miss. Pure function of video time → seek- and loop-safe.
 */

export type CueState = "upcoming" | "active" | "hit" | "partial" | "miss";

export interface RuntimeCue {
  entry: TimelineEntry;
  state: CueState;
  /** 0→1 through the lead-in window; clamped to 1 once the moment arrives. */
  progress: number;
}

export const DEFAULT_LEAD_MS = 600;
const DEFAULT_ACTIVE_MS = 700;
/** Resolved cues linger briefly so hit/miss feedback registers. */
const RESOLVED_LINGER_MS = 400;

export class CueRuntime {
  private readonly entries: TimelineEntry[];
  private readonly leadS: number;
  private readonly activeS: number;
  private resolutions = new Map<number, "hit" | "partial" | "miss">();

  constructor(
    timeline: ChoreoTimeline,
    opts?: { leadMs?: number; activeMs?: number },
  ) {
    this.entries = [...timeline.entries].sort((a, b) => a.time - b.time);
    this.leadS = (opts?.leadMs ?? DEFAULT_LEAD_MS) / 1000;
    this.activeS = (opts?.activeMs ?? DEFAULT_ACTIVE_MS) / 1000;
  }

  cuesAt(videoTime: number): RuntimeCue[] {
    const out: RuntimeCue[] = [];
    for (const entry of this.entries) {
      const appear = entry.time - this.leadS;
      const resolved = this.resolutions.get(entry.id);
      const vanish = entry.time + this.activeS + (resolved ? RESOLVED_LINGER_MS / 1000 : 0);
      if (videoTime < appear || videoTime > vanish) continue;

      let state: CueState;
      if (resolved && videoTime >= entry.time) state = resolved;
      else if (videoTime < entry.time) state = "upcoming";
      else state = "active";

      out.push({
        entry,
        state,
        progress: Math.min(1, Math.max(0, (videoTime - appear) / this.leadS)),
      });
    }
    return out;
  }

  resolve(entryId: number, state: "hit" | "partial" | "miss"): void {
    this.resolutions.set(entryId, state);
  }

  /** Call on seek-backwards or loop restart so cues can be re-attempted. */
  resetResolutions(): void {
    this.resolutions.clear();
  }
}

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
  entry: TimelineEntry,
  refVideoHeight: number,
  userFrames: PoseFrame[],
  userVideoHeight: number,
  toleranceMs: number = JUDGE_TOLERANCE_MS,
): "hit" | "partial" | "miss" {
  const centerMs = entry.time * 1000;
  const inWindow = userFrames.filter(
    f => Math.abs(f.t - centerMs) <= toleranceMs && f.kps[entry.jointIndex],
  );
  if (inWindow.length < 2) return "miss";

  // Max travel of the cue's joint across the window, normalized by height
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of inWindow) {
    const [x, y, score] = f.kps[entry.jointIndex];
    if ((score ?? 0) < 0.2) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return "miss";

  const userTravel = Math.hypot(maxX - minX, maxY - minY) / userVideoHeight;
  const refTravel = entry.magnitude / refVideoHeight;
  if (refTravel <= 0) return "hit";

  const ratio = userTravel / refTravel;
  if (ratio >= HIT_RATIO) return "hit";
  if (ratio >= PARTIAL_RATIO) return "partial";
  return "miss";
}
