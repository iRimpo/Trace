"use client";

import { useState, useRef, useCallback } from "react";

interface BpmInputProps {
  bpm:              number | null;
  onBpmChange:      (bpm: number | null) => void;
  onSetBeatOne:     () => void;
  detecting?:       boolean;
  onDetect?:        () => void;
  isFullscreen?:    boolean;
}

const MIN_TAPS     = 3;
const TAP_TIMEOUT  = 2000; // reset taps after 2s of inactivity

export default function BpmInput({
  bpm,
  onBpmChange,
  onSetBeatOne,
  detecting = false,
  onDetect,
  isFullscreen = false,
}: BpmInputProps) {
  const [showManual, setShowManual] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    const now = performance.now();
    if (tapResetRef.current) clearTimeout(tapResetRef.current);

    tapTimesRef.current.push(now);
    tapResetRef.current = setTimeout(() => {
      tapTimesRef.current = [];
    }, TAP_TIMEOUT);

    if (tapTimesRef.current.length >= MIN_TAPS) {
      const taps = tapTimesRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const derivedBpm = Math.round((60000 / avg) * 10) / 10;
      if (derivedBpm >= 40 && derivedBpm <= 250) {
        onBpmChange(derivedBpm);
      }
    }
  }, [onBpmChange]);

  const pill = (active: boolean) =>
    `flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all cursor-pointer select-none ${
      active
        ? "bg-violet-500/15 text-violet-500"
        : isFullscreen
          ? "bg-white/5 text-white/30 hover:bg-white/10"
          : "bg-brand-dark/[0.04] text-brand-dark/30 hover:bg-brand-dark/8"
    }`;

  const sub = isFullscreen ? "text-white/20" : "text-brand-dark/20";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* BPM badge */}
      {bpm !== null && (
        <span className="flex items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-[10px] font-bold tabular-nums text-violet-500">
          {bpm} BPM
        </span>
      )}

      {/* Detect button */}
      {onDetect && (
        <button onClick={onDetect} disabled={detecting} className={pill(false)}>
          {detecting ? (
            <div className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
            </svg>
          )}
          {detecting ? "Detecting…" : "Detect"}
        </button>
      )}

      {/* Manual toggle */}
      <button onClick={() => setShowManual(m => !m)} className={pill(showManual)}>
        Manual
      </button>

      {showManual && (
        <>
          {/* Number input */}
          <input
            type="number"
            min="40"
            max="250"
            step="0.1"
            value={bpm ?? ""}
            placeholder="BPM"
            onChange={e => {
              const v = parseFloat(e.target.value);
              onBpmChange(isNaN(v) ? null : Math.max(40, Math.min(250, v)));
            }}
            className={`h-6 w-14 rounded-md border px-1.5 text-center text-[10px] font-semibold tabular-nums outline-none ${
              isFullscreen
                ? "border-white/10 bg-white/5 text-white/70"
                : "border-brand-dark/10 bg-brand-dark/[0.02] text-brand-dark/70"
            }`}
          />

          {/* TAP */}
          <button onClick={handleTap} className={pill(false)}>
            TAP
          </button>

          {/* Set 1 */}
          <button onClick={onSetBeatOne} className={pill(false)} title="Set beat-1 at current video time (B)">
            Set 1
          </button>

          {/* Clear */}
          {bpm !== null && (
            <button
              onClick={() => onBpmChange(null)}
              className={`text-[10px] font-medium ${sub}`}
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  );
}
