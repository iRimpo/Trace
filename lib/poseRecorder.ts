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
      /*
        Quantised, not raw.

        MediaPipe hands back full doubles — `643.2847290039062` serialises to
        17 characters, and there are 99 of those per frame. At 15fps a
        three-minute take is ~10MB of JSON across the two streams, which is
        double the sessionStorage quota it used to be written into.

        Nothing is lost: these are pixel coordinates, so a tenth of a pixel is
        far below the noise floor of the detector itself, and `score` is only
        ever compared against a 0.3 threshold. Rounding cuts the payload by
        more than half before it is stored anywhere.
      */
      kps: keypoints.map((kp) => [
        Math.round(kp.x * 10) / 10,
        Math.round(kp.y * 10) / 10,
        Math.round((kp.score ?? 0) * 1000) / 1000,
      ]),
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
