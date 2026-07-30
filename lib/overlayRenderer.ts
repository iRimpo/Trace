import { CUE_PALETTE } from "./cuePalette";
import type { BeatCue } from "./cueScript";

// ── Coordinate transform ─────────────────────────────────────────────────

export interface TransformParams {
  pvW:      number;   // reference video width  (px)
  pvH:      number;   // reference video height (px)
  cW:       number;   // canvas width  (px)
  cH:       number;   // canvas height (px)
  offsetX:  number;   // proOffsetX
  offsetY:  number;   // proOffsetY
  zoom:     number;   // proZoom
  mirrored: boolean;
}

/** Convert a reference-video pixel position to canvas space. */
function toCanvas(
  vx: number, vy: number, p: TransformParams,
): [number, number] {
  const vAspect    = p.pvW / p.pvH;
  const cAspect    = p.cW  / p.cH;
  const baseScale  = vAspect > cAspect ? p.cW / p.pvW : p.cH / p.pvH;
  const pixelScale = baseScale * p.zoom;
  const fitW       = p.pvW * pixelScale;
  const fitH       = p.pvH * pixelScale;
  const baseY      = (p.cH - fitH) / 2 + p.offsetY;

  let cx: number;
  if (p.mirrored) {
    cx = (p.cW + fitW) / 2 + p.offsetX - vx * pixelScale;
  } else {
    cx = (p.cW - fitW) / 2 + p.offsetX + vx * pixelScale;
  }
  return [cx, baseY + vy * pixelScale];
}

// ── Animation helpers ─────────────────────────────────────────────────────

function easeOut(t: number): number { return 1 - (1 - t) ** 3; }

/**
 * Progress at which the cue's moment arrives. Before it the cue is a warning,
 * after it a confirmation. Must match LEAD_BEATS in cueScript.ts.
 */
const HIT_AT = 0.75;

/** Alpha envelope across the one-beat window: fade in, hold, fade out. */
function cueAlpha(progress: number): number {
  if (progress < 0.12) return progress / 0.12;
  if (progress < 0.85) return 1;
  return Math.max(0, 1 - (progress - 0.85) / 0.15);
}

// ── Curve + trail helpers ─────────────────────────────────────────────────

function curveControl(
  ax: number, ay: number, cx: number, cy: number, curvature = 0.25,
): [number, number] {
  const mx = (ax + cx) / 2, my = (ay + cy) / 2;
  const dx = cx - ax, dy = cy - ay;
  return [mx - dy * curvature, my + dx * curvature];
}

function quadBezierAt(
  ax: number, ay: number,
  qx: number, qy: number,
  cx: number, cy: number,
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * ax + 2 * u * t * qx + t * t * cx,
    u * u * ay + 2 * u * t * qy + t * t * cy,
  ];
}

function quadBezierTangent(
  ax: number, ay: number,
  qx: number, qy: number,
  cx: number, cy: number,
  t: number,
): [number, number] {
  const u = 1 - t;
  const tx = 2 * u * (qx - ax) + 2 * t * (cx - qx);
  const ty = 2 * u * (qy - ay) + 2 * t * (cy - qy);
  const len = Math.sqrt(tx * tx + ty * ty) || 1;
  return [tx / len, ty / len];
}

function drawDottedTrail(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number,
  qx: number, qy: number,
  cx: number, cy: number,
  drawFrac: number,
  color: string,
  alpha: number,
  dotCount = 6,
): void {
  if (alpha < 0.01 || drawFrac < 0.05) return;
  ctx.fillStyle = color;
  ctx.shadowBlur = 0;
  for (let i = 0; i < dotCount; i++) {
    const t  = (i / dotCount) * drawFrac;
    const fade = 1 - i / dotCount;
    ctx.globalAlpha = alpha * fade * 0.45;
    const [dx, dy] = quadBezierAt(ax, ay, qx, qy, cx, cy, t);
    ctx.beginPath();
    ctx.arc(dx, dy, 1.8 - i * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Person-bounds clip ────────────────────────────────────────────────────

/**
 * Clip the canvas to the tracked person's bounding box (in canvas space),
 * with enough padding to contain the largest possible shape (arrows + rings).
 * Must be called inside a ctx.save() / ctx.restore() pair.
 */
const CLIP_PAD_NORMAL  = 72; // uncrowded: covers the arrow, ring halo and shadow
const CLIP_PAD_CROWDED = 20; // crowded formations: tight clip to avoid bleeding onto neighbours

function applyPersonClip(
  ctx:     CanvasRenderingContext2D,
  bounds:  { x1: number; y1: number; x2: number; y2: number } | undefined,
  p:       TransformParams,
  crowded: boolean,
): void {
  if (!bounds) return;
  const pad = crowded ? CLIP_PAD_CROWDED : CLIP_PAD_NORMAL;
  const [cx1, cy1] = toCanvas(bounds.x1 * p.pvW, bounds.y1 * p.pvH, p);
  const [cx2, cy2] = toCanvas(bounds.x2 * p.pvW, bounds.y2 * p.pvH, p);
  const left  = Math.min(cx1, cx2) - pad;
  const top   = Math.min(cy1, cy2) - pad;
  const right = Math.max(cx1, cx2) + pad;
  const bot   = Math.max(cy1, cy2) + pad;
  ctx.beginPath();
  ctx.rect(left, top, right - left, bot - top);
  ctx.clip();
}

/**
 * For crowded scenes (multiple dancers), compute a modified transform that
 * maps the tracked person's horizontal center to the canvas center.
 * This prevents feedback from appearing scattered across the screen.
 */
function centeredTransform(p: TransformParams, bounds: { x1: number; y1: number; x2: number; y2: number }): TransformParams {
  const personCenterVX = ((bounds.x1 + bounds.x2) / 2) * p.pvW;
  const [currentCX] = toCanvas(personCenterVX, 0, p);
  const extraOffsetX = p.cW / 2 - currentCX;
  return { ...p, offsetX: p.offsetX + extraOffsetX };
}

// ── Cue parts ─────────────────────────────────────────────────────────────

/** Locates the body part. Contracts toward the joint, then pops on the hit. */
function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, color: string, progress: number, alpha: number,
): void {
  const r = progress < HIT_AT
    ? 34 - 14 * easeOut(Math.min(1, progress / HIT_AT))
    : 20 + 16 * easeOut((progress - HIT_AT) / (1 - HIT_AT));

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle   = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.lineWidth   = progress >= HIT_AT ? 3.4 : 2.4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

/** Arrow along the true travel vector, drawn in as the moment approaches. */
function drawTravelGlyph(
  ctx: CanvasRenderingContext2D,
  fx: number, fy: number, tx: number, ty: number,
  color: string, progress: number, alpha: number, maxLen: number,
): void {
  const rawLen = Math.hypot(tx - fx, ty - fy);
  if (rawLen < 6) return;

  const s  = Math.min(1, maxLen / rawLen);
  const ex = fx + (tx - fx) * s, ey = fy + (ty - fy) * s;
  const [qx, qy] = curveControl(fx, fy, ex, ey, 0.18);
  const frac = Math.min(1, easeOut(progress / HIT_AT));

  drawDottedTrail(ctx, fx, fy, qx, qy, ex, ey, frac, color, alpha);

  const [tipX, tipY] = quadBezierAt(fx, fy, qx, qy, ex, ey, frac);
  const [ux,   uy]   = quadBezierTangent(fx, fy, qx, qy, ex, ey, frac);
  const head = Math.max(8, Math.min(rawLen, maxLen) * 0.28);

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 10;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";

  ctx.beginPath();
  ctx.moveTo(fx, fy);
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const [sx, sy] = quadBezierAt(fx, fy, qx, qy, ex, ey, (frac * i) / steps);
    ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  for (const sign of [1, -1]) {
    const a = 0.4 * sign;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - head * (ux * Math.cos(a) - uy * Math.sin(a)),
      tipY - head * (uy * Math.cos(a) + ux * Math.sin(a)),
    );
    ctx.stroke();
  }
}

/** Looping arrow — the roll / wave indicator. */
function drawRollGlyph(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, color: string, progress: number, alpha: number,
): void {
  const r     = 26;
  const sweep = Math.PI * 1.6 * Math.min(1, easeOut(progress / HIT_AT));
  const start = -Math.PI / 2;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.arc(x, y, r, start, start + sweep);
  ctx.stroke();

  // Arrowhead tangent to the loop's leading edge.
  const a  = start + sweep;
  const hx = x + r * Math.cos(a), hy = y + r * Math.sin(a);
  const tx = -Math.sin(a),        ty = Math.cos(a);
  for (const sign of [1, -1]) {
    const ang = 0.5 * sign;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(
      hx - 11 * (tx * Math.cos(ang) - ty * Math.sin(ang)),
      hy - 11 * (ty * Math.cos(ang) + tx * Math.sin(ang)),
    );
    ctx.stroke();
  }
}

/** Expanding pulse for foot contact — the pulse IS the landing. */
function drawStepGlyph(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, color: string, progress: number, alpha: number,
): void {
  if (progress < HIT_AT) return;
  const t = (progress - HIT_AT) / (1 - HIT_AT);
  ctx.globalAlpha = alpha * (1 - t);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 16;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20 + 30 * easeOut(t), 0, Math.PI * 2);
  ctx.stroke();
}

/** Names the body part and the count it lands on. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string, count: number,
  color: string, alpha: number,
): void {
  ctx.shadowColor  = "rgba(0,0,0,0.85)";
  ctx.shadowBlur   = 6;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.globalAlpha = alpha;
  ctx.fillStyle   = "#FFFFFF";
  ctx.font        = "700 15px system-ui, sans-serif";
  ctx.fillText(text, x, y - 46);

  ctx.fillStyle = color;
  ctx.font      = "800 30px system-ui, sans-serif";
  ctx.fillText(String(count), x, y + 52);
}

// ── Public entry point ────────────────────────────────────────────────────

/**
 * Draw the single cue visible at this moment.
 *
 * One grammar for every body part: a ring locating it, a glyph describing the
 * motion, a label naming it, and the count it lands on. The seven bespoke
 * abstract shapes this replaces carried no body-part name and no count, which
 * are the two things a dancer actually needs to read at a glance.
 */
export function renderCue(
  ctx:       CanvasRenderingContext2D,
  cue:       BeatCue,
  progress:  number,
  transform: TransformParams,
  beatPhase: number,
): void {
  const p = cue.crowded && cue.personBounds
    ? centeredTransform(transform, cue.personBounds)
    : transform;

  ctx.save();
  applyPersonClip(ctx, cue.personBounds, p, !!cue.crowded);

  const color    = CUE_PALETTE[cue.region];
  const alpha    = cueAlpha(progress);
  const [tx, ty] = toCanvas(cue.toX,   cue.toY,   p);
  const [fx, fy] = toCanvas(cue.fromX, cue.fromY, p);

  // Arrows are clamped to a third of the dancer's height rather than a fixed
  // pixel count, so length stays meaningful at any zoom.
  const boxH = cue.personBounds
    ? Math.abs(toCanvas(0, cue.personBounds.y2 * p.pvH, p)[1]
             - toCanvas(0, cue.personBounds.y1 * p.pvH, p)[1])
    : p.cH;
  const maxLen = Math.max(40, boxH / 3);

  switch (cue.motion) {
    case "travel": drawTravelGlyph(ctx, fx, fy, tx, ty, color, progress, alpha, maxLen); break;
    case "roll":   drawRollGlyph(ctx, tx, ty, color, progress, alpha);                   break;
    case "step":   drawStepGlyph(ctx, tx, ty, color, progress, alpha);                   break;
    case "hold":   break;
  }

  drawRing(ctx, tx, ty, color, progress, alpha * (0.85 + 0.15 * beatPhase));
  drawLabel(ctx, tx, ty, cue.label, cue.count, color, alpha);

  ctx.restore();
}

