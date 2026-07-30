"use client";

import { useCallback, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Pressable from "@/components/ui/Pressable";

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
 *
 * ── Why this reads as the answer, not the apology ─────────────────────────
 *
 * Per the handoff, the leading suspect for the phone failure is
 * `decode-failed` — Safari refusing to extract AAC from an MP4 container — and
 * that may not be fixable from here at all. The workarounds are substantial;
 * four taps is four taps. So this sheet is built as the primary path: the tap
 * pad is the largest target on the screen, the failure notice is a footnote
 * above it rather than the headline, and the confirm is a full commit button
 * instead of a text link.
 *
 * The pad fills in violet the moment it has enough taps to mean something —
 * fill, not a tint, because the confirmation has to survive the same distance
 * everything else on this screen does. Four dots count the taps down so the
 * user is never guessing how many more it wants.
 */
export default function TapTempoSheet({
  onConfirm, onCancel, onRetry, detecting, failure,
}: TapTempoSheetProps) {
  const tapsRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);
  const reduceMotion = useReducedMotion();

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

  const locked = bpm !== null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: reduceMotion ? 0 : 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduceMotion ? 0 : 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        role="dialog"
        aria-modal="true"
        aria-label="Set the tempo"
        // The stage vocabulary: dark glass, blurred drop, hairline white edge.
        // This was `bg-white` — the brightest thing on a screen whose entire
        // job is to show a camera feed.
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-stage-glass p-5 shadow-stage backdrop-blur-xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <p className="text-lg font-extrabold tracking-tight text-stage-text">Set the tempo</p>
        <p className="mt-1.5 text-hud font-medium leading-relaxed text-stage-text/70">
          {detecting
            ? "Still listening to the track — or just tap it out, which takes four taps."
            : "Counts and cues land on the beat, so Trace needs the tempo. Four taps is enough."}
        </p>

        {/* Naming the failure matters: "couldn't find a beat" means retry on a
            different section, "no audio track" means never bother. Kept above
            the pad and deliberately compact — it explains why you are here, it
            is not the thing you came to do. */}
        {!detecting && failure && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-duo-red/40 bg-duo-red/15 p-3">
            <svg className="mt-px h-4 w-4 shrink-0 text-duo-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94 2.7 17.1A1.5 1.5 0 0 0 4 19.35h16a1.5 1.5 0 0 0 1.3-2.25L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-hud font-bold leading-relaxed text-stage-text">{failure}</p>
              <button
                onClick={onRetry}
                className="touch-target mt-1 inline-flex min-h-[36px] items-center text-hud font-extrabold text-stage-text/70 underline underline-offset-4 transition-ui hover:text-stage-text"
              >
                Try detecting again
              </button>
            </div>
          </div>
        )}

        {detecting && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.07] p-3">
            <span className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-stage-text/50 border-t-transparent" />
            <p className="text-hud font-bold text-stage-text/80">Listening for a beat…</p>
          </div>
        )}

        {/* The tap pad. The biggest target on the screen, on purpose. */}
        <button
          onClick={tap}
          aria-label="Tap in time with the beat"
          className={[
            "relative mt-4 flex h-40 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2",
            locked
              ? "border-cue-hip bg-cue-hip text-stage"
              : "border-white/15 bg-white/[0.07] text-stage-text",
            "transition-ui duration-150 ease-out-strong",
            "active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none",
            "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue",
          ].join(" ")}
        >
          {/* One ripple per tap, keyed so a rapid re-tap restarts it rather
              than queueing. Skipped entirely under reduced motion — the digit
              and the dots already carry the feedback. */}
          {!reduceMotion && taps > 0 && (
            <motion.span
              key={taps}
              aria-hidden="true"
              initial={{ opacity: 0.35, scale: 0.85 }}
              animate={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`pointer-events-none absolute inset-0 rounded-2xl ${locked ? "bg-stage" : "bg-stage-text"}`}
            />
          )}

          <span className="relative text-6xl font-extrabold leading-none tabular-nums tracking-tight">
            {bpm ?? "–"}
          </span>

          <span className={`relative mt-3 flex items-center gap-2 ${locked ? "text-stage/70" : "text-stage-text/50"}`}>
            {Array.from({ length: MIN_TAPS }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full transition-ui duration-150 ${
                  i < taps
                    ? locked ? "bg-stage" : "bg-stage-text"
                    : locked ? "bg-stage/25" : "bg-stage-text/25"
                }`}
              />
            ))}
          </span>

          <span className={`relative mt-2.5 text-hud font-extrabold uppercase tracking-widest ${locked ? "text-stage/70" : "text-stage-text/60"}`}>
            {taps < MIN_TAPS ? `Tap ${MIN_TAPS - taps} more` : "BPM · keep tapping to refine"}
          </span>
        </button>

        <div className="mt-4 flex gap-2">
          <Pressable variant="stage" size="md" onClick={onCancel} className="flex-1">
            Cancel
          </Pressable>
          <Pressable
            variant="primary"
            size="md"
            disabled={bpm === null}
            onClick={() => bpm !== null && onConfirm(bpm)}
            className="flex-[2]"
          >
            Use this tempo
          </Pressable>
        </div>

        <p className="mt-3 text-center text-hud font-medium text-stage-text/50">
          Confirming also marks count 1 at the current moment.
        </p>
      </motion.div>
    </motion.div>
  );
}
