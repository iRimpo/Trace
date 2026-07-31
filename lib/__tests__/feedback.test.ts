import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CUES, HAPTICS, cueDuration, sfx, haptic, isMuted, setMuted,
  unlockAudio, isAudioReady, registerDuckTarget, __resetFeedbackForTests,
  type SfxName,
} from "@/lib/feedback";

const ALL: SfxName[] = [
  "tick", "countIn", "countInGo", "commit",
  "success", "almost", "recordStart", "recordStop",
];

// The jsdom-ish environment here provides only a partial localStorage, so the
// suite installs a real in-memory one rather than relying on the host's.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear:      () => store.clear(),
  });
  __resetFeedbackForTests();
});

describe("the cue table", () => {
  it("defines every cue the type allows", () => {
    for (const name of ALL) expect(CUES[name]?.length ?? 0).toBeGreaterThan(0);
    expect(Object.keys(CUES).sort()).toEqual([...ALL].sort());
  });

  it("keeps every cue short enough to be feedback rather than a jingle", () => {
    // A cue that outlasts the action it confirms stops being feedback.
    for (const name of ALL) {
      expect(cueDuration(name)).toBeGreaterThan(0);
      expect(cueDuration(name)).toBeLessThanOrEqual(0.42);
    }
  });

  it("keeps the per-count tick the shortest and quietest cue", () => {
    // It fires on every count under music. Anything else is the wrong shape.
    const tick = cueDuration("tick");
    for (const name of ALL.filter(n => n !== "tick")) {
      expect(tick).toBeLessThanOrEqual(cueDuration(name));
    }
    const peak = (n: SfxName) => Math.max(...CUES[n].map(p => p.gain));
    for (const name of ALL.filter(n => n !== "tick")) {
      expect(peak("tick")).toBeLessThanOrEqual(peak(name));
    }
  });

  it("never clips: no two partials of a cue overlap above unity", () => {
    for (const name of ALL) {
      // Sum the gains of partials that are sounding simultaneously.
      const parts = CUES[name];
      for (const p of parts) {
        const overlapping = parts.filter(q => q.at < p.at + p.dur && p.at < q.at + q.dur);
        const sum = overlapping.reduce((s, q) => s + q.gain, 0);
        expect(sum).toBeLessThanOrEqual(1);
      }
    }
  });

  it("puts 'go' above the counts leading into it", () => {
    // Otherwise the downbeat is just a fourth "3" and the guess is still there.
    expect(CUES.countInGo[0].freq).toBeGreaterThan(CUES.countIn[0].freq);
  });

  it("makes success and almost siblings, not a reward and a buzzer", () => {
    // Both rise. A falling figure on a low score reads as a failure sound, and
    // the score is already the honest signal.
    const rises = (n: SfxName) => {
      const f = CUES[n].map(p => p.freq);
      return f.every((v, i) => i === 0 || v > f[i - 1]);
    };
    expect(rises("success")).toBe(true);
    expect(rises("almost")).toBe(true);
  });

  it("gives record start and stop opposite contours", () => {
    const start = CUES.recordStart[0];
    const stop  = CUES.recordStop[0];
    expect(start.toFreq!).toBeGreaterThan(start.freq);
    expect(stop.toFreq!).toBeLessThan(stop.freq);
  });

  it("keeps every haptic pattern short", () => {
    for (const pattern of Object.values(HAPTICS)) {
      const total = (pattern as readonly number[]).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(120);
    }
  });
});

describe("mute", () => {
  it("defaults to audible", () => {
    expect(isMuted()).toBe(false);
  });

  it("persists across a reload", () => {
    setMuted(true);
    __resetFeedbackForTests();          // simulates a fresh module on reload
    expect(isMuted()).toBe(true);
  });

  it("round-trips back to audible", () => {
    setMuted(true);
    setMuted(false);
    __resetFeedbackForTests();
    expect(isMuted()).toBe(false);
  });

  it("suppresses haptics too, not just sound", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    haptic("commit");
    expect(vibrate).toHaveBeenCalledTimes(1);
    setMuted(true);
    haptic("commit");
    expect(vibrate).toHaveBeenCalledTimes(1);   // still 1 — muted
    vi.unstubAllGlobals();
  });
});

describe("failure modes", () => {
  it("is a silent no-op before unlock rather than an error", () => {
    expect(isAudioReady()).toBe(false);
    for (const name of ALL) expect(() => sfx(name)).not.toThrow();
  });

  it("does not throw when the environment has no WebAudio", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => unlockAudio()).not.toThrow();
    expect(unlockAudio()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("does not throw when the platform has no vibrate", () => {
    vi.stubGlobal("navigator", {});
    expect(() => haptic("tick")).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("restores a duck target's volume when it is deregistered", () => {
    const el = { volume: 1 } as HTMLMediaElement;
    registerDuckTarget(el);
    registerDuckTarget(null);
    expect(el.volume).toBe(1);
  });
});
