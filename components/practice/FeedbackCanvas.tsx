"use client";

import { useRef, useEffect } from "react";
import type { RefObject } from "react";
import { renderCue } from "@/lib/overlayRenderer";
import type { TransformParams } from "@/lib/overlayRenderer";
import { cueAt } from "@/lib/cueScript";
import type { CueScript } from "@/lib/cueScript";

// ── Props ────────────────────────────────────────────────────────────────

export interface FeedbackCanvasProps {
  proVideoRef: RefObject<HTMLVideoElement | null>;
  enabled:     boolean;
  proOffsetX:  number;
  proOffsetY:  number;
  proZoom:     number;
  mirrored:    boolean;
  script:      CueScript | null;
  /** Manual nudge (s) applied to the lookup time. */
  feedbackOffset?: number;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Draws the one cue visible at the reference video's current time.
 *
 * Every frame is a pure lookup: `cueAt(script, t)` with no cursor and no wall
 * clock. Scrubbing, looping, skipping and playbackRate changes therefore land
 * on exactly the cue that belongs at that moment, rather than whatever the
 * previous frame happened to leave behind.
 */
export default function FeedbackCanvas({
  proVideoRef,
  enabled,
  proOffsetX,
  proOffsetY,
  proZoom,
  mirrored,
  script,
  feedbackOffset = 0,
}: FeedbackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Everything the loop reads goes through a ref, so toggling feedback or
  // recomposing the script never tears down and restarts the render loop.
  const transformRef = useRef({ offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored });
  transformRef.current = { offsetX: proOffsetX, offsetY: proOffsetY, zoom: proZoom, mirrored };

  const scriptRef   = useRef(script);
  scriptRef.current = script;
  const enabledRef   = useRef(enabled);
  enabledRef.current = enabled;
  const offsetRef    = useRef(feedbackOffset);
  offsetRef.current  = feedbackOffset;

  useEffect(() => {
    let running = true;
    let rafId = 0;

    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);

      const canvas   = canvasRef.current;
      const proVideo = proVideoRef.current;
      if (!canvas || !proVideo) return;

      const parent = canvas.parentElement;
      if (parent && (canvas.width !== parent.offsetWidth || canvas.height !== parent.offsetHeight)) {
        canvas.width  = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const s = scriptRef.current;
      if (!enabledRef.current || !s) return;

      const pvW = proVideo.videoWidth, pvH = proVideo.videoHeight;
      if (pvW === 0 || pvH === 0) return;

      const t   = proVideo.currentTime + offsetRef.current;
      const hit = cueAt(s, t);
      if (!hit) return;

      // Beat phase from video time, never performance.now(). A wall-clock
      // oscillator made cues keep pulsing while the video was paused or
      // scrubbed, which is what made precomputed feedback feel live.
      const beatS     = 60 / s.bpm;
      const elapsed   = t - s.beatOneOffset;
      const beatPhase = (((elapsed % beatS) + beatS) % beatS) / beatS;

      const transform: TransformParams = {
        pvW, pvH, cW: canvas.width, cH: canvas.height,
        ...transformRef.current,
      };
      renderCue(ctx, hit.cue, hit.progress, transform, beatPhase);
    }

    rafId = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [proVideoRef]);

  // No DOM chrome to convert: the only element this component owns is the
  // canvas itself, and everything visible inside it is painted by
  // `renderCue` from the `cue-*` palette. The stage/paper distinction has no
  // surface to apply to here. `aria-hidden` because the cues are a visual
  // restatement of the reference video, which a screen reader cannot use
  // either; z-index moves to the Tailwind scale so the stacking order sits
  // alongside the rest of the practice screen's layers rather than in an
  // inline style only this file knows about.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
