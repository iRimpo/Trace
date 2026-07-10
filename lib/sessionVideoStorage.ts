import type { PoseFrame } from "./poseRecorder";
import { getVideo } from "./videoStore";

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

export function storeRecordingSession(data: RecordingSession): void {
  sessionStorage.setItem(RECORDING_KEY, JSON.stringify(data));
}

export function loadRecordingSession(): RecordingSession | null {
  try {
    const raw = sessionStorage.getItem(RECORDING_KEY);
    return raw ? (JSON.parse(raw) as RecordingSession) : null;
  } catch {
    return null;
  }
}

export function clearRecordingSession(): void {
  sessionStorage.removeItem(RECORDING_KEY);
}
