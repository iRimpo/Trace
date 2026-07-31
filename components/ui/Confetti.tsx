"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ACTION } from "@/lib/brandTokens";

/**
 * The one place in Trace that is allowed to be purely decorative.
 *
 * Canvas rather than DOM nodes: 90 elements each with their own transform is
 * 90 composited layers and a style recalc per frame, and this fires at the
 * exact moment the app is also decoding two videos and finishing a scoring
 * pass. One canvas is one layer.
 *
 * It runs **once** and stops — `requestAnimationFrame` is cancelled when the
 * last piece leaves the frame, so nothing keeps spinning behind the results
 * card for the rest of the session. Confetti that loops is a screensaver.
 *
 * `prefers-reduced-motion` skips it entirely rather than slowing it down. This
 * is the one effect in the app carrying no information at all, so for a user
 * who has asked for less motion the correct amount is none — and the score,
 * the sound and the copy all still land.
 */

interface Props {
  /** Flip to true to fire. Going false and true again re-fires. */
  active: boolean;
  /** How long pieces keep falling, ms. */
  duration?: number;
  className?: string;
}

const COLORS = [ACTION.green, ACTION.blue, ACTION.gold, ACTION.red];

interface Piece {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  w: number; h: number;
  color: string;
}

export default function Confetti({ active, duration = 1200, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!active || reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const W = parent?.offsetWidth ?? 0;
    const H = parent?.offsetHeight ?? 0;
    if (!W || !H) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Two bursts from the lower corners rather than a curtain from the top:
    // a curtain falls *over* the number, which is the thing being celebrated.
    const pieces: Piece[] = [];
    for (let i = 0; i < 90; i++) {
      const fromLeft = i % 2 === 0;
      const spread = (Math.random() - 0.5) * 1.1;
      const speed = 8 + Math.random() * 7;
      pieces.push({
        x: fromLeft ? W * 0.06 : W * 0.94,
        y: H * 0.86,
        vx: (fromLeft ? 1 : -1) * (Math.cos(spread) * speed) * 0.7,
        vy: -Math.abs(Math.sin(spread + 1.1) * speed) - 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
      });
    }

    const GRAVITY = 0.32;
    const DRAG = 0.995;
    const start = performance.now();
    let raf = 0;

    function frame(now: number) {
      const elapsed = now - start;
      ctx!.clearRect(0, 0, W, H);

      let visible = 0;
      for (const p of pieces) {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < H + 40) visible++;

        // Fade out over the last third rather than vanishing mid-air.
        const t = Math.min(elapsed / duration, 1);
        ctx!.globalAlpha = t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34;

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }
      ctx!.globalAlpha = 1;

      // Stop when everything has left the frame or the window has elapsed.
      if (visible > 0 && elapsed < duration) raf = requestAnimationFrame(frame);
      else ctx!.clearRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, duration, reduce]);

  if (reduce) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
