"use client";

import { useRef, useEffect } from "react";
import type { RefObject } from "react";
import type { MovementEvent, EventType } from "@/lib/movementEventDetector";
import { renderEvent } from "@/lib/overlayRenderer";
import type { TransformParams } from "@/lib/overlayRenderer";
import type { CountGrid } from "@/lib/countGrid";
import type { Accent } from "@/lib/countGrid";

// ── Cue duration in video-seconds per event type ─────────────────────────

const DURATION_S: Record<EventType, number> = {
  step:       0.95,
  "arm-both": 0.90,
  move:       0.85,
  head:       1.00,
  hip:        0.80,
  elbow:      0.80,
  shoulder:   0.75,
};

const MAX_VISIBLE = 8;

const PRIORITY: Record<EventType, number> = {
  step: 5, "arm-both": 4, move: 3, head: 2, hip: 2, elbow: 1, shoulder: 1,
};

// ── Props ────────────────────────────────────────────────────────────────

export interface FeedbackCanvasProps {
  proVideoRef:      RefObject<HTMLVideoElement | null>;
  enabled:          boolean;
  showCounts:       boolean;
  proOffsetX:       number;
  proOffsetY:       number;
  proZoom:          number;
  mirrored:         boolean;
  preScannedEvents: MovementEvent[];
  countGrid?:       CountGrid | null;
  feedbackOffset?:  number;
  topOffset?:       number;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FeedbackCanvas({
  proVideoRef,
  enabled,
  showCounts,
  proOffsetX,
  proOffsetY,
  proZoom,
  mirrored,
  preScannedEvents,
  countGrid = null,
  feedbackOffset = 0,
  topOffset = 0,
}: FeedbackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const transformRef = useRef<Omit<TransformParams, "pvW" | "pvH" | "cW" | "cH">>({
    offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored,
  });
  transformRef.current = { offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored };

  const countGridRef    = useRef(countGrid);
  countGridRef.current  = countGrid;
  const eventsRef       = useRef(preScannedEvents);
  eventsRef.current     = preScannedEvents;
  const enabledRef        = useRef(enabled);
  enabledRef.current      = enabled;
  const showCountsRef     = useRef(showCounts);
  showCountsRef.current   = showCounts;
  const fbOffsetRef       = useRef(feedbackOffset);
  fbOffsetRef.current     = feedbackOffset;
  const topOffsetRef      = useRef(topOffset);
  topOffsetRef.current    = topOffset;

  useEffect(() => {
    if (!enabled && !showCounts) {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let running = true;
    let rafId: number;

    function loop() {
      if (!running) return;

      const canvas   = canvasRef.current;
      const proVideo = proVideoRef.current;
      if (!canvas || !proVideo) {
        if (running) rafId = requestAnimationFrame(loop);
        return;
      }

      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.offsetWidth, h = parent.offsetHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w; canvas.height = h;
        }
      }

      const cW  = canvas.width;
      const cH  = canvas.height;
      const pvW = proVideo.videoWidth;
      const pvH = proVideo.videoHeight;
      const videoTime = proVideo.currentTime;
      const grid      = countGridRef.current;
      const beatPhase = grid?.hasBpm
        ? grid.beatPhase(videoTime)
        : 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * (performance.now() / 1000));

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, cW, cH);

      // ── Deterministic event replay ─────────────────────────────────
      if (enabledRef.current && pvW > 0 && pvH > 0) {
        const events = eventsRef.current;
        const { offsetX, offsetY, zoom, mirrored: mir } = transformRef.current;
        const transform: TransformParams = { pvW, pvH, cW, cH, offsetX, offsetY, zoom, mirrored: mir };

        const active = collectActive(events, videoTime + fbOffsetRef.current);

        for (const { event, progress, accent } of active) {
          renderEvent(ctx, event, progress, transform, beatPhase, accent);
        }
      }

      // ── Count indicator ────────────────────────────────────────────
      if (showCountsRef.current && grid?.hasBpm) {
        const info = grid.count(videoTime);
        if (info) {
          drawCountIndicator(ctx, cW, info.count, info.accent === "downbeat", beatPhase, topOffsetRef.current);
        }
      }

      if (running) rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [enabled, showCounts, proVideoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 20 }}
    />
  );
}

// ── Collect active events for the current video time ──────────────────────

interface ActiveEvent {
  event:    MovementEvent;
  progress: number;
  accent?:  Accent;
}

function collectActive(
  events:    MovementEvent[],
  videoTime: number,
): ActiveEvent[] {
  const maxLookback = 1.0;
  const startIdx = lowerBound(events, videoTime - maxLookback);
  const result: ActiveEvent[] = [];

  for (let i = startIdx; i < events.length; i++) {
    const ev = events[i];
    if (ev.videoTime > videoTime) break;

    const dur      = DURATION_S[ev.type];
    const elapsed  = videoTime - ev.videoTime;
    if (elapsed > dur) continue;

    const progress = elapsed / dur;
    result.push({ event: ev, progress });
  }

  if (result.length > MAX_VISIBLE) {
    result.sort((a, b) => PRIORITY[b.event.type] - PRIORITY[a.event.type] || a.progress - b.progress);
    result.length = MAX_VISIBLE;
  }

  return result;
}

function lowerBound(events: MovementEvent[], time: number): number {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].videoTime < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Count indicator ───────────────────────────────────────────────────────

function drawCountIndicator(
  ctx:        CanvasRenderingContext2D,
  canvasW:    number,
  count:      number,
  isDownbeat: boolean,
  phase:      number,
  topOff:     number = 0,
): void {
  const cx = canvasW / 2;
  const cy = 32 + topOff;
  const nearBeat = 1 - Math.min(phase, 1 - phase) * 2;
  const scale    = 1 + nearBeat * 0.18;
  const baseR    = isDownbeat ? 16 : 14;
  const r        = baseR * scale;

  ctx.save();

  ctx.globalAlpha = 0.7 + nearBeat * 0.3;
  ctx.fillStyle   = isDownbeat ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.35)";
  ctx.shadowColor = "#8B5CF6";
  ctx.shadowBlur  = 6 + nearBeat * 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle   = "#FFFFFF";
  ctx.font        = `bold ${Math.round(14 * scale)}px system-ui, sans-serif`;
  ctx.textAlign   = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), cx, cy + 1);

  ctx.restore();
}
