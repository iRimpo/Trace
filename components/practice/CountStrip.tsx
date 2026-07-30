"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { CUE_PALETTE } from "@/lib/cuePalette";
import type { CountGrid } from "@/lib/countGrid";
import type { CueScript } from "@/lib/cueScript";
import { TOP_STACK } from "@/components/practice/chrome";

interface CountStripProps {
  proVideoRef: RefObject<HTMLVideoElement | null>;
  grid:        CountGrid | null;
  script:      CueScript | null;
  visible:     boolean;
}

/**
 * The 1–8 count, always on screen during practice.
 *
 * The previous indicator was a 14px violet circle at 0.35 alpha drawn onto the
 * cue canvas, and it only rendered when a BPM existed — so on a phone with no
 * detected tempo there was no way to tell which move belonged to which count.
 *
 * ── Why the current count is drawn the way it is ─────────────────────────
 *
 * This is the readout the dancer is actually reading, from ten feet, mid-move,
 * in peripheral vision. So the active count differs from the other seven on
 * three axes at once — **fill** (a solid cream plate against near-empty glass),
 * **size** (the digit is ~1.7× the resting digits), and **weight/contrast**
 * (near-black on cream against 45%-alpha cream on dark). Opacity alone was the
 * old signal and it is the weakest of the three: at distance a 45% digit and a
 * 100% digit on the same dark plate are the same grey smudge. Colour alone
 * fails for the same reason it fails on the toggles — hue survives distance far
 * worse than luminance does.
 *
 * Counts 1 and 5 carry a violet tick (violet = counts and tempo everywhere in
 * the app). Eight identical cells give you no way to tell which half of the bar
 * you are in without reading a digit; the tick answers that pre-attentively.
 *
 * The size change is a `scale` on the digit rather than a font-size swap: it
 * composites on the GPU, and a metronome that snaps rather than eases is the
 * honest reading of a beat landing.
 *
 * Cells carrying a cue show a dot in that body region's colour, so the shape
 * of the measure is readable before it arrives. Driven by rAF against the
 * video clock rather than React state: this updates every frame, and
 * re-rendering the practice tree at 60fps would cost more than the strip is
 * worth.
 *
 * One blur for the whole strip, not one per cell. `backdrop-blur-xl` is the
 * most expensive thing on this screen and eight of them stacked over a live
 * camera feed is eight times the cost for no visual difference.
 */
export default function CountStrip({ proVideoRef, grid, script, visible }: CountStripProps) {
  const cellRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef   = useRef(grid);   gridRef.current   = grid;
  const scriptRef = useRef(script); scriptRef.current = script;

  useEffect(() => {
    let running = true;
    let rafId = 0;
    let lastCount = -1;
    let lastMeasure = -1;

    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);

      const g = gridRef.current;
      const v = proVideoRef.current;
      if (!g?.hasBpm || !v) return;

      const info = g.count(v.currentTime);
      if (!info) return;
      // Only touch the DOM when the count actually advances.
      if (info.count === lastCount && info.measureIndex === lastMeasure) return;
      lastCount   = info.count;
      lastMeasure = info.measureIndex;

      // Which counts in THIS measure carry a cue.
      const s = scriptRef.current;
      const dots = new Array<string | null>(8).fill(null);
      if (s) {
        for (const cue of s.cues) {
          if (cue.measureIndex !== info.measureIndex) continue;
          dots[cue.count - 1] = CUE_PALETTE[cue.region];
        }
      }

      for (let i = 0; i < 8; i++) {
        const el = cellRefs.current[i];
        if (!el) continue;
        el.dataset.active = i + 1 === info.count ? "1" : "0";
        const dot = el.querySelector<HTMLSpanElement>("[data-dot]");
        if (dot) {
          dot.style.background = dots[i] ?? "transparent";
          dot.style.opacity    = dots[i] ? "1" : "0";
        }
      }
    }

    rafId = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [proVideoRef]);

  if (!visible || !grid?.hasBpm) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-30 flex justify-center px-3"
      style={{ top: TOP_STACK }}
      aria-hidden="true"
    >
      <div className="flex w-full max-w-sm gap-1 rounded-2xl border border-white/10 bg-stage-glass p-1.5 shadow-stage backdrop-blur-xl">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
          <div
            key={n}
            data-active="0"
            ref={el => { cellRefs.current[i] = el; }}
            className="group relative flex h-14 flex-1 flex-col items-center justify-center rounded-xl bg-white/[0.06] transition-ui duration-100 ease-out-strong data-[active='1']:bg-stage-text data-[active='1']:shadow-stage-sm motion-reduce:transition-none"
          >
            {/* Downbeat tick — which half of the bar you are in, without reading. */}
            {(n === 1 || n === 5) && (
              <span className="absolute inset-x-2 top-1.5 h-[3px] rounded-full bg-cue-hip/70 group-data-[active='1']:bg-cue-hip" />
            )}
            <span className="scale-[0.6] text-2xl font-extrabold leading-none tabular-nums text-stage-text/45 transition-transform duration-100 ease-out-strong group-data-[active='1']:scale-100 group-data-[active='1']:text-stage motion-reduce:transition-none">
              {n}
            </span>
            {/* Colour is dynamic, so it must be an inline style — an
                interpolated `bg-${colour}` class emits no CSS at all. */}
            <span
              data-dot
              className="mt-1.5 h-2 w-2 rounded-full transition-opacity duration-100"
              style={{ opacity: 0 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
