import { describe, it, expect } from "vitest";
import { videoFit, fitPoint } from "@/lib/videoFit";

/**
 * The property that matters is not "the numbers are these numbers" — it is
 * **the overlay agrees with what CSS painted**. So the cases below are written
 * as the two things CSS guarantees: contain never crops, cover never
 * letterboxes, and both centre.
 */
describe("videoFit", () => {
  it("is the identity when the box already matches the video's aspect", () => {
    // The case every pane used to be, and the reason the old stretch mapping
    // looked correct for so long.
    for (const mode of ["cover", "contain"] as const) {
      expect(videoFit(1600, 900, 1280, 720, mode)).toEqual({
        dw: 1600, dh: 900, ox: 0, oy: 0,
      });
    }
  });

  describe("contain — letterboxes, never crops", () => {
    it("pillarboxes a wide video in a tall box", () => {
      // A 16:9 camera in the portrait calibration pane: 393×711.
      const f = videoFit(393, 711, 1920, 1080, "contain");
      expect(f.dw).toBeCloseTo(393);
      expect(f.dh).toBeCloseTo(393 * 9 / 16);
      expect(f.ox).toBeCloseTo(0);
      expect(f.oy).toBeGreaterThan(0);          // centred letterbox
    });

    it("never exceeds the box in either axis", () => {
      const boxes: [number, number][] = [[393, 711], [1600, 900], [400, 400], [100, 900]];
      const videos: [number, number][] = [[1920, 1080], [640, 480], [1080, 1920]];
      for (const [cW, cH] of boxes) {
        for (const [vW, vH] of videos) {
          const f = videoFit(cW, cH, vW, vH, "contain");
          expect(f.dw).toBeLessThanOrEqual(cW + 1e-9);
          expect(f.dh).toBeLessThanOrEqual(cH + 1e-9);
        }
      }
    });
  });

  describe("cover — fills, never letterboxes", () => {
    it("crops a wide video in a tall box", () => {
      const f = videoFit(393, 711, 1920, 1080, "cover");
      expect(f.dh).toBeCloseTo(711);
      expect(f.dw).toBeGreaterThan(393);        // overflows horizontally
      expect(f.ox).toBeLessThan(0);             // and is centred, so cropped both sides
      expect(f.oy).toBeCloseTo(0);
    });

    it("never leaves a gap in either axis", () => {
      const boxes: [number, number][] = [[393, 711], [1600, 900], [400, 400], [100, 900]];
      const videos: [number, number][] = [[1920, 1080], [640, 480], [1080, 1920]];
      for (const [cW, cH] of boxes) {
        for (const [vW, vH] of videos) {
          const f = videoFit(cW, cH, vW, vH, "cover");
          expect(f.dw).toBeGreaterThanOrEqual(cW - 1e-9);
          expect(f.dh).toBeGreaterThanOrEqual(cH - 1e-9);
        }
      }
    });
  });

  it("both modes keep the video centred", () => {
    for (const mode of ["cover", "contain"] as const) {
      const f = videoFit(393, 711, 1920, 1080, mode);
      expect(f.ox + f.dw / 2).toBeCloseTo(393 / 2);
      expect(f.oy + f.dh / 2).toBeCloseTo(711 / 2);
    }
  });

  it("falls back to the box when metadata has not loaded", () => {
    // videoWidth is 0 until loadedmetadata. Dividing by it painted NaN, which
    // silently clears the whole overlay rather than failing visibly.
    expect(videoFit(393, 711, 0, 0, "cover")).toEqual({ dw: 393, dh: 711, ox: 0, oy: 0 });
    expect(videoFit(0, 0, 1920, 1080, "contain")).toEqual({ dw: 0, dh: 0, ox: 0, oy: 0 });
  });
});

describe("fitPoint", () => {
  it("puts the video's centre at the box's centre", () => {
    const f = videoFit(393, 711, 1920, 1080, "contain");
    expect(fitPoint(f, 0.5, 0.5)).toEqual({ x: 393 / 2, y: 711 / 2 });
  });

  it("mirrors horizontally only", () => {
    const f = videoFit(393, 711, 1920, 1080, "cover");
    const plain    = fitPoint(f, 0.25, 0.4, false);
    const mirrored = fitPoint(f, 0.25, 0.4, true);
    expect(mirrored.y).toBeCloseTo(plain.y);
    // 0.25 mirrors to 0.75, so both sit symmetrically about the centre.
    expect((plain.x + mirrored.x) / 2).toBeCloseTo(393 / 2);
  });

  it("round-trips a normalised point through the contain mapping", () => {
    // This is the invariant the person-picker hit test depends on: a ring drawn
    // at n must be found again by inverting the same fit.
    const f = videoFit(393, 711, 1920, 1080, "contain");
    for (const n of [0, 0.13, 0.5, 0.87, 1]) {
      const { x } = fitPoint(f, n, n);
      expect((x - f.ox) / f.dw).toBeCloseTo(n);
    }
  });
});
