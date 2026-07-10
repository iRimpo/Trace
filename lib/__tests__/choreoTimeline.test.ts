import { describe, it, expect } from "vitest";
import { buildChoreoTimeline, SCAN_VERSION } from "../choreoTimeline";
import { CountGrid } from "../countGrid";
import type { MovementEvent, EventType } from "../movementEventDetector";

function ev(over: Partial<MovementEvent> & { videoTime: number }): MovementEvent {
  return {
    type: "move" as EventType,
    jointIndex: 15,
    jointName: "L Wrist",
    x: 100, y: 100, anchorX: 90, anchorY: 90,
    dx: 10, dy: 10, magnitude: 14,
    ...over,
  } as MovementEvent;
}

describe("buildChoreoTimeline", () => {
  it("snaps to nearest half-count when BPM known", () => {
    // 120 BPM → beat = 0.5s, half-count = 0.25s
    const grid = new CountGrid(120, 0);
    const t = buildChoreoTimeline([ev({ videoTime: 0.26 })], grid, 720);
    expect(t.entries).toHaveLength(1);
    expect(t.entries[0].time).toBeCloseTo(0.25, 5);
    expect(t.entries[0].rawTime).toBeCloseTo(0.26, 5);
  });

  it("respects beatOneOffset when snapping", () => {
    const grid = new CountGrid(120, 0.1); // grid at 0.1, 0.35, 0.6, ...
    const t = buildChoreoTimeline([ev({ videoTime: 0.34 })], grid, 720);
    expect(t.entries[0].time).toBeCloseTo(0.35, 5);
  });

  it("falls back to 100ms grid without BPM", () => {
    const t = buildChoreoTimeline([ev({ videoTime: 1.234 })], null, 720);
    expect(t.entries[0].time).toBeCloseTo(1.2, 5);
    expect(t.entries[0].count).toBeNull();
    expect(t.entries[0].accent).toBeNull();
    expect(t.bpm).toBeNull();
  });

  it("dedupes same joint in a bucket, keeping max magnitude", () => {
    const grid = new CountGrid(120, 0);
    const t = buildChoreoTimeline(
      [
        ev({ videoTime: 0.24, magnitude: 5 }),
        ev({ videoTime: 0.26, magnitude: 20 }),
      ],
      grid, 720,
    );
    expect(t.entries).toHaveLength(1);
    expect(t.entries[0].magnitude).toBe(20);
  });

  it("caps a bucket at 3 entries by priority then magnitude", () => {
    const grid = new CountGrid(120, 0);
    const events = [
      ev({ videoTime: 0.25, type: "shoulder", jointIndex: 11, magnitude: 50 }),
      ev({ videoTime: 0.25, type: "step", jointIndex: 27, magnitude: 5 }),
      ev({ videoTime: 0.25, type: "arm-both", jointIndex: 15, magnitude: 6 }),
      ev({ videoTime: 0.25, type: "move", jointIndex: 16, magnitude: 7 }),
      ev({ videoTime: 0.25, type: "head", jointIndex: 0, magnitude: 8 }),
    ];
    const t = buildChoreoTimeline(events, grid, 720);
    expect(t.entries).toHaveLength(3);
    const types = t.entries.map(e => e.type).sort();
    // step(5), arm-both(4), move(3) beat head(2) and shoulder(1) despite magnitudes
    expect(types).toEqual(["arm-both", "move", "step"]);
  });

  it("fills count/measure/accent from the grid", () => {
    const grid = new CountGrid(120, 0);
    const t = buildChoreoTimeline(
      [ev({ videoTime: 0 }), ev({ videoTime: 2.0, jointIndex: 16 })],
      grid, 720,
    );
    expect(t.entries[0].count).toBe(1);
    expect(t.entries[0].accent).toBe("downbeat");
    expect(t.entries[1].count).toBe(5); // beat index 4 → count 5
    expect(t.entries[1].accent).toBe("downbeat");
  });

  it("sorts entries by time with stable sequential ids", () => {
    const grid = new CountGrid(120, 0);
    const t = buildChoreoTimeline(
      [ev({ videoTime: 1.0 }), ev({ videoTime: 0.5, jointIndex: 16 })],
      grid, 720,
    );
    expect(t.entries.map(e => e.time)).toEqual([0.5, 1.0]);
    expect(t.entries.map(e => e.id)).toEqual([0, 1]);
  });

  it("stamps version, bpm, offset, videoHeight", () => {
    const grid = new CountGrid(96, 0.2);
    const t = buildChoreoTimeline([], grid, 1080);
    expect(t.version).toBe(SCAN_VERSION);
    expect(t.bpm).toBe(96);
    expect(t.beatOneOffset).toBe(0.2);
    expect(t.videoHeight).toBe(1080);
    expect(t.entries).toEqual([]);
  });

  it("carries lowConfidence marking through", () => {
    const grid = new CountGrid(120, 0);
    const t = buildChoreoTimeline(
      [ev({ videoTime: 0.25, lowConfidence: true } as Partial<MovementEvent> & { videoTime: number })],
      grid, 720,
    );
    expect(t.entries[0].lowConfidence).toBe(true);
  });
});
