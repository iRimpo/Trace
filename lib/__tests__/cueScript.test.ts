import { describe, it, expect } from "vitest";
import {
  composeCueScript, cueAt, SCAN_VERSION, LEAD_BEATS, HOLD_BEATS,
} from "../cueScript";
import { CountGrid } from "../countGrid";
import type { MovementEvent, EventType } from "../movementEventDetector";

function ev(over: Partial<MovementEvent> & { videoTime: number }): MovementEvent {
  return {
    type: "move" as EventType,
    jointIndex: 15,
    jointName: "L Wrist",
    x: 100, y: 100, anchorX: 90, anchorY: 90,
    dx: 10, dy: 10, magnitude: 60,
    ...over,
  } as MovementEvent;
}

const grid120 = new CountGrid(120, 0); // beat = 0.5s

describe("composeCueScript", () => {
  it("returns null without a BPM grid", () => {
    expect(composeCueScript([ev({ videoTime: 1 })], new CountGrid(null, 0), 720)).toBeNull();
    expect(composeCueScript([ev({ videoTime: 1 })], null, 720)).toBeNull();
  });

  it("places a cue exactly on the beat tick, not the raw event time", () => {
    const s = composeCueScript([ev({ videoTime: 0.53 })], grid120, 720)!;
    expect(s.cues).toHaveLength(1);
    expect(s.cues[0].time).toBeCloseTo(0.5, 5);
    expect(s.cues[0].count).toBe(2);
    expect(s.cues[0].beatIndex).toBe(1);
  });

  it("emits at most one cue per beat", () => {
    const s = composeCueScript(
      [
        ev({ videoTime: 0.50, jointIndex: 15, type: "move",  magnitude: 60 }),
        ev({ videoTime: 0.52, jointIndex: 27, type: "step",  magnitude: 60 }),
        ev({ videoTime: 0.48, jointIndex: 0,  type: "head",  magnitude: 60 }),
      ],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(1);
    // step (priority 5) outranks move (3) and head (2) at equal magnitude
    expect(s.cues[0].region).toBe("foot");
  });

  it("leaves a beat empty when nothing clears the score floor", () => {
    // shoulder priority 1 x (2/720) normalized magnitude = 0.0028, well under floor
    const s = composeCueScript(
      [ev({ videoTime: 0.5, jointIndex: 11, type: "shoulder", magnitude: 2 })],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(0);
  });

  it("suppresses the same joint continuing in the same direction", () => {
    const s = composeCueScript(
      [
        ev({ videoTime: 0.5, jointIndex: 15, dx: 30, dy: 0, magnitude: 60 }),
        ev({ videoTime: 1.0, jointIndex: 15, dx: 30, dy: 0, magnitude: 60 }),
      ],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(1);
    expect(s.cues[0].time).toBeCloseTo(0.5, 5);
  });

  it("keeps the same joint when it reverses direction", () => {
    const s = composeCueScript(
      [
        ev({ videoTime: 0.5, jointIndex: 15, dx:  30, dy: 0, magnitude: 60 }),
        ev({ videoTime: 1.0, jointIndex: 15, dx: -30, dy: 0, magnitude: 60 }),
      ],
      grid120, 720,
    )!;
    expect(s.cues).toHaveLength(2);
  });

  it("maps joints to regions and side-aware labels", () => {
    const cases: [number, EventType, string, string][] = [
      [0,  "head",     "head",     "HEAD"],
      [16, "move",     "hand",     "R HAND"],
      [13, "elbow",    "elbow",    "L ARM"],
      [24, "hip",      "hip",      "HIPS"],
      [25, "move",     "foot",     "L KNEE"],
      [28, "step",     "foot",     "R FOOT"],
      [11, "shoulder", "shoulder", "L SHOULDER"],
    ];
    for (const [jointIndex, type, region, label] of cases) {
      const s = composeCueScript(
        [ev({ videoTime: 0.5, jointIndex, type, magnitude: 200 })], grid120, 720,
      )!;
      expect(s.cues[0].region, `joint ${jointIndex}`).toBe(region);
      expect(s.cues[0].label,  `joint ${jointIndex}`).toBe(label);
    }
  });

  it("maps a roll event to the body region with roll motion", () => {
    const s = composeCueScript(
      [ev({ videoTime: 0.5, jointIndex: 11, type: "roll", magnitude: 200 })],
      grid120, 720,
    )!;
    expect(s.cues[0].region).toBe("body");
    expect(s.cues[0].motion).toBe("roll");
    expect(s.cues[0].label).toBe("CHEST");
  });

  it("maps bilateral arm events to armBoth", () => {
    const s = composeCueScript(
      [ev({ videoTime: 0.5, jointIndex: 15, type: "arm-both", magnitude: 200 })],
      grid120, 720,
    )!;
    expect(s.cues[0].region).toBe("armBoth");
    expect(s.cues[0].label).toBe("BOTH ARMS");
  });

  it("stamps version, bpm, offset and videoHeight", () => {
    const s = composeCueScript([], new CountGrid(96, 0.2), 1080)!;
    expect(s.version).toBe(SCAN_VERSION);
    expect(s.bpm).toBe(96);
    expect(s.beatOneOffset).toBeCloseTo(0.2, 5);
    expect(s.videoHeight).toBe(1080);
    expect(s.cues).toEqual([]);
  });

  it("survives a JSON round-trip (the cache stores this)", () => {
    const s = composeCueScript([ev({ videoTime: 0.5 })], grid120, 720)!;
    const back = JSON.parse(JSON.stringify(s));
    expect(cueAt(back, 0.5)).not.toBeNull();
    expect(back.cues[0].jointIndex).toBe(15);
  });
});

describe("recomposition", () => {
  // The whole point of separating scan output from composition: correcting the
  // tempo after a scan must move every cue, without rescanning the video.
  const events = [
    ev({ videoTime: 0.50, jointIndex: 15, magnitude: 60 }),
    ev({ videoTime: 1.02, jointIndex: 27, type: "step", magnitude: 60 }),
  ];

  it("moves cue times onto a new grid when the BPM changes", () => {
    const at120 = composeCueScript(events, new CountGrid(120, 0), 720)!;
    const at90  = composeCueScript(events, new CountGrid(90,  0), 720)!;
    // beat is 0.5s at 120 and 0.6667s at 90, so the ticks differ
    expect(at120.cues[0].time).toBeCloseTo(0.5, 5);
    expect(at90.cues[0].time).toBeCloseTo(0.6667, 3);
    expect(at90.bpm).toBe(90);
  });

  it("re-labels counts when beat one moves", () => {
    const zero    = composeCueScript(events, new CountGrid(120, 0),   720)!;
    const shifted = composeCueScript(events, new CountGrid(120, 0.5), 720)!;
    expect(zero.cues[0].count).toBe(2);
    expect(shifted.cues[0].count).toBe(1);
  });

  it("is deterministic — same inputs give an identical script", () => {
    const a = composeCueScript(events, new CountGrid(120, 0), 720);
    const b = composeCueScript(events, new CountGrid(120, 0), 720);
    expect(a).toEqual(b);
  });
});

describe("cueAt", () => {
  const script = composeCueScript(
    [
      ev({ videoTime: 0.5, jointIndex: 15, dx: 30, dy: 0,  magnitude: 60 }),
      ev({ videoTime: 1.0, jointIndex: 16, dx: 0,  dy: 30, magnitude: 60 }),
    ],
    grid120, 720,
  )!;

  it("returns nothing before the first window opens", () => {
    // beat 0.5s, lead 0.75 beats x 0.5s = 0.375s -> opens at 0.125s
    expect(cueAt(script, 0.12)).toBeNull();
  });

  it("returns the cue inside its window", () => {
    expect(cueAt(script, 0.13)?.cue.time).toBeCloseTo(0.5, 5);
    expect(cueAt(script, 0.5)?.cue.time).toBeCloseTo(0.5, 5);
    expect(cueAt(script, 0.6)?.cue.time).toBeCloseTo(0.5, 5);
  });

  it("windows never overlap — adjacent cues hand off cleanly", () => {
    // cue A closes at 0.5 + 0.25*0.5 = 0.625; cue B opens at 1.0 - 0.375 = 0.625
    expect(cueAt(script, 0.624)?.cue.time).toBeCloseTo(0.5, 5);
    expect(cueAt(script, 0.626)?.cue.time).toBeCloseTo(1.0, 5);
  });

  it("reports progress with the hit moment at LEAD_BEATS", () => {
    const at = cueAt(script, 0.5)!;
    expect(at.progress).toBeCloseTo(LEAD_BEATS, 5);
    expect(LEAD_BEATS + HOLD_BEATS).toBeCloseTo(1, 5);
  });

  it("is pure — order and direction of calls do not matter", () => {
    const forward = [0.2, 0.4, 0.6, 0.8, 1.0].map(t => cueAt(script, t)?.cue.time ?? null);
    const back    = [1.0, 0.8, 0.6, 0.4, 0.2].map(t => cueAt(script, t)?.cue.time ?? null);
    expect(back.reverse()).toEqual(forward);
  });

  it("returns nothing after the last window closes", () => {
    expect(cueAt(script, 5)).toBeNull();
  });
});
