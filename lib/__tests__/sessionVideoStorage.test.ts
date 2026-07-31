import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  storeRecordingSession, loadRecordingSession,
  setRecordingSessionId, clearRecordingSession,
} from "../sessionVideoStorage";
import type { PoseFrame } from "../poseRecorder";

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear:      () => store.clear(),
  });
});

/** ~15fps of 33 keypoints, the shape the recorder actually emits. */
function stream(seconds: number): PoseFrame[] {
  const out: PoseFrame[] = [];
  for (let i = 0; i < seconds * 15; i++) {
    const kps: number[][] = [];
    for (let k = 0; k < 33; k++) kps.push([Math.random() * 1920, Math.random() * 1080, Math.random()]);
    out.push({ t: i * 66, kps });
  }
  return out;
}

describe("recording session handoff", () => {
  it("round-trips a take", async () => {
    const poseFrames = stream(1);
    const refPoseFrames = stream(1);
    await storeRecordingSession({ blobUrl: "blob:abc", poseFrames, refPoseFrames, sessionId: "s1", refStartSec: 0 });

    const back = await loadRecordingSession();
    expect(back!.blobUrl).toBe("blob:abc");
    expect(back!.sessionId).toBe("s1");
    expect(back!.poseFrames).toHaveLength(poseFrames.length);
    expect(back!.refPoseFrames).toHaveLength(refPoseFrames.length);
  });

  /**
   * The bug this file exists for. Both streams used to be JSON-stringified
   * into sessionStorage, whose quota is ~5MB; a three-minute take is ~10MB, so
   * anything past about ninety seconds threw and the user got a generic
   * "please try again" that could never succeed.
   */
  it("handles a three-minute take, which does not fit in sessionStorage", async () => {
    const poseFrames = stream(180);
    const refPoseFrames = stream(180);

    // Prove the premise rather than asserting it: the old payload really is
    // over the quota.
    const oldPayload = JSON.stringify({ blobUrl: "blob:abc", poseFrames, refPoseFrames, sessionId: "s1", refStartSec: 0 });
    expect(oldPayload.length).toBeGreaterThan(5 * 1024 * 1024);

    const ok = await storeRecordingSession({ blobUrl: "blob:abc", poseFrames, refPoseFrames, sessionId: "s1", refStartSec: 0 });
    expect(ok).toBe(true);

    const back = await loadRecordingSession();
    expect(back!.poseFrames).toHaveLength(poseFrames.length);
    expect(back!.refPoseFrames).toHaveLength(refPoseFrames.length);
  });

  it("keeps sessionStorage small — it holds a pointer, not the frames", async () => {
    await storeRecordingSession({
      blobUrl: "blob:abc", poseFrames: stream(60), refPoseFrames: stream(60), sessionId: "s1", refStartSec: 0,
    });
    const raw = sessionStorage.getItem("trace_recording_session")!;
    expect(raw.length).toBeLessThan(1024);
  });

  it("patches the session id without touching the frames", async () => {
    const poseFrames = stream(2);
    await storeRecordingSession({ blobUrl: "blob:abc", poseFrames, refPoseFrames: [], sessionId: "", refStartSec: 0 });
    setRecordingSessionId("real-id");
    const back = await loadRecordingSession();
    expect(back!.sessionId).toBe("real-id");
    expect(back!.poseFrames).toHaveLength(poseFrames.length);
  });

  it("returns null when nothing was stored", async () => {
    expect(await loadRecordingSession()).toBeNull();
  });

  it("survives a take whose poses could not be stored — watchable, not scorable", async () => {
    // A recording with no poses must still load, so the user can watch it back
    // and the UI can say why there is no score.
    await storeRecordingSession({ blobUrl: "blob:abc", poseFrames: [], refPoseFrames: [], sessionId: "s1", refStartSec: 0 });
    const back = await loadRecordingSession();
    expect(back!.blobUrl).toBe("blob:abc");
    expect(back!.poseFrames).toEqual([]);
  });

  it("clears both halves", async () => {
    await storeRecordingSession({
      blobUrl: "blob:abc", poseFrames: stream(1), refPoseFrames: stream(1), sessionId: "s1", refStartSec: 0,
    });
    clearRecordingSession();
    expect(await loadRecordingSession()).toBeNull();
  });
});
