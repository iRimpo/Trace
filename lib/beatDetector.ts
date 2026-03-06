/**
 * Auto-detect BPM (and optionally first-beat offset) from a video element's
 * audio track using Web Audio API + web-audio-beat-detector.
 *
 * Falls back gracefully: returns null when the video has no audio, when CORS
 * blocks decoding, or when the library cannot determine a confident BPM.
 */

export interface BeatDetectionResult {
  bpm:            number;
  firstBeatTime?: number; // seconds into the video where beat-1 falls
}

const MIN_BPM = 60;
const MAX_BPM = 200;
const SAMPLE_DURATION = 30; // analyse at most 30 s of audio

/** Skip auto-detection for files larger than this (bytes). */
const MAX_FETCH_BYTES = 80 * 1024 * 1024; // 80 MB

export async function detectBeatsFromVideo(
  videoUrl: string,
): Promise<BeatDetectionResult | null> {
  try {
    // HEAD check to avoid downloading huge video files
    const head = await fetch(videoUrl, { method: "HEAD" }).catch(() => null);
    if (head) {
      const len = parseInt(head.headers.get("content-length") ?? "0", 10);
      if (len > MAX_FETCH_BYTES) return null;
    }

    const response = await fetch(videoUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();

    const audioCtx = new OfflineAudioContext(1, 1, 44100);
    let audioBuf: AudioBuffer;
    try {
      audioBuf = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
      return null; // no audio track or unsupported codec
    }

    const sampleRate  = audioBuf.sampleRate;
    const maxSamples  = Math.min(audioBuf.length, sampleRate * SAMPLE_DURATION);
    const offlineCtx  = new OfflineAudioContext(1, maxSamples, sampleRate);
    const source      = offlineCtx.createBufferSource();
    source.buffer     = audioBuf;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();

    const { guess } = await import("web-audio-beat-detector");
    const result = await guess(rendered);

    if (!result || result.bpm < MIN_BPM || result.bpm > MAX_BPM) return null;

    return {
      bpm:           Math.round(result.bpm * 10) / 10,
      firstBeatTime: result.offset ?? undefined,
    };
  } catch {
    return null;
  }
}
