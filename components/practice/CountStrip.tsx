"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { CUE_PALETTE } from "@/lib/cuePalette";
import type { CountGrid } from "@/lib/countGrid";
import type { CueScript } from "@/lib/cueScript";

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
 * Cells carrying a cue show a dot in that body region's colour, so the shape
 * of the measure is readable before it arrives. Driven by rAF against the
 * video clock rather than React state: this updates every frame, and
 * re-rendering the practice tree at 60fps would cost more than the strip is
 * worth.
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
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <div className="flex w-full max-w-sm gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
          <div
            key={n}
            data-active="0"
            ref={el => { cellRefs.current[i] = el; }}
            className="group flex h-10 flex-1 flex-col items-center justify-center rounded-lg bg-black/35 backdrop-blur-sm transition-transform duration-100 data-[active='1']:scale-110 data-[active='1']:bg-white"
          >
            <span className="text-[13px] font-extrabold leading-none text-white/45 group-data-[active='1']:text-black">
              {n}
            </span>
            {/* Colour is dynamic, so it must be an inline style — an
                interpolated `bg-${colour}` class emits no CSS at all. */}
            <span
              data-dot
              className="mt-1 h-1.5 w-1.5 rounded-full transition-opacity duration-100"
              style={{ opacity: 0 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
