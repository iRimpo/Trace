import type { PoseFrame } from "./poseRecorder";
import { getVideo, putTake, getTake, deleteTake } from "./videoStore";

const VIDEO_KEY = "trace_video_session";
const RECORDING_KEY = "trace_recording_session";

export interface VideoSession {
  blobUrl: string;
  fileName: string;
  songName: string;
  thumbnailUrl?: string;
  createdAt: number;
  /** identityKey (videoIdentity.ts) — enables IndexedDB restore + scan cache. */
  identityKey?: string;
}

export interface RecordingSession {
  blobUrl: string;
  poseFrames: PoseFrame[];
  refPoseFrames: PoseFrame[];
  sessionId: string;
  /**
   * Where in the reference video the take started, in seconds.
   *
   * Pose frames are timestamped from the start of the *take*, but the
   * reference was playing from wherever the user had scrubbed to. Without this
   * offset the two timelines cannot be related at all, which is why the
   * fallback extraction used to compare a dancer against whatever the
   * reference happened to be doing at the same *absolute* video time.
   */
  refStartSec: number;
}

export function storeVideoSession(data: VideoSession): void {
  sessionStorage.setItem(VIDEO_KEY, JSON.stringify(data));
}

export function loadVideoSession(): VideoSession | null {
  try {
    const raw = sessionStorage.getItem(VIDEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const songName = (parsed.songName as string) ?? (parsed.title as string) ?? "";
    return {
      blobUrl: parsed.blobUrl as string,
      fileName: parsed.fileName as string,
      songName: String(songName),
      thumbnailUrl: parsed.thumbnailUrl as string | undefined,
      createdAt: Number(parsed.createdAt),
      identityKey: parsed.identityKey as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Load the session, re-minting the blob URL from the on-device video store
 * when possible. Object URLs die on hard reload — sessionStorage survives —
 * so the stored blobUrl is only trustworthy within the page load that made
 * it. With an identityKey we can always rebuild a fresh URL from IndexedDB.
 */
export async function restoreVideoSession(): Promise<VideoSession | null> {
  const session = loadVideoSession();
  if (!session) return null;
  if (session.identityKey) {
    const stored = await getVideo(session.identityKey);
    if (stored) {
      return { ...session, blobUrl: URL.createObjectURL(stored.blob) };
    }
  }
  return session; // best effort — may be a live same-document blob URL
}

export function clearVideoSession(): void {
  sessionStorage.removeItem(VIDEO_KEY);
}

/**
 * ── Where a take's pose streams live ─────────────────────────────────────
 *
 * Not in sessionStorage. They used to be, JSON-stringified alongside the blob
 * URL, and sessionStorage has a ~5MB per-origin quota while two streams of a
 * three-minute take are ~10MB. So every take longer than about ninety seconds
 * threw QuotaExceededError, which surfaced as a generic "Failed to save,
 * please try again" that failed identically on every retry — after the user
 * had just danced a whole song. It is the kind of bug that only appears on
 * real content, because a fifteen-second smoke test fits fine.
 *
 * The frames go to IndexedDB, which has no such ceiling. sessionStorage keeps
 * only the handful of small fields it is actually suited for.
 */
const TAKE_KEY = "trace-take";

interface RecordingPointer {
  blobUrl: string;
  sessionId: string;
  takeKey: string;
  refStartSec: number;
}

export async function storeRecordingSession(data: RecordingSession): Promise<boolean> {
  const ok = await putTake(TAKE_KEY, {
    poseFrames: data.poseFrames,
    refPoseFrames: data.refPoseFrames,
  });
  const pointer: RecordingPointer = {
    blobUrl: data.blobUrl,
    sessionId: data.sessionId,
    takeKey: TAKE_KEY,
    refStartSec: data.refStartSec ?? 0,
  };
  try {
    sessionStorage.setItem(RECORDING_KEY, JSON.stringify(pointer));
  } catch {
    return false;
  }
  // Reported rather than thrown: a take whose poses did not persist can still
  // be watched back, it just cannot be scored, and the caller decides how to
  // say so.
  return ok;
}

export async function loadRecordingSession(): Promise<RecordingSession | null> {
  let pointer: RecordingPointer | null = null;
  try {
    const raw = sessionStorage.getItem(RECORDING_KEY);
    if (!raw) return null;
    pointer = JSON.parse(raw) as RecordingPointer;
  } catch {
    return null;
  }
  if (!pointer?.blobUrl) return null;

  const take = await getTake(pointer.takeKey ?? TAKE_KEY);
  return {
    blobUrl: pointer.blobUrl,
    sessionId: pointer.sessionId,
    refStartSec: pointer.refStartSec ?? 0,
    poseFrames: (take?.poseFrames ?? []) as RecordingSession["poseFrames"],
    refPoseFrames: (take?.refPoseFrames ?? []) as RecordingSession["refPoseFrames"],
  };
}

/**
 * Patch just the session id on the stored pointer.
 *
 * The id only exists after the row is created, and the row is created after
 * the frames are stored — but rewriting the frames to attach an id would mean
 * a second multi-megabyte IndexedDB write for the sake of one string.
 */
export function setRecordingSessionId(sessionId: string): void {
  try {
    const raw = sessionStorage.getItem(RECORDING_KEY);
    if (!raw) return;
    const pointer = JSON.parse(raw) as RecordingPointer;
    sessionStorage.setItem(RECORDING_KEY, JSON.stringify({ ...pointer, sessionId }));
  } catch {
    /* noop */
  }
}

export function clearRecordingSession(): void {
  sessionStorage.removeItem(RECORDING_KEY);
  void deleteTake(TAKE_KEY);
}
