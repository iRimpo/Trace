import { describe, it, expect } from "vitest";
import { pickPrimaryPose } from "@/lib/primaryPose";
import type { Keypoint } from "@/lib/mediapipe";

/** A body of the given size, centred at cx, with uniform confidence. */
function body(cx: number, cy: number, w: number, h: number, score = 0.9): Keypoint[] {
  const out: Keypoint[] = [];
  for (let i = 0; i < 33; i++) {
    // Spread points across the box so the bounds are real.
    const fx = (i % 3) - 1, fy = (Math.floor(i / 3) % 3) - 1;
    out.push({ x: cx + fx * (w / 2), y: cy + fy * (h / 2), score } as Keypoint);
  }
  return out;
}

/** Too few confident points to be a body. */
function ghost(): Keypoint[] {
  return Array.from({ length: 33 }, (_, i) =>
    ({ x: i, y: i, score: i < 2 ? 0.9 : 0.05 }) as Keypoint);
}

describe("pickPrimaryPose", () => {
  it("returns null for no input", () => {
    expect(pickPrimaryPose(null)).toBeNull();
    expect(pickPrimaryPose([])).toBeNull();
  });

  it("returns the only pose when there is one", () => {
    const one = body(500, 500, 300, 700);
    expect(pickPrimaryPose([one])).toBe(one);
  });

  it("rejects a pose with too few confident points", () => {
    expect(pickPrimaryPose([ghost()])).toBeNull();
  });

  /**
   * The case this exists for. A dancer practising at home faces a mirror, so
   * the reflection is a second full body in frame — farther away, therefore
   * smaller. Taking landmarks[0] could pick either, and could alternate
   * between them frame to frame.
   */
  it("prefers the nearer body over its mirror reflection", () => {
    const dancer     = body(640, 540, 400, 900);
    const reflection = body(300, 500, 180, 400);
    expect(pickPrimaryPose([reflection, dancer], 1280)).toBe(dancer);
    // Order must not matter — that is the whole point.
    expect(pickPrimaryPose([dancer, reflection], 1280)).toBe(dancer);
  });

  it("is stable regardless of input order", () => {
    const a = body(400, 500, 350, 800);
    const b = body(900, 500, 200, 450);
    const c = body(1100, 500, 150, 300);
    const expected = pickPrimaryPose([a, b, c], 1280);
    for (const order of [[b, a, c], [c, b, a], [b, c, a], [a, c, b]]) {
      expect(pickPrimaryPose(order, 1280)).toBe(expected);
    }
  });

  it("skips implausible bodies when choosing", () => {
    const real = body(640, 500, 300, 700);
    expect(pickPrimaryPose([ghost(), real, ghost()], 1280)).toBe(real);
  });

  it("breaks a size tie toward the centre of frame", () => {
    const centred = body(640, 500, 300, 700);
    const edge    = body(120, 500, 300, 700);
    expect(pickPrimaryPose([edge, centred], 1280)).toBe(centred);
  });

  it("still picks a clearly larger body even when it is off-centre", () => {
    // The centre bias is a tiebreaker, not an override.
    const bigEdge   = body(150, 540, 500, 1000);
    const smallMid  = body(640, 540, 200, 400);
    expect(pickPrimaryPose([smallMid, bigEdge], 1280)).toBe(bigEdge);
  });

  it("prefers the more confident of two identically sized bodies", () => {
    const sure   = body(500, 500, 300, 700, 0.95);
    const unsure = body(800, 500, 300, 700, 0.40);
    expect(pickPrimaryPose([unsure, sure], 1280)).toBe(sure);
  });

  it("returns null when every candidate is implausible", () => {
    expect(pickPrimaryPose([ghost(), ghost()], 1280)).toBeNull();
  });
});
