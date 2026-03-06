import { Keypoint } from "./mediapipe";
import { REGION_CAPSULES, REGION_ORDER } from "./ghost";

// BlazePose 33-keypoint body connections (skip face details)
const BODY_CONNECTIONS: [number, number][] = [
  // Torso
  [11, 12],
  [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27],
  // Right leg
  [24, 26], [26, 28],
];

const BODY_KPS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// Segment color mapping for move.ai-style visuals
const SEGMENT_COLORS: Record<string, string> = {
  // Torso — white/neutral
  "11-12": "#FFFFFF",
  "11-23": "#FFFFFF",
  "12-24": "#FFFFFF",
  "23-24": "#FFFFFF",
  // Left side — cyan
  "11-13": "#06B6D4",
  "13-15": "#06B6D4",
  "23-25": "#06B6D4",
  "25-27": "#06B6D4",
  // Right side — magenta
  "12-14": "#EC4899",
  "14-16": "#EC4899",
  "24-26": "#EC4899",
  "26-28": "#EC4899",
};

function segmentKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export interface SkeletonStyle {
  color: string;       // fallback color
  lineWidth: number;
  pointRadius: number;
  minConfidence: number;
  glow: boolean;       // enable glow effect
  colorCoded: boolean; // use per-segment colors
}

const DEFAULT_STYLE: SkeletonStyle = {
  color: "#3B82F6",
  lineWidth: 3,
  pointRadius: 5,
  minConfidence: 0.3,
  glow: true,
  colorCoded: true,
};

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  style: Partial<SkeletonStyle> = {}
) {
  const { color, lineWidth, pointRadius, minConfidence, glow, colorCoded } = {
    ...DEFAULT_STYLE,
    ...style,
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw connections
  for (const [i, j] of BODY_CONNECTIONS) {
    const a = keypoints[i];
    const b = keypoints[j];
    if (!a || !b) continue;
    if ((a.score ?? 0) < minConfidence || (b.score ?? 0) < minConfidence)
      continue;

    const segColor = colorCoded
      ? SEGMENT_COLORS[segmentKey(i, j)] || color
      : color;

    // Glow effect
    if (glow) {
      ctx.save();
      ctx.shadowColor = segColor;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = segColor;
      ctx.lineWidth = lineWidth + 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    // Main line
    ctx.strokeStyle = segColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Draw keypoints
  for (const i of BODY_KPS) {
    const kp = keypoints[i];
    if (!kp || (kp.score ?? 0) < minConfidence) continue;

    // Outer glow
    if (glow) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, pointRadius + 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // Joint dot
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, pointRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Joint border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, pointRadius, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

export function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** Sync canvas internal resolution to its source video */
export function syncCanvasSize(
  canvas: HTMLCanvasElement,
  source: HTMLVideoElement
) {
  const w = source.videoWidth;
  const h = source.videoHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

// ── Ghost silhouette ─────────────────────────────────────────────────

/**
 * Draw a filled pill-shape (capsule) between two points.
 * Uses two semicircles connected by straight sides for a smooth neon tube.
 */
function drawCapsule(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number
) {
  const angle = Math.atan2(by - ay, bx - ax);
  const cosP = Math.cos(angle + Math.PI / 2) * radius;
  const sinP = Math.sin(angle + Math.PI / 2) * radius;

  ctx.beginPath();
  ctx.moveTo(ax + cosP, ay + sinP);
  ctx.lineTo(bx + cosP, by + sinP);
  // Far semicircle at B (counterclockwise on screen, sweeps the far side from A)
  ctx.arc(bx, by, radius, angle + Math.PI / 2, angle - Math.PI / 2, true);
  ctx.lineTo(ax - cosP, ay - sinP);
  // Far semicircle at A (counterclockwise on screen, sweeps the far side from B)
  ctx.arc(ax, ay, radius, angle - Math.PI / 2, angle + Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
}

export interface GhostSilhouetteStyle {
  opacity: number;
  regionColors: Record<string, string>;
  minConfidence: number;
  glowPasses: number; // 1-3, default 2
}

/**
 * Draw a filled glowing silhouette of the pose using capsule primitives.
 * Each body region is independently colored for per-region feedback.
 * Uses multi-pass shadowBlur for a neon bloom effect.
 */
export function drawGhostSilhouette(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  style: GhostSilhouetteStyle
) {
  const { opacity, regionColors, minConfidence, glowPasses } = style;

  // Compute scale factor from torso length relative to 200px reference
  const ls = keypoints[11]; // L_SHOULDER
  const rs = keypoints[12]; // R_SHOULDER
  const lh = keypoints[23]; // L_HIP
  const rh = keypoints[24]; // R_HIP

  let scaleFactor = 1;
  if (ls && rs && lh && rh) {
    const shoulderMidX = (ls.x + rs.x) / 2;
    const shoulderMidY = (ls.y + rs.y) / 2;
    const hipMidX = (lh.x + rh.x) / 2;
    const hipMidY = (lh.y + rh.y) / 2;
    const torso = Math.hypot(shoulderMidX - hipMidX, shoulderMidY - hipMidY);
    scaleFactor = Math.max(0.5, Math.min(2.0, torso / 200));
  }

  // Cap glow passes on large canvases to protect performance
  const effectivePasses = ctx.canvas.width > 1920 ? 1 : glowPasses;

  ctx.save();
  ctx.globalAlpha = opacity;

  for (const region of REGION_ORDER) {
    const color = regionColors[region] ?? "#EC4899";

    if (region === "head") {
      // Head: draw ellipse centered near nose, sized from ear-to-ear
      const nose = keypoints[0];
      if (!nose || (nose.score ?? 0) < Math.min(minConfidence, 0.2)) continue;

      const leftEar = keypoints[7];
      const rightEar = keypoints[8];
      let radius = 28 * scaleFactor;
      if (
        leftEar &&
        rightEar &&
        (leftEar.score ?? 0) >= Math.min(minConfidence, 0.2) &&
        (rightEar.score ?? 0) >= Math.min(minConfidence, 0.2)
      ) {
        radius = Math.hypot(
          leftEar.x - rightEar.x,
          leftEar.y - rightEar.y
        ) * 0.6;
      }

      const cx = nose.x;
      const cy = nose.y - radius * 0.3;

      ctx.fillStyle = color;

      // Glow passes
      for (let pass = 0; pass < effectivePasses; pass++) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16 + pass * 18;
        ctx.translate(cx, cy);
        ctx.scale(1, 1.2);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Solid core (no blur, slightly smaller)
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.translate(cx, cy);
      ctx.scale(1, 1.2);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      continue;
    }

    const capsules = REGION_CAPSULES[region];
    ctx.fillStyle = color;

    for (const [ai, bi, halfWidth] of capsules) {
      const a = keypoints[ai];
      const b = keypoints[bi];
      if (
        !a ||
        !b ||
        (a.score ?? 0) < minConfidence ||
        (b.score ?? 0) < minConfidence
      )
        continue;

      const radius = halfWidth * scaleFactor;

      // Glow passes (outer bloom)
      for (let pass = 0; pass < effectivePasses; pass++) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16 + pass * 18;
        drawCapsule(ctx, a.x, a.y, b.x, b.y, radius);
        ctx.restore();
      }

      // Solid core (no blur, slightly smaller for bright center)
      ctx.save();
      ctx.shadowBlur = 0;
      drawCapsule(ctx, a.x, a.y, b.x, b.y, radius * 0.7);
      ctx.restore();
    }
  }

  ctx.restore();
}
