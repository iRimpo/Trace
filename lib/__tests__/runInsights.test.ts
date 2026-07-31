import { describe, it, expect } from "vitest";
import { windows, worstWindow, runShape, summariseRun, WINDOW_MS } from "@/lib/runInsights";
import type { ScoredFrame, ScoreRegion } from "@/lib/poseScore";

/** `seconds` of frames at 15fps, scored by a function of the second. */
function run(seconds: number, at: (sec: number) => number): ScoredFrame[] {
  const out: ScoredFrame[] = [];
  for (let i = 0; i < seconds * 15; i++) {
    const t = Math.round((i / 15) * 1000);
    out.push({ t, score: at(t / 1000) });
  }
  return out;
}

const REGIONS = (o: Partial<Record<ScoreRegion, number>>): Record<ScoreRegion, number> => ({
  torso: -1, leftArm: -1, rightArm: -1, leftLeg: -1, rightLeg: -1, ...o,
});

describe("windows", () => {
  it("averages each window and drops empty ones", () => {
    const w = windows(run(12, () => 80));
    expect(w.length).toBeGreaterThan(0);
    for (const x of w) expect(x.score).toBe(80);
  });

  it("returns nothing for no frames", () => {
    expect(windows([])).toEqual([]);
  });
});

describe("worstWindow", () => {
  it("finds the stretch where the run falls apart", () => {
    // Strong throughout except 8s–12s.
    const frames = run(30, s => (s >= 8 && s < 12 ? 35 : 90));
    const w = worstWindow(frames)!;
    expect(w.score).toBeLessThan(50);
    expect(w.startMs).toBeGreaterThanOrEqual(8000 - WINDOW_MS);
    expect(w.startMs).toBeLessThanOrEqual(12000);
  });

  it("returns null with no frames", () => {
    expect(worstWindow([])).toBeNull();
  });
});

describe("runShape", () => {
  it("calls a short run unknown rather than guessing", () => {
    expect(runShape(run(0.5, () => 50))).toBe("unknown");
  });

  it("detects a spike", () => {
    expect(runShape(run(40, s => (s >= 20 && s < 26 ? 30 : 92)))).toBe("spiky");
  });

  it("detects an even run", () => {
    // Small wobble, no spike, no drift.
    expect(runShape(run(40, s => 68 + ((Math.round(s) % 3) - 1) * 2))).toBe("steady");
  });

  it("detects fading", () => {
    expect(runShape(run(40, s => (s < 20 ? 85 : 68)))).toBe("fading");
  });

  it("detects warming up", () => {
    expect(runShape(run(40, s => (s < 20 ? 66 : 85)))).toBe("warming");
  });

  it("prefers a spike over a half-difference — a timestamp beats an observation", () => {
    // Fades AND has a spike; the spike is the actionable one.
    const frames = run(40, s => (s >= 30 && s < 34 ? 20 : s < 20 ? 88 : 74));
    expect(runShape(frames)).toBe("spiky");
  });
});

describe("summariseRun", () => {
  const base = { coverage: 1 };

  it("says nothing when there is no score", () => {
    expect(summariseRun({ ...base, frames: [], regions: REGIONS({}), overall: null })).toEqual([]);
  });

  it("leads with coverage when most of the run was not seen", () => {
    const out = summariseRun({
      frames: run(30, () => 70), regions: REGIONS({ torso: 70 }), overall: 70, coverage: 0.3,
    });
    expect(out[0].kind).toBe("coverage");
    expect(out[0].text).toContain("30%");
  });

  it("hands back a timestamp for a spiky run", () => {
    const out = summariseRun({
      ...base,
      frames: run(40, s => (s >= 20 && s < 26 ? 30 : 92)),
      regions: REGIONS({ torso: 80, leftArm: 82 }),
      overall: 84,
    });
    const shape = out.find(f => f.kind === "shape")!;
    expect(shape.atMs).toBeGreaterThan(0);
    expect(shape.text).toMatch(/\d:\d\d/);
  });

  /**
   * The distinction the old copy could not make: a uniformly mediocre run and
   * a run with one bad transition need opposite advice, and telling someone to
   * "drill the weakest bar" when every bar is equally weak wastes a session.
   */
  it("gives opposite advice for a steady run and a spiky one", () => {
    const spiky = summariseRun({
      ...base, frames: run(40, s => (s >= 20 && s < 26 ? 30 : 92)),
      regions: REGIONS({ torso: 80 }), overall: 84,
    }).find(f => f.kind === "shape")!.text;

    const steady = summariseRun({
      ...base, frames: run(40, () => 66),
      regions: REGIONS({ torso: 66 }), overall: 66,
    }).find(f => f.kind === "shape")!.text;

    expect(spiky).toMatch(/loop/i);
    expect(steady).toMatch(/slow/i);
    expect(spiky).not.toBe(steady);
  });

  it("names the outlier region only when it really is an outlier", () => {
    const withOutlier = summariseRun({
      ...base, frames: run(30, () => 70),
      regions: REGIONS({ torso: 82, leftArm: 80, leftLeg: 45 }), overall: 70,
    });
    expect(withOutlier.some(f => f.kind === "region" && /left leg/.test(f.text))).toBe(true);

    const flat = summariseRun({
      ...base, frames: run(30, () => 70),
      regions: REGIONS({ torso: 70, leftArm: 72, leftLeg: 68 }), overall: 70,
    });
    expect(flat.some(f => f.kind === "region")).toBe(false);
  });

  it("tells a strong, even run to push tempo instead of inventing a weakness", () => {
    const out = summariseRun({
      ...base, frames: run(30, () => 90),
      regions: REGIONS({ torso: 88, leftArm: 90, leftLeg: 91 }), overall: 90,
    });
    expect(out.some(f => f.kind === "strength")).toBe(true);
    expect(out.some(f => f.kind === "shape")).toBe(false);
  });

  it("never returns more than three findings", () => {
    const out = summariseRun({
      frames: run(40, s => (s >= 20 && s < 26 ? 20 : 60)),
      regions: REGIONS({ torso: 30, leftArm: 70, leftLeg: 72, rightArm: 71, rightLeg: 70 }),
      overall: 55, coverage: 0.2,
    });
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
