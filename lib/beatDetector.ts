/**
 * Auto-detect BPM (and beat-one offset) from a video's audio track using the
 * Web Audio API + web-audio-beat-detector.
 *
 * Every failure path returns a *named reason*. The previous version returned a
 * bare `null` from six different places behind two bare `catch`es, so a phone
 * that could not find a tempo gave no way to tell whether the file was too
 * large, was not media at all, had no audio track, could not be decoded, or
 * simply had no steady beat. That made the failure unfixable from a distance,
 * and since feedback is now gated on having a count grid, it is also the thing
 * standing between the user and any cues at all.
 */

export type BeatFailure =
  | "too-large"      // over the fetch cap
  | "fetch-failed"   // network error, CORS, or a non-200
  | "not-media"      // the URL served HTML — i.e. a link-import page URL
  | "decode-failed"  // decodeAudioData refused the container
  | "no-audio-track" // decoded, but silent or zero-length
  | "no-tempo"       // guess() found no consistent beat
  | "out-of-range";  // found a tempo outside MIN_BPM..MAX_BPM

export interface BeatSuccess {
  ok: true;
  bpm: number;
  /** Where count 1 falls, in *video* time. */
  firstBeatTime?: number;
  /** The window actually analysed, so the UI can explain itself. */
  from: number;
  seconds: number;
}

export interface BeatFail {
  ok: false;
  reason: BeatFailure;
  /** Short human-readable specifics, safe to log. */
  detail?: string;
}

export type BeatOutcome = BeatSuccess | BeatFail;

const MIN_BPM = 60;
const MAX_BPM = 200;

/** Longest stretch of audio worth analysing — more costs memory, not accuracy. */
export const MAX_WINDOW_S = 30;
/** Below this, guess() has too few bars to lock onto a tempo. */
export const MIN_WINDOW_S = 12;

/** Skip auto-detection for files larger than this (bytes). */
const MAX_FETCH_BYTES = 80 * 1024 * 1024; // 80 MB

const fail = (reason: BeatFailure, detail?: string): BeatFail =>
  detail ? { ok: false, reason, detail: detail.slice(0, 120) } : { ok: false, reason };

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Choose which slice of the video to listen to.
 *
 * Analysing from t=0 was wrong for the common case: a tutorial clip opens with
 * a logo card, a talking intro, or silence, and the section the dancer actually
 * trimmed to may start a minute in. Feeding that intro to a beat detector
 * yields either no tempo or the wrong one.
 */
export function pickAnalysisWindow(
  duration: number,
  segStart?: number,
  segEnd?: number,
): { from: number; seconds: number } {
  if (!isFinite(duration) || duration <= 0) return { from: 0, seconds: 0 };

  // Whole video is short: just use all of it.
  if (duration <= MIN_WINDOW_S) return { from: 0, seconds: duration };

  const hasSegment =
    typeof segStart === "number" && typeof segEnd === "number" && segEnd > segStart;

  if (!hasSegment) {
    return { from: 0, seconds: Math.min(MAX_WINDOW_S, duration) };
  }

  let from    = Math.max(0, segStart!);
  let seconds = Math.min(segEnd! - segStart!, MAX_WINDOW_S);

  // A very short trim gives the detector too little to work with. Grow it
  // around the segment rather than abandoning the user's chosen section.
  if (seconds < MIN_WINDOW_S) {
    const grow = (MIN_WINDOW_S - seconds) / 2;
    from    = Math.max(0, from - grow);
    seconds = MIN_WINDOW_S;
  }

  // Clamp into the video, preferring to slide the window back over truncating.
  if (from + seconds > duration) from = Math.max(0, duration - seconds);
  seconds = Math.min(seconds, duration - from);

  return { from, seconds };
}

export async function detectBeatsFromVideo(
  videoUrl: string,
  segment?: { start?: number; end?: number },
): Promise<BeatOutcome> {
  // One GET, not a HEAD followed by a GET. `fetch` exposes headers before the
  // body is buffered, so the size and content-type guards below cost nothing
  // extra — and blob: URLs (every uploaded video) reject HEAD outright, which
  // made the old size guard dead code exactly where it mattered.
  let response: Response;
  try {
    response = await fetch(videoUrl);
  } catch (e) {
    return fail("fetch-failed", msg(e));
  }
  if (!response.ok) return fail("fetch-failed", `HTTP ${response.status}`);

  const type = response.headers.get("content-type") ?? "";
  if (type && !/^(audio|video|application\/octet-stream)/i.test(type)) {
    return fail("not-media", type);
  }

  const len = parseInt(response.headers.get("content-length") ?? "0", 10);
  if (len > MAX_FETCH_BYTES) return fail("too-large", `${Math.round(len / 1e6)}MB`);

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await response.arrayBuffer();
  } catch (e) {
    return fail("fetch-failed", msg(e));
  }

  let audioBuf: AudioBuffer;
  try {
    const audioCtx = new OfflineAudioContext(1, 1, 44100);
    audioBuf = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    // Safari is markedly stricter than Chrome about pulling an AAC track out
    // of a video container, so this is the expected failure on iPhone.
    return fail("decode-failed", msg(e));
  }

  if (!audioBuf || audioBuf.numberOfChannels === 0 || audioBuf.duration <= 0) {
    return fail("no-audio-track");
  }

  const { from, seconds } = pickAnalysisWindow(audioBuf.duration, segment?.start, segment?.end);
  if (seconds <= 0) return fail("no-audio-track");

  let result: { bpm: number; offset: number } | undefined;
  try {
    // guess() takes (buffer, offset, duration) and renders that slice itself,
    // through a 240Hz lowpass. The old code pre-truncated the buffer with its
    // own full OfflineAudioContext render first, which the library then threw
    // away and redid — double the peak memory for no benefit, on the device
    // least able to afford it.
    const { guess } = await import("web-audio-beat-detector");
    result = await guess(audioBuf, from, seconds);
  } catch (e) {
    return fail("no-tempo", msg(e));
  }

  if (!result || !isFinite(result.bpm)) return fail("no-tempo");
  if (result.bpm < MIN_BPM || result.bpm > MAX_BPM) {
    return fail("out-of-range", String(Math.round(result.bpm)));
  }

  return {
    ok:  true,
    bpm: Math.round(result.bpm * 10) / 10,
    // guess() reports its offset within the rendered window, so it has to be
    // shifted back into video time or beat one lands `from` seconds early.
    firstBeatTime: typeof result.offset === "number" ? from + result.offset : undefined,
    from,
    seconds,
  };
}

/** User-facing explanation for each failure. */
export const BEAT_FAILURE_COPY: Record<BeatFailure, string> = {
  "too-large":      "This file is too big to scan for a tempo.",
  "fetch-failed":   "Couldn't read the video's audio.",
  "not-media":      "That link points to a web page, not a video file.",
  "decode-failed":  "This browser can't read the audio inside this video.",
  "no-audio-track": "This video has no audio track.",
  "no-tempo":       "Couldn't find a steady beat in this section.",
  "out-of-range":   "The tempo found didn't look right.",
};
