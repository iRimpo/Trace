"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TapTempoSheetProps {
  onConfirm: (bpm: number) => void;
  onCancel:  () => void;
  onRetry:   () => void;
  detecting: boolean;
  /** Why auto-detection failed, if it has run and failed. */
  failure:   string | null;
}

const MIN_TAPS = 4;
/** Taps further apart than this start a new measurement. */
const TAP_RESET_MS = 2500;

/**
 * Manual tempo entry, shown when auto-detection has not produced a BPM.
 *
 * Auto-detection fetches and decodes the entire video, which fails on iOS for
 * large files. Rather than silently composing cues against no grid — which
 * produced instructions on a meaningless 0.1s spacing and no counts at all —
 * feedback now requires a tempo, and this is how you supply one.
 */
export default function TapTempoSheet({
  onConfirm, onCancel, onRetry, detecting, failure,
}: TapTempoSheetProps) {
  const tapsRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);

  const tap = useCallback(() => {
    const now = performance.now();
    const list = tapsRef.current;
    if (list.length > 0 && now - list[list.length - 1] > TAP_RESET_MS) list.length = 0;
    list.push(now);
    if (list.length > 12) list.shift();
    setTaps(list.length);

    if (list.length >= MIN_TAPS) {
      const spans: number[] = [];
      for (let i = 1; i < list.length; i++) spans.push(list[i] - list[i - 1]);
      const mean = spans.reduce((a, b) => a + b, 0) / spans.length;
      if (mean > 0) setBpm(Math.round(60000 / mean));
    }
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <p className="text-sm font-bold text-ink">Set the tempo</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/50">
          {detecting
            ? "Still listening to the track — or tap it out yourself."
            : "Cues land on counts, so Trace needs the tempo. Tap along with the beat."}
        </p>

        {/* Naming the failure matters: "couldn't find a beat" means retry on a
            different section, "no audio track" means never bother. */}
        {!detecting && failure && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5">
            <span aria-hidden className="text-[11px] leading-none">⚠</span>
            <div className="flex-1">
              <p className="text-[11px] leading-relaxed text-amber-900">{failure}</p>
              <button
                onClick={onRetry}
                className="mt-1 text-[10px] font-semibold text-amber-900/70 underline underline-offset-2"
              >
                Try detecting again
              </button>
            </div>
          </div>
        )}

        <button
          onClick={tap}
          className="mt-4 h-28 w-full rounded-xl bg-ink text-white transition-transform active:scale-[0.98]"
        >
          <span className="block text-3xl font-extrabold tabular-nums">
            {bpm ?? "–"}
          </span>
          <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            {taps < MIN_TAPS ? `Tap ${MIN_TAPS - taps} more` : "BPM · keep tapping to refine"}
          </span>
        </button>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/[0.06] py-2.5 text-xs font-semibold text-ink/60"
          >
            Cancel
          </button>
          <button
            disabled={bpm === null}
            onClick={() => bpm !== null && onConfirm(bpm)}
            className="flex-1 rounded-full bg-ink py-2.5 text-xs font-semibold text-white disabled:opacity-30"
          >
            Use this tempo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
