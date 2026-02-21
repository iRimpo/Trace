import { Keypoint } from "./mediapipe";

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
