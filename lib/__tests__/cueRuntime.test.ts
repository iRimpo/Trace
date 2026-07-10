import { describe, it, expect } from "vitest";
import { CueRuntime, judgeCue } from "../cueRuntime";
import type { ChoreoTimeline, TimelineEntry } from "../choreoTimeline";
import { SCAN_VERSION } from "../choreoTimeline";
import type { PoseFrame } from "../poseRecorder";

function entry(over: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: 0, time: 5, rawTime: 5, count: 1, measureIndex: 0, accent: "downbeat",
    type: "move", jointIndex: 15, jointName: "L Wrist",
    x: 100, y: 100, anchorX: 60, anchorY: 100, dx: 40, dy: 0, magnitude: 72,
    ...over,
  };
}

function timeline(entries: TimelineEntry[]): ChoreoTimeline {
  return { version: SCAN_VERSION, bpm: 120, beatOneOffset: 0, videoHeight: 720, entries };
}

describe("CueRuntime.cuesAt", () => {
  it("shows a cue exactly leadMs before its moment, not earlier", () => {
    const rt = new CueRuntime(timeline([entry({ id: 0, time: 5 })]), { leadMs: 600 });
    expect(rt.cuesAt(4.39)).toHaveLength(0);
    const cues = rt.cuesAt(4.41);
    expect(cues).toHaveLength(1);
    expect(cues[0].state).toBe("upcoming");
  });

  it("ramps progress 0→1 across the lead window", () => {
    const rt = new CueRuntime(timeline([entry({ id: 0, time: 5 })]), { leadMs: 600 });
    expect(rt.cuesAt(4.4)[0].progress).toBeCloseTo(0, 1);
    expect(rt.cuesAt(4.7)[0].progress).toBeCloseTo(0.5, 1);
    expect(rt.cuesAt(5.0)[0].progress).toBeCloseTo(1, 5);
  });

  it("marks the cue active during its active window and drops it after", () => {
    const rt = new CueRuntime(timeline([entry({ id: 0, time: 5 })]), { leadMs: 600, activeMs: 700 });
    expect(rt.cuesAt(5.3)[0].state).toBe("active");
    expect(rt.cuesAt(6.5)).toHaveLength(0);
  });

  it("is deterministic across repeated and out-of-order calls (seek-safe)", () => {
    const rt = new CueRuntime(timeline([entry({ id: 0, time: 5 })]), { leadMs: 600 });
    const a = rt.cuesAt(4.8)[0].progress;
    rt.cuesAt(9);
    rt.cuesAt(0);
    const b = rt.cuesAt(4.8)[0].progress;
    expect(b).toBe(a);
  });

  it("shows resolved state instead of active once resolved", () => {
    const rt = new CueRuntime(timeline([entry({ id: 0, time: 5 })]), { leadMs: 600 });
    rt.resolve(0, "hit");
    expect(rt.cuesAt(5.2)[0].state).toBe("hit");
  });

  it("resetResolutions clears results for loop restarts", () => {
    const rt = new CueRuntime(timeline([entry({ id: 0, time: 5 })]), { leadMs: 600 });
    rt.resolve(0, "miss");
    rt.resetResolutions();
    expect(rt.cuesAt(5.2)[0].state).toBe("active");
  });

  it("returns multiple overlapping cues sorted by time", () => {
    const rt = new CueRuntime(
      timeline([entry({ id: 0, time: 5.2 }), entry({ id: 1, time: 5.0, jointIndex: 16 })]),
      { leadMs: 600 },
    );
    const cues = rt.cuesAt(4.9);
    expect(cues.map(c => c.entry.id)).toEqual([1, 0]);
  });
});

describe("judgeCue", () => {
  // Reference: magnitude 72px of 720px height → 10% of frame.
  // User video 1000px tall → hit needs ≥40% of 100px = 40px joint travel.
  const e = entry({ time: 5, magnitude: 72 });

  function frames(travelPx: number): PoseFrame[] {
    const mk = (t: number, x: number): PoseFrame => ({
      t,
      kps: new Array(33).fill(null).map(() => [x, 500, 0.9]),
    });
    return [mk(4800, 100), mk(5000, 100 + travelPx / 2), mk(5200, 100 + travelPx)];
  }

  it("hits when user joint travel ≥ 40% of reference (normalized)", () => {
    expect(judgeCue(e, 720, frames(45), 1000)).toBe("hit");
  });
  it("partial between 15% and 40%", () => {
    expect(judgeCue(e, 720, frames(20), 1000)).toBe("partial");
  });
  it("misses below 15%", () => {
    expect(judgeCue(e, 720, frames(5), 1000)).toBe("miss");
  });
  it("misses when no frames fall inside the tolerance window", () => {
    const far: PoseFrame[] = [
      { t: 1000, kps: new Array(33).fill(null).map(() => [100, 500, 0.9]) },
    ];
    expect(judgeCue(e, 720, far, 1000)).toBe("miss");
  });
});
