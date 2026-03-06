import type { Keypoint } from "@/lib/mediapipe";

const NOSE        = 0;
const L_SHOULDER  = 11;
const R_SHOULDER  = 12;
const L_HIP       = 23;
const R_HIP       = 24;

/**
 * Extract a square face/head thumbnail from a video frame using BlazePose keypoints.
 * Returns a base64 JPEG data-URL, or null if extraction is not possible.
 *
 * @param video      - The video element (must be at the desired frame, readyState >= 2)
 * @param kps        - BlazePose keypoints for one person
 * @param outputSize - Output canvas dimension in px (square), default 120
 */
export function extractFaceThumbnail(
  video: HTMLVideoElement,
  kps: Keypoint[],
  outputSize = 120,
): string | null {
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (!vW || !vH || video.readyState < 2) return null;

  const nose = kps[NOSE];
  const ls   = kps[L_SHOULDER];
  const rs   = kps[R_SHOULDER];

  if (!nose || (nose.score ?? 0) < 0.25) return null;
  if (!ls   || (ls.score   ?? 0) < 0.2)  return null;
  if (!rs   || (rs.score   ?? 0) < 0.2)  return null;

  // Shoulder width in pixels → estimate head width
  const shoulderWidthPx = Math.abs(ls.x - rs.x);
  if (shoulderWidthPx < 5) return null;

  // Torso length from shoulder→hip (fall back to estimate from shoulder width)
  let torsoLengthPx: number;
  const lh = kps[L_HIP], rh = kps[R_HIP];
  if (lh && rh && (lh.score ?? 0) > 0.15 && (rh.score ?? 0) > 0.15) {
    const hipMidY      = (lh.y + rh.y) / 2;
    const shoulderMidY = (ls.y + rs.y) / 2;
    torsoLengthPx = Math.abs(hipMidY - shoulderMidY);
  } else {
    torsoLengthPx = shoulderWidthPx * 1.2;
  }

  // Face bbox: head height ≈ 0.4× torso, head width ≈ 0.7× shoulder width
  const headW  = shoulderWidthPx * 0.7;
  const headH  = torsoLengthPx   * 0.42;
  const pad    = Math.max(10, headW * 0.25);

  // Crop rect centered on nose, extending more upward than down
  const cx = nose.x;
  const cy = nose.y;

  const left   = Math.max(0,  cx - headW / 2 - pad);
  const top    = Math.max(0,  cy - headH * 0.7 - pad);
  const right  = Math.min(vW, cx + headW / 2 + pad);
  const bottom = Math.min(vH, cy + headH * 0.35 + pad);

  const cropW = right  - left;
  const cropH = bottom - top;
  if (cropW < 8 || cropH < 8) return null;

  const canvas = document.createElement("canvas");
  canvas.width  = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outputSize, outputSize);

  try {
    ctx.drawImage(video, left, top, cropW, cropH, 0, 0, outputSize, outputSize);
  } catch {
    return null;
  }

  return canvas.toDataURL("image/jpeg", 0.75);
}
