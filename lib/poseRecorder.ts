import type { Keypoint } from "./mediapipe";

/**
 * Compact pose frame: stores only (x, y, score) per keypoint to keep
 * JSONB payload small. For a 3-minute video at ~15 fps ≈ 2 700 frames ×
 * 33 keypoints × 3 numbers → roughly 267 000 numbers (< 3 MB as JSON).
 */
export interface PoseFrame {
  /** Milliseconds from recording start. */
  t: number;
  /** [[x, y, score], …] for each of the 33 BlazePose keypoints. */
  kps: number[][];
}

export class PoseRecorder {
  private frames: PoseFrame[] = [];
  private startTime = 0;
  private active = false;

  start(): void {
    this.frames = [];
    this.startTime = performance.now();
    this.active = true;
  }

  capture(keypoints: Keypoint[]): void {
    if (!this.active || keypoints.length === 0) return;
    this.frames.push({
      t: Math.round(performance.now() - this.startTime),
      kps: keypoints.map((kp) => [kp.x, kp.y, kp.score ?? 0]),
    });
  }

  stop(): PoseFrame[] {
    this.active = false;
    return this.frames;
  }

  get frameCount(): number {
    return this.frames.length;
  }
}
