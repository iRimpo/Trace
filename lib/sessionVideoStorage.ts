import type { PoseFrame } from "./poseRecorder";

const VIDEO_KEY = "trace_video_session";
const RECORDING_KEY = "trace_recording_session";

export interface VideoSession {
  blobUrl: string;
  fileName: string;
  songName: string;
  thumbnailUrl?: string;
  createdAt: number;
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
    };
  } catch {
    return null;
  }
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
