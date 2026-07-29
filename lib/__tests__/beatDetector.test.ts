import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pickAnalysisWindow, detectBeatsFromVideo, MAX_WINDOW_S, MIN_WINDOW_S } from "../beatDetector";

// ── Analysis window ───────────────────────────────────────────────────────

describe("pickAnalysisWindow", () => {
  it("analyses the practice segment when it is long enough", () => {
    // 31->63 is 32s, which caps to the 30s max window.
    expect(pickAnalysisWindow(180, 31, 63)).toEqual({ from: 31, seconds: MAX_WINDOW_S });
  });

  it("caps a long segment at the max window", () => {
    const w = pickAnalysisWindow(300, 10, 200);
    expect(w.from).toBe(10);
    expect(w.seconds).toBe(MAX_WINDOW_S);
  });

  it("widens a segment that is too short to read a tempo from", () => {
    // A 4s trim gives guess() nothing to work with; grow around it.
    const w = pickAnalysisWindow(180, 40, 44);
    expect(w.seconds).toBeGreaterThanOrEqual(MIN_WINDOW_S);
    expect(w.from).toBeLessThanOrEqual(40);
  });

  it("falls back to the start of the video when no segment is given", () => {
    expect(pickAnalysisWindow(180)).toEqual({ from: 0, seconds: MAX_WINDOW_S });
  });

  it("never runs past the end of the video", () => {
    const w = pickAnalysisWindow(20, 15, 60);
    expect(w.from + w.seconds).toBeLessThanOrEqual(20);
    expect(w.from).toBeGreaterThanOrEqual(0);
  });

  it("handles a video shorter than the minimum window", () => {
    const w = pickAnalysisWindow(6, 1, 5);
    expect(w.from).toBe(0);
    expect(w.seconds).toBeCloseTo(6, 5);
  });
});

// ── Failure reporting ─────────────────────────────────────────────────────
//
// Every one of these used to be an indistinguishable `null`, which is why the
// real cause of a failed tempo detection could not be identified from a phone.

const guessMock = vi.fn();
vi.mock("web-audio-beat-detector", () => ({ guess: (...a: unknown[]) => guessMock(...a) }));

function fakeBuffer(duration = 180) {
  return {
    duration,
    sampleRate: 44100,
    length: duration * 44100,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(8),
  } as unknown as AudioBuffer;
}

function stubFetch(init: { type?: string; length?: string; ok?: boolean; reject?: boolean }) {
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (init.reject) throw new Error("Failed to fetch");
    return {
      ok: init.ok ?? true,
      status: init.ok === false ? 404 : 200,
      headers: {
        get: (k: string) =>
          k === "content-type" ? (init.type ?? "video/mp4")
          : k === "content-length" ? (init.length ?? "1000")
          : null,
      },
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  }));
}

function stubAudio(decode: () => Promise<AudioBuffer>) {
  vi.stubGlobal("OfflineAudioContext", class {
    decodeAudioData() { return decode(); }
  });
}

beforeEach(() => { guessMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("detectBeatsFromVideo", () => {
  it("reports a non-media URL rather than trying to decode it", async () => {
    // Link imports return the TikTok/YouTube *page* URL, so the body is HTML.
    stubFetch({ type: "text/html" });
    stubAudio(async () => fakeBuffer());
    const out = await detectBeatsFromVideo("https://tiktok.com/@x/video/1");
    expect(out).toMatchObject({ ok: false, reason: "not-media" });
  });

  it("reports a file over the size cap", async () => {
    stubFetch({ length: String(500 * 1024 * 1024) });
    stubAudio(async () => fakeBuffer());
    const out = await detectBeatsFromVideo("blob:x");
    expect(out).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("reports a failed network fetch", async () => {
    stubFetch({ reject: true });
    stubAudio(async () => fakeBuffer());
    const out = await detectBeatsFromVideo("blob:x");
    expect(out).toMatchObject({ ok: false, reason: "fetch-failed" });
  });

  it("reports a container decodeAudioData will not open", async () => {
    // Safari is far stricter than Chrome about audio inside a video container.
    stubFetch({});
    stubAudio(async () => { throw new Error("Decoding failed"); });
    const out = await detectBeatsFromVideo("blob:x");
    expect(out).toMatchObject({ ok: false, reason: "decode-failed" });
    expect((out as { detail?: string }).detail).toContain("Decoding failed");
  });

  it("reports a decoded file that carries no audio", async () => {
    stubFetch({});
    stubAudio(async () => fakeBuffer(0));
    const out = await detectBeatsFromVideo("blob:x");
    expect(out).toMatchObject({ ok: false, reason: "no-audio-track" });
  });

  it("reports when no consistent tempo can be found", async () => {
    stubFetch({});
    stubAudio(async () => fakeBuffer());
    guessMock.mockRejectedValue(new Error("could not detect tempo"));
    const out = await detectBeatsFromVideo("blob:x");
    expect(out).toMatchObject({ ok: false, reason: "no-tempo" });
  });

  it("reports a tempo outside the plausible range instead of using it", async () => {
    stubFetch({});
    stubAudio(async () => fakeBuffer());
    guessMock.mockResolvedValue({ bpm: 420, offset: 0 });
    const out = await detectBeatsFromVideo("blob:x");
    expect(out).toMatchObject({ ok: false, reason: "out-of-range" });
  });

  it("analyses the practice segment, not the first 30 seconds", async () => {
    stubFetch({});
    stubAudio(async () => fakeBuffer(180));
    guessMock.mockResolvedValue({ bpm: 120, offset: 0.25 });
    const out = await detectBeatsFromVideo("blob:x", { start: 31, end: 63 });
    expect(out).toMatchObject({ ok: true, bpm: 120, from: 31, seconds: MAX_WINDOW_S });
    // guess() takes (buffer, offset, duration) and renders that slice itself.
    expect(guessMock).toHaveBeenCalledWith(expect.anything(), 31, MAX_WINDOW_S);
  });

  it("returns beat one in video time, not relative to the analysis window", async () => {
    stubFetch({});
    stubAudio(async () => fakeBuffer(180));
    guessMock.mockResolvedValue({ bpm: 120, offset: 0.25 });
    const out = await detectBeatsFromVideo("blob:x", { start: 31, end: 63 });
    // The window starts at 31s, so an offset of 0.25 within it is 31.25s in.
    expect((out as { firstBeatTime: number }).firstBeatTime).toBeCloseTo(31.25, 5);
  });
});
