/**
 * Sound and haptics — the channel that reaches you when you are not looking.
 *
 * Trace was silent. That is a bigger gap than it sounds: the whole premise is a
 * phone propped eight feet away while you dance, which means for most of a run
 * the screen is not being looked at. Audio is the only channel that still
 * arrives, and it was the one channel the app did not use. A count you can hear
 * is a count you can dance to with your back turned.
 *
 * ── Synthesised, not sampled ─────────────────────────────────────────────
 *
 * Every cue here is generated with an oscillator and a gain envelope. No .mp3,
 * no .wav, nothing in `public/`, and **no `sw.js` precache entry or
 * `CACHE_VERSION` bump** — which is what the plan assumed would be needed. The
 * trade is real but one-sided at this size: synthesised blips cannot be
 * designed by ear in a DAW, but they cost zero bytes, cannot 404, cannot be
 * stale in a service worker, and work offline the first time the app is opened.
 * For six short UI cues that is the better side of the trade. If these ever
 * want to become real sound design, the shape of `sfx()` does not change.
 *
 * ── iOS ──────────────────────────────────────────────────────────────────
 *
 * Safari will not let an AudioContext start outside a user gesture, and one
 * created too early is born `suspended` and stays that way. So the context is
 * built lazily on the first `unlock()` — which the practice route calls from a
 * real tap — and every `sfx()` before that is a silent no-op rather than an
 * error. Audio is never the only signal for anything.
 *
 * ── Reduced motion is not reduced sound ──────────────────────────────────
 *
 * `prefers-reduced-motion` gates the *visual* half of feedback and must never
 * gate this. They are different axes, and conflating them takes away the one
 * channel that a user who has turned motion down may be relying on more, not
 * less. Muting is its own control, and it persists.
 */

export type SfxName =
  /** Each count, when counts are on. Soft — it is under the music. */
  | "tick"
  /** 3-2-1 before a loop restart or a take. Removes the "when do I start?" guess. */
  | "countIn"
  /** The final beat of a count-in. Higher, so "go" is not another "3". */
  | "countInGo"
  /** A setup step landed: framing locked, trim set, dancer picked. */
  | "commit"
  /** Score reveal, upper band. */
  | "success"
  /** Score reveal, lower band. Warm, not a failure buzzer. */
  | "almost"
  /** Recording started — you are across the room and cannot see the red dot. */
  | "recordStart"
  /** Recording stopped. */
  | "recordStop";

/** One oscillator inside a cue. Times are seconds relative to the cue's start. */
export interface Partial {
  /** Start frequency in Hz. */
  freq: number;
  /** Frequency to glide to, if the tone should move. */
  toFreq?: number;
  /** When this partial begins, relative to the cue. */
  at: number;
  /** How long it sounds. */
  dur: number;
  /** Peak gain, 0–1, before the master volume. */
  gain: number;
  type?: OscillatorType;
}

/**
 * The cues, as data.
 *
 * Pitched deliberately rather than picked at random. `tick` sits high and quiet
 * so it reads as a metronome under music rather than competing with it;
 * `commit` is a rising two-note figure because every confirmation in the app
 * means "that worked, go on"; `success` is a major triad and `almost` the same
 * shape a third lower, so the two are recognisably siblings and neither sounds
 * like a failure buzzer. Nothing here is longer than 420ms — a cue that
 * outlasts the action it confirms stops being feedback and becomes a jingle.
 */
export const CUES: Record<SfxName, Partial[]> = {
  tick: [
    { freq: 1200, at: 0, dur: 0.03, gain: 0.16, type: "sine" },
  ],
  countIn: [
    { freq: 660, at: 0, dur: 0.07, gain: 0.3, type: "triangle" },
  ],
  countInGo: [
    { freq: 990, at: 0, dur: 0.12, gain: 0.38, type: "triangle" },
  ],
  commit: [
    { freq: 620, at: 0,    dur: 0.07, gain: 0.26, type: "sine" },
    { freq: 930, at: 0.06, dur: 0.12, gain: 0.26, type: "sine" },
  ],
  success: [
    { freq: 523.25, at: 0,    dur: 0.12, gain: 0.24, type: "sine" }, // C5
    { freq: 659.25, at: 0.09, dur: 0.12, gain: 0.24, type: "sine" }, // E5
    { freq: 783.99, at: 0.18, dur: 0.24, gain: 0.26, type: "sine" }, // G5
  ],
  almost: [
    { freq: 440.00, at: 0,    dur: 0.12, gain: 0.22, type: "sine" }, // A4
    { freq: 523.25, at: 0.09, dur: 0.20, gain: 0.22, type: "sine" }, // C5
  ],
  recordStart: [
    { freq: 500, toFreq: 900, at: 0, dur: 0.14, gain: 0.28, type: "triangle" },
  ],
  recordStop: [
    { freq: 900, toFreq: 500, at: 0, dur: 0.14, gain: 0.28, type: "triangle" },
  ],
};

/** Haptic patterns, in `navigator.vibrate`'s on/off-millisecond form. */
export const HAPTICS = {
  tick:    [8],
  commit:  [14],
  success: [18, 60, 18],
  warn:    [30],
} as const;

export type HapticName = keyof typeof HAPTICS;

const MUTE_KEY = "trace-muted";
/** Longest cue in CUES, used to size the duck window. */
const MAX_CUE_SEC = 0.42;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let muteLoaded = false;
let duckTarget: HTMLMediaElement | null = null;
let duckRestore: ReturnType<typeof setTimeout> | null = null;
let duckedFrom: number | null = null;

// ── Mute, persisted ────────────────────────────────────────────────────────

function loadMute(): boolean {
  if (muteLoaded) return muted;
  muteLoaded = true;
  if (typeof window === "undefined") return false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    /* Private mode. Default to audible; a silent app is the worse failure. */
  }
  return muted;
}

export function isMuted(): boolean {
  return loadMute();
}

export function setMuted(next: boolean): void {
  loadMute();
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* noop */
  }
  if (next) restoreDuck();
}

// ── Unlock ─────────────────────────────────────────────────────────────────

/**
 * Call from a real user gesture — a tap, not an effect. Safe to call repeatedly.
 *
 * Returns whether audio is now usable, so a caller can decide whether to lean
 * on a visual signal instead. It never throws: a browser with no WebAudio is a
 * silent app, not a broken one.
 */
export function unlockAudio(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!Ctor) return false;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx.state !== "closed";
  } catch {
    return false;
  }
}

/** Whether audio has been unlocked and can actually make sound. */
export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === "running";
}

// ── Ducking ────────────────────────────────────────────────────────────────

/**
 * Tell the feedback system which media element is playing the reference track,
 * so cues duck under it instead of fighting it.
 *
 * A metronome mixed on top of a song at equal level is harder to follow than no
 * metronome at all — the ear cannot separate two unrelated rhythms at the same
 * volume. Dropping the music ~45% for the length of the cue makes the cue
 * legible without the user reaching for a volume control mid-song.
 *
 * Pass `null` on unmount.
 */
export function registerDuckTarget(el: HTMLMediaElement | null): void {
  if (duckTarget && duckTarget !== el) restoreDuck();
  duckTarget = el;
}

function duck(seconds: number): void {
  const el = duckTarget;
  if (!el) return;
  if (duckedFrom === null) duckedFrom = el.volume;
  el.volume = Math.max(0, duckedFrom * 0.55);
  if (duckRestore) clearTimeout(duckRestore);
  duckRestore = setTimeout(restoreDuck, Math.round(seconds * 1000) + 90);
}

function restoreDuck(): void {
  if (duckRestore) { clearTimeout(duckRestore); duckRestore = null; }
  if (duckTarget && duckedFrom !== null) duckTarget.volume = duckedFrom;
  duckedFrom = null;
}

// ── The cues ───────────────────────────────────────────────────────────────

/** Total length of a cue in seconds — the last partial's end. */
export function cueDuration(name: SfxName): number {
  return CUES[name].reduce((max, p) => Math.max(max, p.at + p.dur), 0);
}

/**
 * Play a cue. Silent no-op when muted, before unlock, or with no WebAudio.
 * Never throws and never awaits — this is called from render paths and from a
 * rAF loop, and a cue that blocks a frame is worse than a cue that is missed.
 */
export function sfx(name: SfxName): void {
  if (loadMute()) return;
  if (!ctx || !master || ctx.state !== "running") return;

  const partials = CUES[name];
  if (!partials) return;

  try {
    const now = ctx.currentTime;
    for (const p of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = p.type ?? "sine";
      osc.frequency.setValueAtTime(p.freq, now + p.at);
      if (p.toFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(p.toFreq, now + p.at + p.dur);
      }
      // A hard start/stop on a tone clicks. 8ms in, the rest decaying out.
      gain.gain.setValueAtTime(0.0001, now + p.at);
      gain.gain.exponentialRampToValueAtTime(p.gain, now + p.at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.at + p.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + p.at);
      osc.stop(now + p.at + p.dur + 0.02);
    }
    duck(Math.min(cueDuration(name), MAX_CUE_SEC));
  } catch {
    /* An audio failure must never take a practice session down. */
  }
}

/**
 * Fire a haptic pattern. Android only in practice — iOS Safari does not
 * implement `navigator.vibrate` at all, so this is a bonus channel and never
 * the only signal for anything.
 */
export function haptic(name: HapticName): void {
  if (loadMute()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(HAPTICS[name] as unknown as number[]);
  } catch {
    /* noop */
  }
}

/** Cue and haptic together, for the commits that deserve both. */
export function confirm(name: SfxName, h: HapticName = "commit"): void {
  sfx(name);
  haptic(h);
}

/** Test seam — drops the context and all persisted state. */
export function __resetFeedbackForTests(): void {
  ctx = null;
  master = null;
  muted = false;
  muteLoaded = false;
  restoreDuck();
  duckTarget = null;
}
