"use client";

import { useRef, useEffect } from "react";
import type { RefObject } from "react";
import { renderEvent } from "@/lib/overlayRenderer";
import type { TransformParams } from "@/lib/overlayRenderer";
import type { CountGrid } from "@/lib/countGrid";
import { CueRuntime, judgeCue, DEFAULT_LEAD_MS, JUDGE_TOLERANCE_MS } from "@/lib/cueRuntime";
import type { CueState } from "@/lib/cueRuntime";
import { entryToEvent } from "@/lib/choreoTimeline";
import type { ChoreoTimeline, TimelineEntry } from "@/lib/choreoTimeline";
import type { PoseFrame } from "@/lib/poseRecorder";

// ── Props ────────────────────────────────────────────────────────────────

export interface FeedbackCanvasProps {
  proVideoRef:      RefObject<HTMLVideoElement | null>;
  enabled:          boolean;
  showCounts:       boolean;
  proOffsetX:       number;
  proOffsetY:       number;
  proZoom:          number;
  mirrored:         boolean;
  timeline:         ChoreoTimeline | null;
  countGrid?:       CountGrid | null;
  feedbackOffset?:  number;
  topOffset?:       number;
  /** Cue lead time in ms — how far ahead of the move cues appear. */
  leadMs?:          number;
  /** Rolling buffer of live user pose frames (t = reference video ms). */
  userFramesRef?:   RefObject<PoseFrame[]>;
  /** Height of the user's webcam video, for normalized judging. */
  userVideoHeightRef?: RefObject<number>;
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
  timeline,
  countGrid = null,
  feedbackOffset = 0,
  topOffset = 0,
  leadMs = DEFAULT_LEAD_MS,
  userFramesRef,
  userVideoHeightRef,
}: FeedbackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const transformRef = useRef<Omit<TransformParams, "pvW" | "pvH" | "cW" | "cH">>({
    offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored,
  });
  transformRef.current = { offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored };

  const countGridRef    = useRef(countGrid);
  countGridRef.current  = countGrid;
  const enabledRef        = useRef(enabled);
  enabledRef.current      = enabled;
  const showCountsRef     = useRef(showCounts);
  showCountsRef.current   = showCounts;
  const fbOffsetRef       = useRef(feedbackOffset);
  fbOffsetRef.current     = feedbackOffset;
  const topOffsetRef      = useRef(topOffset);
  topOffsetRef.current    = topOffset;

  // Deterministic cue playback — rebuilt when the timeline or lead changes.
  const runtimeRef = useRef<CueRuntime | null>(null);
  const timelineRef = useRef(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
    runtimeRef.current = timeline ? new CueRuntime(timeline, { leadMs }) : null;
  }, [timeline, leadMs]);

  const lastTimeRef = useRef(0);

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

      const runtime = runtimeRef.current;

      // Seek backwards / loop restart → cues become re-attemptable.
      if (videoTime < lastTimeRef.current - 0.5) runtime?.resetResolutions();
      lastTimeRef.current = videoTime;

      // ── Deterministic anticipatory cue playback ────────────────────
      if (enabledRef.current && runtime && pvW > 0 && pvH > 0) {
        const { offsetX, offsetY, zoom, mirrored: mir } = transformRef.current;
        const transform: TransformParams = { pvW, pvH, cW, cH, offsetX, offsetY, zoom, mirrored: mir };
        const t = videoTime + fbOffsetRef.current;

        // Judge cues whose tolerance window just closed, from live user poses.
        const frames = userFramesRef?.current;
        const userH  = userVideoHeightRef?.current ?? 0;
        const tl     = timelineRef.current;
        if (frames && frames.length > 0 && userH > 0 && tl) {
          for (const cue of runtime.cuesAt(t)) {
            if (cue.state !== "active") continue;
            if (t * 1000 - cue.entry.time * 1000 >= JUDGE_TOLERANCE_MS) {
              runtime.resolve(
                cue.entry.id,
                judgeCue(cue.entry, tl.videoHeight, frames, userH),
              );
            }
          }
        }

        for (const cue of runtime.cuesAt(t)) {
          renderEvent(
            ctx, entryToEvent(cue.entry), cue.progress, transform, beatPhase,
            cue.entry.accent ?? undefined,
          );
          drawCueBadge(ctx, cue.entry, cue.state, transform);
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
  }, [enabled, showCounts, proVideoRef, userFramesRef, userVideoHeightRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 20 }}
    />
  );
}

// ── Cue badge: count label + hit/miss feedback ────────────────────────────

const BADGE_COLORS: Partial<Record<CueState, string>> = {
  hit:     "rgba(74,222,128,0.95)",   // green
  partial: "rgba(250,204,21,0.95)",   // yellow
  miss:    "rgba(248,113,113,0.95)",  // red
};

function drawCueBadge(
  ctx:       CanvasRenderingContext2D,
  entry:     TimelineEntry,
  state:     CueState,
  transform: TransformParams,
): void {
  const { pvW, pvH, cW, cH, offsetX, offsetY, zoom, mirrored } = transform;
  const scale = Math.max(cW / pvW, cH / pvH) * zoom;
  const drawW = pvW * scale, drawH = pvH * scale;
  let x = (cW - drawW) / 2 + offsetX + entry.x * scale;
  const y = (cH - drawH) / 2 + offsetY + entry.y * scale;
  if (mirrored) x = cW - x;

  ctx.save();
  if (state === "upcoming" && entry.count !== null) {
    // Count label floating above the cue: "5"
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(String(entry.count), x, y - 26);
  } else if (state === "hit" || state === "partial" || state === "miss") {
    const color = BADGE_COLORS[state]!;
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
    if (state === "hit") {
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x - 2, y + 5);
      ctx.lineTo(x + 6, y - 5);
      ctx.stroke();
    } else if (state === "miss") {
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5);
      ctx.stroke();
    }
  }
  ctx.restore();
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
