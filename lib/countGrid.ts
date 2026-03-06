// ── Types ─────────────────────────────────────────────────────────────────

export type Accent = "downbeat" | "snare" | "offbeat";

export interface CountTick {
  time:         number;
  count:        number; // 1–8
  measureIndex: number;
  accent:       Accent;
}

export interface CountInfo {
  count:        number; // 1–8
  measureIndex: number;
  accent:       Accent;
}

// ── Default accent map (4/4, 8-count cycle) ───────────────────────────────

function accentFor(count: number): Accent {
  if (count === 1 || count === 5) return "downbeat";
  if (count === 2 || count === 4 || count === 6 || count === 8) return "snare";
  return "offbeat";
}

// ── CountGrid ─────────────────────────────────────────────────────────────

export class CountGrid {
  readonly bpm:           number | null;
  readonly beatOneOffset: number; // seconds — where count 1 falls in video time
  private  _beatDuration: number; // seconds per beat

  constructor(bpm: number | null, beatOneOffset = 0) {
    this.bpm           = bpm;
    this.beatOneOffset = beatOneOffset;
    this._beatDuration = bpm && bpm > 0 ? 60 / bpm : 0;
  }

  get hasBpm(): boolean {
    return this.bpm !== null && this.bpm > 0;
  }

  /**
   * 0–1 phase within the current beat.
   * 0 = exactly on a beat, 1 = just before the next beat.
   * Returns 0.5 (neutral) when BPM is not set.
   */
  beatPhase(videoTime: number): number {
    if (!this.hasBpm) return 0.5;
    const elapsed = videoTime - this.beatOneOffset;
    const phase   = ((elapsed % this._beatDuration) + this._beatDuration) % this._beatDuration;
    return phase / this._beatDuration;
  }

  /**
   * Current count (1–8), measure index, and accent for a given video time.
   * Returns null when BPM is not set.
   */
  count(videoTime: number): CountInfo | null {
    if (!this.hasBpm) return null;
    const elapsed   = videoTime - this.beatOneOffset;
    const beatIndex = Math.floor(elapsed / this._beatDuration);
    const count     = ((beatIndex % 8) + 8) % 8 + 1; // 1–8, handles negatives
    const measure   = Math.floor(beatIndex / 8);
    return { count, measureIndex: measure, accent: accentFor(count) };
  }

  /**
   * Return the nearest CountTick to the given video time.
   * Useful for snapping movement events to the beat grid.
   */
  nearestTick(videoTime: number): CountTick | null {
    if (!this.hasBpm) return null;
    const elapsed   = videoTime - this.beatOneOffset;
    const rawIdx    = elapsed / this._beatDuration;
    const nearIdx   = Math.round(rawIdx);
    const time      = this.beatOneOffset + nearIdx * this._beatDuration;
    const count     = ((nearIdx % 8) + 8) % 8 + 1;
    const measure   = Math.floor(nearIdx / 8);
    return { time, count, measureIndex: measure, accent: accentFor(count) };
  }

  /**
   * All ticks in [t0, t1] — useful for timeline rendering.
   */
  getTicksInRange(t0: number, t1: number): CountTick[] {
    if (!this.hasBpm) return [];
    const ticks: CountTick[] = [];
    const startIdx = Math.ceil((t0 - this.beatOneOffset) / this._beatDuration);
    const endIdx   = Math.floor((t1 - this.beatOneOffset) / this._beatDuration);
    for (let i = startIdx; i <= endIdx; i++) {
      const time    = this.beatOneOffset + i * this._beatDuration;
      const count   = ((i % 8) + 8) % 8 + 1;
      const measure = Math.floor(i / 8);
      ticks.push({ time, count, measureIndex: measure, accent: accentFor(count) });
    }
    return ticks;
  }
}
