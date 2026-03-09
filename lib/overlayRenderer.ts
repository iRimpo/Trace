import type { Cue } from "./cueScheduler";
import type { MovementEvent } from "./movementEventDetector";
import type { Accent } from "./countGrid";

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

/** Standard cue alpha: fade in (0–15%), hold (15–70%), fade out (70–100%). */
function cueAlpha(progress: number): number {
  if (progress < 0.15) return progress / 0.15;
  if (progress < 0.70) return 1;
  return 1 - (progress - 0.70) / 0.30;
}

// ── Body-region color palette ─────────────────────────────────────────────

const COLORS = {
  hand:     "#00D4FF",  // Cyan     — wrists, fingers, knees
  foot:     "#34D399",  // Teal     — ankles, heels, toes
  head:     "#FBBF24",  // Amber    — nose/head
  elbow:    "#F97316",  // Orange   — elbows
  hip:      "#A78BFA",  // Purple   — hips
  shoulder: "#60A5FA",  // Sky blue — shoulders
  armBoth:  "#F472B6",  // Pink     — both-arms compound
} as const;

// ── Cap arrow length ──────────────────────────────────────────────────────

const MAX_ARROW_PX = 56;

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

// ── Renderers ─────────────────────────────────────────────────────────────

/** Cyan curved arrow from anchor to destination with dotted trail. */
function renderMoveArrow(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  beatPhase: number,
): void {
  const [ax, ay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const [ex, ey] = toCanvas(ev.x, ev.y, p);

  const rawDx  = ex - ax;
  const rawDy  = ey - ay;
  const rawLen = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  if (rawLen < 4) return;

  const capLen = Math.min(rawLen, MAX_ARROW_PX);
  const s      = capLen / rawLen;
  const dx = rawDx * s, dy = rawDy * s;
  const destX = ax + dx, destY = ay + dy;

  const [qx, qy] = curveControl(ax, ay, destX, destY, 0.22);
  const drawFrac  = Math.min(1, easeOut(progress / 0.5));
  const [tipX, tipY]  = quadBezierAt(ax, ay, qx, qy, destX, destY, drawFrac);
  const [tux, tuy]    = quadBezierTangent(ax, ay, qx, qy, destX, destY, drawFrac);
  const headLen  = Math.max(6, capLen * 0.32);
  const headAng  = 0.38;
  const alpha    = cueAlpha(progress);

  ctx.save();

  if (rawLen > 16) {
    drawDottedTrail(ctx, ax, ay, qx, qy, destX, destY, drawFrac, COLORS.hand, alpha);
  }

  ctx.globalAlpha = alpha;
  ctx.shadowColor = COLORS.hand;
  ctx.shadowBlur  = 10 + beatPhase * 4;
  ctx.strokeStyle = COLORS.hand;
  ctx.lineWidth   = 2.4;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  ctx.beginPath();
  const [startX, startY] = quadBezierAt(ax, ay, qx, qy, destX, destY, 0.06);
  ctx.moveTo(startX, startY);
  const stopT = Math.max(0, drawFrac - 0.03);
  const steps = Math.max(8, Math.round(capLen / 3));
  for (let i = 1; i <= steps; i++) {
    const t = 0.06 + (stopT - 0.06) * (i / steps);
    const [sx, sy] = quadBezierAt(ax, ay, qx, qy, destX, destY, t);
    ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  if (drawFrac > 0.6) {
    const headAlpha = (drawFrac - 0.6) / 0.4;
    ctx.globalAlpha = alpha * headAlpha;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * (tux * Math.cos( headAng) - tuy * Math.sin( headAng)),
      tipY - headLen * (tuy * Math.cos( headAng) + tux * Math.sin( headAng)),
    );
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * (tux * Math.cos(-headAng) - tuy * Math.sin(-headAng)),
      tipY - headLen * (tuy * Math.cos(-headAng) + tux * Math.sin(-headAng)),
    );
    ctx.stroke();
  }

  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle   = COLORS.hand;
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.arc(ax, ay, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Expanding teal ring at foot contact with directional wedge. Accent controls intensity. */
function renderStepPulse(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  accent?: Accent,
): void {
  const [cx, cy] = toCanvas(ev.x, ev.y, p);

  const isStrong = accent === "downbeat";
  const isMedium = accent === "snare";
  const baseR    = isStrong ? 14 : 12;
  const maxR     = isStrong ? 32 : isMedium ? 28 : 26;
  const radius   = baseR + (maxR - baseR) * easeOut(progress);
  const alpha    = Math.max(0, 1 - progress) * (isStrong ? 1 : 0.9);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = COLORS.foot;
  ctx.shadowBlur  = isStrong ? 18 : 12;
  ctx.strokeStyle = COLORS.foot;
  ctx.lineWidth   = isStrong ? 3 : 2.2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (isStrong && progress < 0.7) {
    ctx.globalAlpha = alpha * 0.4;
    ctx.lineWidth   = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle   = COLORS.foot;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Dotted trail showing foot travel path
  const [fax, fay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const fdx = cx - fax, fdy = cy - fay;
  const fLen = Math.sqrt(fdx * fdx + fdy * fdy);
  if (fLen > 6) {
    const [fqx, fqy] = curveControl(fax, fay, cx, cy, 0.15);
    const trailFrac = Math.min(1, easeOut(progress / 0.6));
    drawDottedTrail(ctx, fax, fay, fqx, fqy, cx, cy, trailFrac, COLORS.foot, alpha, 8);

    // Directional wedge at contact point
    if (progress < 0.8) {
      const fAngle     = Math.atan2(fdy, fdx);
      const wedgeR     = radius * 0.5;
      const wedgeSpread = 0.35;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle   = COLORS.foot;
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, wedgeR, fAngle - wedgeSpread, fAngle + wedgeSpread);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Amber pulsing halo with directional tick for head nods/tilts. */
function renderHeadNod(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  beatPhase: number,
): void {
  const [cx, cy] = toCanvas(ev.x, ev.y, p);
  const [ax, ay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const alpha    = cueAlpha(progress);
  const pulse    = 1 + 0.15 * Math.sin(beatPhase * Math.PI * 2);
  const radius   = (18 + 6 * easeOut(progress)) * pulse;

  ctx.save();

  // Translucent fill
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillStyle   = COLORS.head;
  ctx.shadowColor = COLORS.head;
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = COLORS.head;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Direction tick with dotted trail
  const ddx = cx - ax, ddy = cy - ay;
  const len = Math.sqrt(ddx * ddx + ddy * ddy);
  if (len > 3) {
    const drawFrac = Math.min(1, easeOut(progress / 0.4));
    const ux = ddx / len, uy = ddy / len;
    const tickLen = Math.min(len, radius * 0.7) * drawFrac;

    if (len > 8) {
      const [hqx, hqy] = curveControl(ax, ay, cx, cy, 0.18);
      drawDottedTrail(ctx, ax, ay, hqx, hqy, cx, cy, drawFrac, COLORS.head, alpha * 0.7, 5);
    }

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.head;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ux * tickLen, cy + uy * tickLen);
    ctx.stroke();
  }

  ctx.restore();
}

/** Orange arc bracket opening in the direction of elbow bend. */
function renderElbowArc(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  beatPhase: number,
): void {
  const [cx, cy] = toCanvas(ev.x, ev.y, p);
  const [ax, ay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const ddx      = cx - ax, ddy = cy - ay;
  const rawLen   = Math.sqrt(ddx * ddx + ddy * ddy);
  if (rawLen < 3) return;

  const angle    = Math.atan2(ddy, ddx);
  const alpha    = cueAlpha(progress);
  const drawFrac = Math.min(1, easeOut(progress / 0.5));
  const arcR     = 16 + 8 * drawFrac;
  const sweep    = Math.PI * 0.7 * drawFrac;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.elbow;
  ctx.shadowColor = COLORS.elbow;
  ctx.shadowBlur  = 10 + beatPhase * 4;
  ctx.lineWidth   = 2.8;
  ctx.lineCap     = "round";

  ctx.beginPath();
  ctx.arc(cx, cy, arcR, angle - sweep / 2, angle + sweep / 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.4;
  ctx.lineWidth   = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, arcR * 0.65, angle - sweep * 0.4, angle + sweep * 0.4);
  ctx.stroke();

  if (rawLen > 8) {
    const [eqx, eqy] = curveControl(ax, ay, cx, cy, 0.2);
    drawDottedTrail(ctx, ax, ay, eqx, eqy, cx, cy, drawFrac, COLORS.elbow, alpha * 0.6, 5);
  }

  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle   = COLORS.elbow;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Purple diamond indicating center-of-gravity shift. */
function renderHipSway(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  beatPhase: number,
): void {
  const [cx, cy] = toCanvas(ev.x, ev.y, p);
  const [ax, ay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const ddx      = cx - ax, ddy = cy - ay;
  const rawLen   = Math.sqrt(ddx * ddx + ddy * ddy);

  const alpha    = cueAlpha(progress);
  const drawFrac = Math.min(1, easeOut(progress / 0.5));
  const pulse    = 1 + 0.1 * Math.sin(beatPhase * Math.PI * 2);
  const s        = (14 + 6 * drawFrac) * pulse;

  const offsetDist = Math.min(rawLen, 20) * drawFrac;
  const ux = rawLen > 1 ? ddx / rawLen : 0;
  const uy = rawLen > 1 ? ddy / rawLen : 0;
  const ox = cx + ux * offsetDist * 0.3;
  const oy = cy + uy * offsetDist * 0.3;

  ctx.save();

  // Translucent fill
  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle   = COLORS.hip;
  ctx.shadowColor = COLORS.hip;
  ctx.shadowBlur  = 16;
  ctx.beginPath();
  ctx.moveTo(ox,          oy - s);
  ctx.lineTo(ox + s * 0.7, oy);
  ctx.lineTo(ox,          oy + s);
  ctx.lineTo(ox - s * 0.7, oy);
  ctx.closePath();
  ctx.fill();

  // Outline
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = COLORS.hip;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Direction indicator with dotted trail
  if (rawLen > 4) {
    if (rawLen > 10) {
      const [hpqx, hpqy] = curveControl(ax, ay, cx, cy, 0.12);
      drawDottedTrail(ctx, ax, ay, hpqx, hpqy, cx, cy, drawFrac, COLORS.hip, alpha * 0.5, 5);
    }

    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = COLORS.hip;
    ctx.lineWidth   = 1.8;
    ctx.lineCap     = "round";
    const arrLen = Math.min(rawLen * 0.4, 16) * drawFrac;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + ux * arrLen, oy + uy * arrLen);
    ctx.stroke();
  }

  ctx.restore();
}

/** Sky-blue T-bar indicating shoulder/posture shift. */
function renderShoulderShift(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  beatPhase: number,
): void {
  const [cx, cy] = toCanvas(ev.x, ev.y, p);
  const [ax, ay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const ddx      = cx - ax, ddy = cy - ay;
  const rawLen   = Math.sqrt(ddx * ddx + ddy * ddy);
  if (rawLen < 3) return;

  const alpha    = cueAlpha(progress);
  const drawFrac = Math.min(1, easeOut(progress / 0.5));
  const barHalf  = 12 + 8 * drawFrac;
  const capH     = 6;
  const ux = ddx / rawLen, uy = ddy / rawLen;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.shoulder;
  ctx.shadowColor = COLORS.shoulder;
  ctx.shadowBlur  = 8 + beatPhase * 3;
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = "round";

  if (rawLen > 10) {
    const [sqx, sqy] = curveControl(ax, ay, cx, cy, 0.15);
    drawDottedTrail(ctx, ax, ay, sqx, sqy, cx, cy, drawFrac, COLORS.shoulder, alpha * 0.5, 5);
  }

  const startX = cx - ux * barHalf * 0.3;
  const startY = cy - uy * barHalf * 0.3;
  const endX   = cx + ux * barHalf;
  const endY   = cy + uy * barHalf;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Perpendicular end cap
  const px = -uy, py = ux;
  ctx.beginPath();
  ctx.moveTo(endX - px * capH, endY - py * capH);
  ctx.lineTo(endX + px * capH, endY + py * capH);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.4;
  ctx.fillStyle   = COLORS.shoulder;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Pink mirrored wing arcs for simultaneous bilateral arm movement. */
function renderBothArms(
  ctx: CanvasRenderingContext2D,
  ev:  MovementEvent,
  progress: number,
  p:   TransformParams,
  beatPhase: number,
): void {
  const [cx, cy] = toCanvas(ev.x, ev.y, p);
  const [ax, ay] = toCanvas(ev.anchorX, ev.anchorY, p);
  const alpha    = cueAlpha(progress);
  const drawFrac = Math.min(1, easeOut(progress / 0.4));
  const pulse    = 1 + 0.12 * Math.sin(beatPhase * Math.PI * 2);
  const r        = (20 + 14 * drawFrac) * pulse;

  const ddx = cx - ax, ddy = cy - ay;
  const armLen = Math.sqrt(ddx * ddx + ddy * ddy);

  ctx.save();

  if (armLen > 10) {
    const [aqx, aqy] = curveControl(ax, ay, cx, cy, 0.18);
    drawDottedTrail(ctx, ax, ay, aqx, aqy, cx, cy, drawFrac, COLORS.armBoth, alpha * 0.5, 6);
  }

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.armBoth;
  ctx.shadowColor = COLORS.armBoth;
  ctx.shadowBlur  = 12 + beatPhase * 5;
  ctx.lineWidth   = 2.6;
  ctx.lineCap     = "round";

  // Left wing arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.7, Math.PI * 1.3);
  ctx.stroke();

  // Right wing arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.3, Math.PI * 0.3);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle   = COLORS.armBoth;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Outer glow ring
  if (progress < 0.6) {
    ctx.globalAlpha = alpha * 0.2;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Person-bounds clip ────────────────────────────────────────────────────

/**
 * Clip the canvas to the tracked person's bounding box (in canvas space),
 * with enough padding to contain the largest possible shape (arrows + rings).
 * Must be called inside a ctx.save() / ctx.restore() pair.
 */
const CLIP_PAD_NORMAL  = 72; // uncrowded: covers MAX_ARROW_PX (56) + ring halo + shadow
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

// ── Public entry points ───────────────────────────────────────────────────

/**
 * Render a single cue onto the canvas.
 * `now` is performance.now() for progress computation.
 */
export function renderCue(
  ctx:       CanvasRenderingContext2D,
  cue:       Cue,
  now:       number,
  transform: TransformParams,
  beatPhase: number,
): void {
  const progress = Math.min(1, (now - cue.addedAt) / cue.duration);
  const ev       = cue.event;
  const accent   = cue.snappedTick?.accent;
  const t        = ev.crowded && ev.personBounds ? centeredTransform(transform, ev.personBounds) : transform;

  ctx.save();
  applyPersonClip(ctx, ev.personBounds, t, !!ev.crowded);
  switch (ev.type) {
    case "move":     renderMoveArrow(ctx, ev, progress, t, beatPhase);     break;
    case "step":     renderStepPulse(ctx, ev, progress, t, accent);        break;
    case "head":     renderHeadNod(ctx, ev, progress, t, beatPhase);       break;
    case "elbow":    renderElbowArc(ctx, ev, progress, t, beatPhase);      break;
    case "hip":      renderHipSway(ctx, ev, progress, t, beatPhase);       break;
    case "shoulder": renderShoulderShift(ctx, ev, progress, t, beatPhase); break;
    case "arm-both": renderBothArms(ctx, ev, progress, t, beatPhase);      break;
  }
  ctx.restore();
}

/**
 * Render a movement event directly with an explicit progress value (0–1).
 * Used by the deterministic pre-scan replay path.
 */
export function renderEvent(
  ctx:       CanvasRenderingContext2D,
  ev:        MovementEvent,
  progress:  number,
  transform: TransformParams,
  beatPhase: number,
  accent?:   Accent,
): void {
  const t = ev.crowded && ev.personBounds ? centeredTransform(transform, ev.personBounds) : transform;
  ctx.save();
  applyPersonClip(ctx, ev.personBounds, t, !!ev.crowded);
  switch (ev.type) {
    case "move":     renderMoveArrow(ctx, ev, progress, t, beatPhase);     break;
    case "step":     renderStepPulse(ctx, ev, progress, t, accent);        break;
    case "head":     renderHeadNod(ctx, ev, progress, t, beatPhase);       break;
    case "elbow":    renderElbowArc(ctx, ev, progress, t, beatPhase);      break;
    case "hip":      renderHipSway(ctx, ev, progress, t, beatPhase);       break;
    case "shoulder": renderShoulderShift(ctx, ev, progress, t, beatPhase); break;
    case "arm-both": renderBothArms(ctx, ev, progress, t, beatPhase);      break;
  }
  ctx.restore();
}
