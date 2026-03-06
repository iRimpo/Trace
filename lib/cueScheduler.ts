import type { MovementEvent, EventType } from "./movementEventDetector";
import type { CountTick } from "./countGrid";
import { CountGrid } from "./countGrid";

// ── Types ─────────────────────────────────────────────────────────────────

export interface Cue {
  id:        number;
  event:     MovementEvent;
  /** performance.now() when cue becomes visible */
  addedAt:   number;
  /** Total display duration in ms */
  duration:  number;
  /** Snapped count tick (present when a CountGrid is provided) */
  snappedTick?: CountTick;
}

// ── Priority + duration tables ────────────────────────────────────────────

const PRIORITY: Record<EventType, number> = {
  step:       5,
  "arm-both": 4,
  move:       3,
  head:       2,
  hip:        2,
  elbow:      1,
  shoulder:   1,
};

const DURATION_MS: Record<EventType, number> = {
  step:       950,
  "arm-both": 900,
  move:       850,
  head:       1000,
  hip:        800,
  elbow:      800,
  shoulder:   750,
};

const MIN_DISPLAY_MS = 350;

/**
 * Maximum wall-time we'll hold a cue in the pending queue waiting for a beat.
 * Beats further away than this fire immediately to avoid noticeable lag.
 * 550 ms covers up to ~55 BPM (half-beat = 545 ms); faster music always snaps.
 */
const MAX_QUEUE_MS = 550;

// ── Pending cue (waiting for its snapped beat moment) ─────────────────────

interface PendingCue {
  event:       MovementEvent;
  fireAt:      number; // performance.now() when it should become active
  snappedTick: CountTick;
  duration:    number;
}

// ── Scheduler ─────────────────────────────────────────────────────────────

export class CueScheduler {
  private _cues:    Cue[] = [];
  private _pending: PendingCue[] = [];
  private _nextId   = 0;
  private _maxCues:  number;
  private _grid:     CountGrid | null = null;

  constructor(maxCues = 2) {
    this._maxCues = maxCues;
  }

  setCountGrid(grid: CountGrid | null): void {
    this._grid = grid;
  }

  /**
   * Expire finished cues, promote pending cues whose time has arrived,
   * and return the set that should be rendered now.
   */
  tick(now: number): Cue[] {
    // Promote pending cues that are ready
    for (let i = this._pending.length - 1; i >= 0; i--) {
      const p = this._pending[i];
      if (now >= p.fireAt) {
        this._pending.splice(i, 1);
        this._insertCue(p.event, now, p.duration, p.snappedTick);
      }
    }

    // Drop pending cues that missed their window (shouldn't normally happen)
    this._pending = this._pending.filter(p => p.fireAt > now - 500);

    this._cues = this._cues.filter(c => now - c.addedAt < c.duration);
    return this._cues;
  }

  /**
   * Schedule a movement event as a cue.
   *
   * When a CountGrid is set, the cue is snapped to the nearest beat tick:
   * - If the tick is in the future (up to MAX_QUEUE_MS), the cue is held
   *   in a pending queue and promoted exactly on that beat.
   * - If the tick is in the past or practically now, fire immediately with
   *   the snapped metadata attached.
   * - If there's no grid, fire immediately (original behavior).
   *
   * `now` is performance.now().
   * `playbackRate` is the current video speed (needed to convert video-time
   * offsets to wall-clock offsets).
   */
  add(event: MovementEvent, now: number, playbackRate = 1): void {
    const duration = DURATION_MS[event.type];

    if (!this._grid || !this._grid.hasBpm) {
      this._insertCue(event, now, duration);
      return;
    }

    const tick = this._grid.nearestTick(event.videoTime ?? 0);
    if (!tick) {
      this._insertCue(event, now, duration);
      return;
    }

    // How far is the snapped tick from the detected event in video-seconds?
    const videoOffsetSec = tick.time - (event.videoTime ?? 0);
    // Convert to wall-clock ms, accounting for playback speed
    const wallOffsetMs   = (videoOffsetSec / (playbackRate || 1)) * 1000;
    const fireAt         = now + wallOffsetMs;

    if (wallOffsetMs > MAX_QUEUE_MS) {
      // Beat is unusually far ahead (very slow tempo) — fire now, don't lag
      this._insertCue(event, now, duration, tick);
    } else if (wallOffsetMs > 5) {
      // Future beat within queueing range — hold and fire exactly on the beat
      this._pending.push({ event, fireAt, snappedTick: tick, duration });
    } else {
      // Past or practically now — fire immediately with beat metadata attached
      this._insertCue(event, now, duration, tick);
    }
  }

  private _insertCue(
    event: MovementEvent,
    now: number,
    duration: number,
    snappedTick?: CountTick,
  ): void {
    const newPri = PRIORITY[event.type];

    if (this._cues.length >= this._maxCues) {
      let weakIdx = -1;
      let weakScore = Infinity;
      for (let i = 0; i < this._cues.length; i++) {
        const c   = this._cues[i];
        const age = now - c.addedAt;
        if (age < MIN_DISPLAY_MS) continue;
        const score = PRIORITY[c.event.type] * 1000 - age;
        if (score < weakScore) { weakScore = score; weakIdx = i; }
      }
      if (weakIdx === -1) return;
      const weakPri = PRIORITY[this._cues[weakIdx].event.type];
      if (newPri < weakPri) return;
      this._cues.splice(weakIdx, 1);
    }

    const cue: Cue = { id: this._nextId++, event, addedAt: now, duration };
    if (snappedTick) cue.snappedTick = snappedTick;
    this._cues.push(cue);
  }

  reset(): void {
    this._cues    = [];
    this._pending = [];
  }
}
