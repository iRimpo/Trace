"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import TogglePill from "@/components/ui/TogglePill";

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

/**
 * The stage vocabulary, inline.
 *
 * These mirror `GLASS_PILL` / `GLASS_BTN` in `TraceTab.tsx`, which is the
 * transport sheet this control is rendered inside. They are duplicated rather
 * than imported because importing a style constant out of a 1500-line screen
 * component drags the whole practice tree into anything that touches tempo.
 * If the vocabulary moves to a shared module, both should move together.
 */
const STAGE_PILL =
  "touch-target inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full " +
  "border px-3 text-hud font-extrabold transition-ui duration-150 ease-out-strong " +
  "active:scale-[0.96] motion-reduce:active:scale-100 motion-reduce:transition-none " +
  "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue focus-visible:ring-offset-1";

const PILL_QUIET =
  `${STAGE_PILL} border-white/15 bg-white/[0.07] text-stage-text/70 hover:text-stage-text hover:bg-white/15`;

/**
 * Tempo entry for the transport sheet.
 *
 * **This control is a prerequisite, not a preference.** Cues land on counts and
 * the count strip needs a grid, so a user who cannot get a tempo out of this
 * control is stuck — and the old version hid that completely. It rendered the
 * same three grey 10px pills whether detection had never run, was running, had
 * failed, or had succeeded; the only difference between "no tempo" and "tempo
 * found" was the presence of a badge, in a row of six other badges.
 *
 * So it now has four visible states, each naming its own next action:
 *
 * | State      | Reads               | Next action                        |
 * |------------|---------------------|------------------------------------|
 * | idle       | "No tempo yet"      | Detect, or Tap it out              |
 * | detecting  | "Finding tempo…"    | (wait) or Tap it out               |
 * | failed     | "No tempo found"    | Tap it out (primary), Retry        |
 * | set        | "128 BPM"           | Adjust                             |
 *
 * The failure state is derived, not passed: this component is given `detecting`
 * but not the typed `BeatFailure`, so "detection ran and left us with nothing"
 * is the most specific thing it can say. The full reason string
 * (`BEAT_FAILURE_COPY`) is shown by `TapTempoSheet`, which does receive it —
 * and "Tap it out" is deliberately the loudest control in this state, because
 * per the handoff the leading suspect (`decode-failed` on iOS Safari) may not
 * be fixable at all, while four taps always works.
 *
 * Everything lives on one horizontal line. The row this sits in scrolls
 * sideways on purpose — wrapping to a second row changes the sheet's height as
 * controls appear, which shoves the timeline down mid-session.
 */
export default function BpmInput({
  bpm,
  onBpmChange,
  onSetBeatOne,
  detecting = false,
  onDetect,
}: BpmInputProps) {
  const [showManual, setShowManual] = useState(false);
  const [tapCount,   setTapCount]   = useState(0);
  /** Detection has finished at least once and produced nothing. */
  const [detectFailed, setDetectFailed] = useState(false);
  const wasDetectingRef = useRef(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (detecting) {
      wasDetectingRef.current = true;
      setDetectFailed(false);
      return;
    }
    if (wasDetectingRef.current) {
      wasDetectingRef.current = false;
      setDetectFailed(bpm === null);
    } else if (bpm !== null) {
      setDetectFailed(false);
    }
  }, [detecting, bpm]);

  useEffect(() => () => { if (tapResetRef.current) clearTimeout(tapResetRef.current); }, []);

  const handleTap = useCallback(() => {
    const now = performance.now();
    if (tapResetRef.current) clearTimeout(tapResetRef.current);

    tapTimesRef.current.push(now);
    setTapCount(tapTimesRef.current.length);
    tapResetRef.current = setTimeout(() => {
      tapTimesRef.current = [];
      setTapCount(0);
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

  const openManual = useCallback(() => setShowManual(true), []);

  /** Enough taps have landed for the running average to mean something. */
  const tapLocked = tapCount >= MIN_TAPS;

  // ── The status readout ───────────────────────────────────────────────
  // One chip, four looks. Fill carries the state, not a hue at 15% alpha:
  // "tempo set" is a solid violet plate, "failed" is a red-edged plate, and
  // both are legible from where the phone is actually propped.
  //
  // `role="status"` is on the three states the *system* enters on its own, and
  // deliberately not on the BPM readout: that number changes on every tap, and
  // a live region there would read the running average aloud four times in a
  // row while the user is trying to keep time.
  const status = (() => {
    if (bpm !== null) {
      return (
        <span className={`${STAGE_PILL} border-cue-hip bg-cue-hip text-stage`}>
          <span className="tabular-nums">{bpm}</span>
          <span className="opacity-70">BPM</span>
        </span>
      );
    }
    if (detecting) {
      return (
        <span className={`${STAGE_PILL} border-white/15 bg-white/[0.07] text-stage-text/80`} role="status">
          <span className="h-3.5 w-3.5 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-current border-t-transparent" />
          Finding tempo…
        </span>
      );
    }
    if (detectFailed) {
      return (
        <span
          className={`${STAGE_PILL} border-duo-red bg-duo-red/20 text-stage-text`}
          role="status"
        >
          <svg className="h-4 w-4 shrink-0 text-duo-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94 2.7 17.1A1.5 1.5 0 0 0 4 19.35h16a1.5 1.5 0 0 0 1.3-2.25L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
          </svg>
          No tempo found
        </span>
      );
    }
    return (
      <span className={`${STAGE_PILL} border-white/15 bg-white/[0.07] text-stage-text/70`}>
        No tempo yet
      </span>
    );
  })();

  /**
   * Auto-detect. Sits next to the status chip while there is no tempo; once a
   * tempo is set it retreats into the Adjust panel — re-running it can only
   * overwrite a tempo the user already accepted, but it has to stay reachable
   * for the case where it detected the wrong one.
   */
  const detectButton = onDetect ? (
    <button
      onClick={onDetect}
      disabled={detecting}
      className={`${PILL_QUIET} disabled:pointer-events-none disabled:opacity-40`}
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
      </svg>
      {bpm !== null ? "Re-detect" : detectFailed ? "Try again" : "Detect"}
    </button>
  ) : null;

  return (
    <div className="flex items-center gap-1.5">
      {status}

      {bpm === null && detectButton}

      {/* The fallback that always works. Loud when detection has failed,
          quiet otherwise — four taps is the answer, not the consolation. */}
      {!showManual && bpm === null && (
        <button
          onClick={openManual}
          className={
            detectFailed
              ? `${STAGE_PILL} border-cue-hip bg-cue-hip text-stage`
              : PILL_QUIET
          }
        >
          Tap it out
        </button>
      )}

      {/* Once a tempo is set, the panel is an edit affordance, not a mode.
          It is also the only way back out of the panel, so it renders whenever
          the panel is open — including before there is a tempo at all. */}
      {(bpm !== null || showManual) && (
        <TogglePill
          active={showManual}
          accent="violet"
          onClick={() => setShowManual(m => !m)}
          title="Edit tempo and beat 1"
        >
          {showManual ? "Done" : "Adjust"}
        </TogglePill>
      )}

      {showManual && (
        <>
          <input
            type="number"
            inputMode="decimal"
            min="40"
            max="250"
            step="0.1"
            value={bpm ?? ""}
            placeholder="BPM"
            aria-label="Beats per minute"
            onChange={e => {
              const v = parseFloat(e.target.value);
              onBpmChange(isNaN(v) ? null : Math.max(40, Math.min(250, v)));
            }}
            className="h-11 w-[4.75rem] shrink-0 rounded-xl border border-white/15 bg-white/[0.07] px-2 text-center text-hud-lg font-extrabold tabular-nums text-stage-text placeholder:font-bold placeholder:text-stage-text/40 outline-none transition-ui focus:border-cue-hip focus:bg-white/[0.12]"
          />

          {/* Tap. Every tap says how many are left, so the target counts down
              toward the user instead of the user guessing when it has enough.
              The pill only *fills* once there are enough taps to have produced
              a real average — filling on tap one would promise a tempo that
              does not exist yet. */}
          <button
            onClick={handleTap}
            className={
              tapLocked
                ? `${STAGE_PILL} border-cue-hip bg-cue-hip text-stage`
                : tapCount > 0
                  ? `${STAGE_PILL} border-cue-hip bg-cue-hip/25 text-stage-text`
                  : `${STAGE_PILL} border-cue-hip/60 bg-white/[0.07] text-stage-text`
            }
          >
            <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
              {Array.from({ length: MIN_TAPS }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-ui duration-150 ${
                    i < tapCount
                      ? tapLocked ? "bg-stage" : "bg-cue-hip"
                      : tapLocked ? "bg-stage/25" : "bg-stage-text/30"
                  }`}
                />
              ))}
            </span>
            {tapCount === 0
              ? `Tap ${MIN_TAPS}×`
              : tapCount < MIN_TAPS
                ? `${MIN_TAPS - tapCount} more`
                : "Keep tapping"}
          </button>

          <button
            onClick={onSetBeatOne}
            className={PILL_QUIET}
            title="Set beat 1 at the current video time (B)"
          >
            Set beat 1
          </button>

          {bpm !== null && (
            <button
              onClick={() => { onBpmChange(null); setTapCount(0); tapTimesRef.current = []; }}
              className={`${STAGE_PILL} border-transparent bg-transparent text-stage-text/55 hover:bg-white/10 hover:text-stage-text`}
            >
              Clear
            </button>
          )}

          {bpm !== null && detectButton}
        </>
      )}
    </div>
  );
}
