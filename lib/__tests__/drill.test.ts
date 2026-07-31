import { describe, it, expect } from "vitest";
import {
  phaseForPass, repsCompleted, canDrill, DEFAULT_DRILL, MIN_DRILL_SECONDS,
  type DrillConfig,
} from "@/lib/drill";

describe("phaseForPass", () => {
  it("alternates watch and dance by default", () => {
    const seq = [0, 1, 2, 3, 4, 5].map(n => phaseForPass(n));
    expect(seq).toEqual(["watch", "dance", "watch", "dance", "watch", "dance"]);
  });

  it("starts on watch — you see it before you do it", () => {
    expect(phaseForPass(0)).toBe("watch");
  });

  it("honours longer watch and dance runs", () => {
    const cfg: DrillConfig = { watchPasses: 2, dancePasses: 3 };
    const seq = Array.from({ length: 10 }, (_, n) => phaseForPass(n, cfg));
    expect(seq).toEqual([
      "watch", "watch", "dance", "dance", "dance",
      "watch", "watch", "dance", "dance", "dance",
    ]);
  });

  it("degrades rather than dividing by zero", () => {
    // All-dance is a legitimate thing to want once you know the section.
    expect(phaseForPass(0, { watchPasses: 0, dancePasses: 1 })).toBe("dance");
    expect(phaseForPass(7, { watchPasses: 0, dancePasses: 1 })).toBe("dance");
    expect(phaseForPass(3, { watchPasses: 1, dancePasses: 0 })).toBe("watch");
    expect(phaseForPass(3, { watchPasses: 0, dancePasses: 0 })).toBe("dance");
  });

  it("is stable under fractional or negative input", () => {
    expect(() => phaseForPass(-1)).not.toThrow();
    expect(["watch", "dance"]).toContain(phaseForPass(-1));
    expect(phaseForPass(2, { watchPasses: 1.7, dancePasses: 1.2 })).toBe("watch");
  });
});

describe("repsCompleted", () => {
  it("counts dances, not passes — watching is preparation", () => {
    // pass: 0 watch, 1 dance, 2 watch, 3 dance …
    expect(repsCompleted(0)).toBe(0);
    expect(repsCompleted(1)).toBe(0);   // about to dance rep 1
    expect(repsCompleted(2)).toBe(1);   // one dance done
    expect(repsCompleted(3)).toBe(1);
    expect(repsCompleted(4)).toBe(2);
  });

  it("never decreases as passes accumulate", () => {
    const cfg: DrillConfig = { watchPasses: 2, dancePasses: 3 };
    let last = -1;
    for (let n = 0; n < 40; n++) {
      const r = repsCompleted(n, cfg);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it("agrees with phaseForPass: it only rises after a dance pass", () => {
    const configs: DrillConfig[] = [
      DEFAULT_DRILL,
      { watchPasses: 2, dancePasses: 3 },
      { watchPasses: 1, dancePasses: 4 },
      { watchPasses: 0, dancePasses: 1 },
    ];
    for (const cfg of configs) {
      for (let n = 0; n < 30; n++) {
        const rose = repsCompleted(n + 1, cfg) - repsCompleted(n, cfg);
        expect(rose).toBe(phaseForPass(n, cfg) === "dance" ? 1 : 0);
      }
    }
  });

  it("is zero when nothing is ever danced", () => {
    for (let n = 0; n < 10; n++) {
      expect(repsCompleted(n, { watchPasses: 1, dancePasses: 0 })).toBe(0);
    }
  });
});

describe("canDrill", () => {
  it("needs both loop points", () => {
    expect(canDrill(null, null)).toBe(false);
    expect(canDrill(1, null)).toBe(false);
    expect(canDrill(null, 9)).toBe(false);
  });

  it("rejects a section too short to count into", () => {
    // Below the floor a pass is over before a count-in finishes, and the mode
    // becomes a stutter rather than a drill.
    expect(canDrill(10, 10 + MIN_DRILL_SECONDS - 0.01)).toBe(false);
    expect(canDrill(10, 10 + MIN_DRILL_SECONDS)).toBe(true);
    expect(canDrill(10, 30)).toBe(true);
  });

  it("rejects an inverted range", () => {
    expect(canDrill(30, 10)).toBe(false);
  });
});
