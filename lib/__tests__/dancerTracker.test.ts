import { describe, it, expect } from "vitest";
import { DancerTracker } from "../dancerTracker";
import type { Keypoint } from "../mediapipe";

const VW = 1000, VH = 1000;

/**
 * Build a 33-keypoint pose centred (hips) at normalized (cx, cy).
 * Body spans ~0.2 norm units tall so bounding boxes are meaningful.
 */
function mkPose(cx: number, cy: number): Keypoint[] {
  const kps: Keypoint[] = new Array(33).fill(null).map((_, i) => ({
    x: cx * VW, y: cy * VH, score: 0.9, name: `kp${i}`,
  }));
  // Spread key joints so bounds ≈ 0.12 wide × 0.3 tall around the center
  kps[0]  = { x: cx * VW, y: (cy - 0.15) * VH, score: 0.9 };          // nose
  kps[11] = { x: (cx - 0.05) * VW, y: (cy - 0.1) * VH, score: 0.9 };  // L shoulder
  kps[12] = { x: (cx + 0.05) * VW, y: (cy - 0.1) * VH, score: 0.9 };  // R shoulder
  kps[23] = { x: (cx - 0.04) * VW, y: cy * VH, score: 0.9 };          // L hip
  kps[24] = { x: (cx + 0.04) * VW, y: cy * VH, score: 0.9 };          // R hip
  kps[27] = { x: (cx - 0.04) * VW, y: (cy + 0.15) * VH, score: 0.9 }; // L ankle
  kps[28] = { x: (cx + 0.04) * VW, y: (cy + 0.15) * VH, score: 0.9 }; // R ankle
  return kps;
}

describe("DancerTracker", () => {
  it("follows a single dancer moving in a straight line", () => {
    const tr = new DancerTracker();
    tr.lock({ x: 0.2, y: 0.5 });
    for (let i = 0; i < 10; i++) {
      const x = 0.2 + i * 0.02;
      const res = tr.step([mkPose(x, 0.5)], VW, VH);
      expect(res.kps).not.toBeNull();
      expect(res.needsReacquire).toBe(false);
      expect(res.confidence).toBeGreaterThan(0.5);
    }
    expect(tr.center!.x).toBeCloseTo(0.38, 1);
  });

  it("stays on its dancer through a crossing (velocity beats proximity)", () => {
    const tr = new DancerTracker();
    tr.lock({ x: 0.2, y: 0.5 });
    // Dancer A moves right 0.2→0.6; dancer B moves left 0.6→0.2. They cross at 0.4.
    // Build up velocity first, then check post-cross identity.
    const STEPS = 20;
    for (let i = 1; i <= STEPS; i++) {
      const ax = 0.2 + (0.4 * i) / STEPS;
      const bx = 0.6 - (0.4 * i) / STEPS;
      tr.step([mkPose(ax, 0.5), mkPose(bx, 0.5)], VW, VH);
    }
    // After the cross, A is at 0.6. Nearest-center-from-previous would have
    // swapped onto B at the crossing point; velocity prediction must not.
    expect(tr.center!.x).toBeGreaterThan(0.55);
  });

  it("coasts through a short occlusion and re-locks", () => {
    const tr = new DancerTracker();
    tr.lock({ x: 0.5, y: 0.5 });
    tr.step([mkPose(0.5, 0.5)], VW, VH);
    tr.step([mkPose(0.52, 0.5)], VW, VH);
    // 3 frames with the dancer missing entirely (far-away person only)
    for (let i = 0; i < 3; i++) {
      const res = tr.step([mkPose(0.95, 0.1)], VW, VH);
      expect(res.needsReacquire).toBe(false);
    }
    // Dancer reappears near prediction → re-locks with decent confidence
    const back = tr.step([mkPose(0.56, 0.5)], VW, VH);
    expect(back.kps).not.toBeNull();
    expect(back.confidence).toBeGreaterThan(0.5);
  });

  it("requests reacquire after coasting too long", () => {
    const tr = new DancerTracker({ maxCoastFrames: 4 });
    tr.lock({ x: 0.5, y: 0.5 });
    tr.step([mkPose(0.5, 0.5)], VW, VH);
    let needed = false;
    for (let i = 0; i < 8; i++) {
      const res = tr.step([mkPose(0.95, 0.1)], VW, VH);
      if (res.needsReacquire) { needed = true; break; }
    }
    expect(needed).toBe(true);
  });

  it("reduces confidence when two candidates are ambiguously close", () => {
    const tr = new DancerTracker();
    tr.lock({ x: 0.5, y: 0.5 });
    const clean = tr.step([mkPose(0.5, 0.5)], VW, VH).confidence;
    // Second dancer nearly overlapping the first
    const crowded = tr.step([mkPose(0.5, 0.5), mkPose(0.53, 0.5)], VW, VH).confidence;
    expect(crowded).toBeLessThan(clean);
  });

  it("re-lock resets coasting state", () => {
    const tr = new DancerTracker({ maxCoastFrames: 2 });
    tr.lock({ x: 0.5, y: 0.5 });
    tr.step([mkPose(0.5, 0.5)], VW, VH);
    tr.step([mkPose(0.95, 0.1)], VW, VH);
    tr.step([mkPose(0.95, 0.1)], VW, VH);
    const res = tr.step([mkPose(0.95, 0.1)], VW, VH);
    expect(res.needsReacquire).toBe(true);
    tr.lock({ x: 0.95, y: 0.1 }); // user re-tapped
    const after = tr.step([mkPose(0.95, 0.1)], VW, VH);
    expect(after.needsReacquire).toBe(false);
    expect(after.kps).not.toBeNull();
  });
});
