"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {initPoseDetection, detectPoses} from "@/lib/mediapipe";
import FeedbackCanvas from "@/components/practice/FeedbackCanvas";
import CountStrip from "@/components/practice/CountStrip";
import { TOP_STACK, BOTTOM_SAFE, useIsPortrait } from "@/components/practice/chrome";
import { SPRING_UI } from "@/lib/motion";
import { haptic, sfx } from "@/lib/feedback";
import { pickPrimaryPose } from "@/lib/primaryPose";
import { phaseForPass, repsCompleted, canDrill, phaseLabel } from "@/lib/drill";
import {
  resumeSnapshotWhenReady,
  saveResume,
  type RestorableResumeState,
} from "@/lib/videoStore";
import TapTempoSheet from "@/components/practice/TapTempoSheet";
import BpmInput from "@/components/practice/BpmInput";
import Segmented from "@/components/ui/Segmented";
import TogglePill from "@/components/ui/TogglePill";
import type { CalibrationData } from "@/components/practice/CalibrationModal";
import { CountGrid } from "@/lib/countGrid";
import { detectBeatsFromVideo, BEAT_FAILURE_COPY } from "@/lib/beatDetector";
import type { BeatFailure } from "@/lib/beatDetector";
import { preScanVideo, type PreScanResult, type PersonCenter } from "@/lib/videoPreScan";
import type { Keypoint } from "@/lib/mediapipe";
import { composeCueScript } from "@/lib/cueScript";
import type { CueScript } from "@/lib/cueScript";
import type { MovementEvent } from "@/lib/movementEventDetector";
import { getCachedScan, putCachedScan, type ScanCacheKey } from "@/lib/scanCache";
import { parseLinkIdentity, identityKey, type VideoIdentity } from "@/lib/videoIdentity";
import { track } from "@/lib/analytics";
import DashboardTutorial from "@/components/dashboard/DashboardTutorial";

const PRACTICE_TUTORIAL_KEY = "trace_practice_tutorial_dismissed";

// ── Types ──────────────────────────────────────────────────────────────

type ViewMode = "overlay" | "side-by-side";

// ── Constants ──────────────────────────────────────────────────────────

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const;
const L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24;
const IDLE_TIMEOUT = 3000;


// ── Helpers ────────────────────────────────────────────────────────────

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

function torsoLength(kps: Keypoint[]): number | null {
  const ls = kps[L_SHOULDER], rs = kps[R_SHOULDER];
  const lh = kps[L_HIP],      rh = kps[R_HIP];
  if (!ls || !rs || !lh || !rh) return null;
  if ((ls.score ?? 0) < 0.3 || (rs.score ?? 0) < 0.3 ||
      (lh.score ?? 0) < 0.3 || (rh.score ?? 0) < 0.3) return null;
  const shoulderMidX = (ls.x + rs.x) / 2;
  const shoulderMidY = (ls.y + rs.y) / 2;
  const hipMidX      = (lh.x + rh.x) / 2;
  const hipMidY      = (lh.y + rh.y) / 2;
  return dist(shoulderMidX, shoulderMidY, hipMidX, hipMidY);
}

// Cache pre-scan results per video + trim range so users don't need to rescan
const preScanCache = new Map<string, PreScanResult>();

/**
 * ── How the ghost is composited over your camera feed ────────────────────
 *
 * Alpha is the wrong tool for this and it is why the ghost has never been
 * readable. `drawProVideo` draws the *entire reference frame, background
 * included*, and the canvas carried a flat `opacity`. So at 50% you are not
 * seeing "the reference dancer at half strength" — you are seeing the
 * reference dancer's whole room at half strength, alpha-blended over your
 * whole room. Two mid-grey scenes average to mid-grey, and the dancer's body
 * competes against their sofa, their wall and their lighting at equal weight.
 * Raising opacity does not fix it; it hides your own body instead. That is why
 * the slider was clamped 10–90: neither end was usable.
 *
 * A blend mode drops the background out for free, without hiding you.
 *
 * **This is a CSS `mix-blend-mode`, not `ctx.globalCompositeOperation`.** The
 * distinction is load-bearing and easy to get wrong: a canvas composite op
 * blends against what is already *in that canvas*, and this canvas is cleared
 * to transparent every frame. The webcam is a separate sibling `<video>`
 * element, so nothing inside the 2D context can reach it. Only a CSS blend on
 * the canvas *element* composites against the video behind it. The parent
 * carries `isolation: isolate` so the blend stops at the webcam and does not
 * reach through to the page beneath.
 *
 * The mode that works depends on the reference video's ground, so both
 * polarities are offered rather than guessing. `screen` drops a *dark* ground
 * out and `multiply` drops a *light* one out — and a K-pop practice video is
 * usually a bright studio, which is the case `screen` alone would blow out to
 * white. `difference` is ground-agnostic and is the one to reach for when
 * neither helps.
 */
export type GhostBlend = "normal" | "screen" | "multiply" | "difference";

const GHOST_BLEND_OPTIONS: readonly { value: GhostBlend; label: string }[] = [
  /** Straight alpha. The old behaviour, kept as an escape hatch — and as the
   *  fallback if a browser refuses to blend a canvas over a video. */
  { value: "normal",     label: "Solid" },
  /** Dark pixels drop out, light pixels glow. For a reference shot in a dark
   *  studio: a lit dancer becomes a genuine ghost, background gone for free. */
  { value: "screen",     label: "Dark bg" },
  /** Light pixels drop out. For the bright white studio most dance practice
   *  videos are actually shot in. */
  { value: "multiply",   label: "Light bg" },
  /** Any mismatch lights up; perfect alignment reads as black. Turns the
   *  overlay into a live error signal rather than a picture. */
  { value: "difference", label: "Diff" },
];

function drawProVideo(
  ctx: CanvasRenderingContext2D,
  pro: HTMLVideoElement,
  cW: number, cH: number,
  offsetX: number, offsetY: number,
  zoom: number, mirrored: boolean
) {
  const pvW = pro.videoWidth, pvH = pro.videoHeight;
  if (!pvW || !pvH) return;
  const vAspect = pvW / pvH, cAspect = cW / cH;
  let fitW: number, fitH: number;
  if (vAspect > cAspect) { fitW = cW;  fitH = cW / vAspect; }
  else                   { fitH = cH;  fitW = cH * vAspect; }
  fitW *= zoom; fitH *= zoom;
  const x = (cW - fitW) / 2 + offsetX;
  const y = (cH - fitH) / 2 + offsetY;
  ctx.save();
  if (mirrored) {
    ctx.translate(cW, 0); ctx.scale(-1, 1);
    ctx.drawImage(pro, cW - x - fitW, y, fitW, fitH);
  } else {
    ctx.drawImage(pro, x, y, fitW, fitH);
  }
  ctx.restore();
}

// ── Glass style constants ──────────────────────────────────────────────

/**
 * The chrome sits on the **stage**, not on paper — see `docs/DESIGN_SYSTEM.md` §1.
 *
 * This was `bg-white/90 backdrop-blur-xl`. White glass floating over a live
 * camera feed is the brightest thing on screen in any lit room, so the eye
 * lands on the transport instead of on the dancer it is supposed to be
 * watching. Dark glass inverts that: the video stays brightest, and
 * white-on-dark holds its contrast against whatever the camera happens to be
 * pointing at.
 *
 * The blurred shadow is deliberate here and would be wrong on the dashboard. On
 * cream there is a static ground for a solid edge to sit against; over moving
 * video there is not, so separation has to come from a soft drop instead.
 */
const GLASS = "bg-stage-glass backdrop-blur-xl border border-white/10 shadow-stage";
const GLASS_BTN = "flex items-center justify-center rounded-xl transition-ui text-stage-text/65 hover:text-stage-text hover:bg-white/10";

/**
 * Toggle states must be written out in full: Tailwind's JIT scans source text,
 * so an interpolated `bg-${color}-100` is invisible to it and the rule is never
 * generated. These previously rendered only when some unrelated file happened
 * to use the same class — blue had no active state at all, and the emerald
 * toggle lost its text colour.
 *
 * The on state is now a **filled** pill rather than a 100-level tint behind
 * 700-level text. That tint was a ~4% luminance shift; from across a room it
 * was indistinguishable from off, which is the only distance that matters here.
 */
const GLASS_PILL = "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-hud font-extrabold transition-ui";

const TOGGLE_ACTIVE = {
  blue:    "bg-duo-blue  text-white  border-duo-blue",
  emerald: "bg-duo-teal  text-white  border-duo-teal",
  violet:  "bg-cue-hip   text-stage  border-cue-hip",
  amber:   "bg-duo-gold  text-ink    border-duo-gold",
} as const;

type ToggleColor = keyof typeof TOGGLE_ACTIVE;

function glassToggle(active: boolean, color: ToggleColor) {
  return active
    ? `${GLASS_PILL} ${TOGGLE_ACTIVE[color]}`
    : `${GLASS_PILL} border-white/15 bg-white/[0.07] text-stage-text/70 hover:text-stage-text hover:bg-white/15`;
}

// ── Props ──────────────────────────────────────────────────────────────

interface TraceTabProps {
  videoUrl:       string;
  onComplete?:    (traceTimeSeconds: number) => void;
  initialFraming?: CalibrationData;
  initialResume?: RestorableResumeState;
  /** Stable identity for the video (enables the shared scan cache). */
  videoIdentity?: VideoIdentity | null;
}

// ── Component ──────────────────────────────────────────────────────────

export default function TraceTab({ videoUrl, onComplete, initialFraming, initialResume, videoIdentity }: TraceTabProps) {
  /** Every layout branch on this screen reads this, never a width breakpoint. */
  const isPortrait       = useIsPortrait();

  /**
   * "Ready to test" exists twice — a floating satellite in landscape, a
   * full-width CTA inside the transport in portrait — because those are
   * genuinely different layouts, not because the control is different. One
   * handler so the two placements cannot drift on behaviour the way their
   * markup already has.
   */
  const handleReadyForTest = useCallback(() => {
    onComplete?.(Math.round((Date.now() - traceStartTimeRef.current) / 1000));
  }, [onComplete]);

  const proVideoRef      = useRef<HTMLVideoElement>(null);
  const webcamRef        = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamStreamRef  = useRef<MediaStream | null>(null);
  const hideTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseInitRef      = useRef(false);
  const currentTimeRef   = useRef(0);
  const durationRef      = useRef(0);
  const calibAppliedRef  = useRef(false);
  /** Last known canvas size — offsets are normalised against it so a
   *  resumed framing survives a different screen. */
  const canvasSizeRef    = useRef({ w: 0, h: 0 });
  const trimBoundsRef    = useRef<{ start?: number; end?: number; personCenter?: { x: number; y: number }; solo?: boolean }>({
    start:        initialFraming?.trimStart,
    end:          initialFraming?.trimEnd,
    personCenter: initialFraming?.personCenter,
    solo: initialFraming?.solo,
  });
  const autoScanFiredRef      = useRef(false);
  const tutorialTriggeredRef  = useRef(false);
  const timelineDragRef       = useRef<"a" | "b" | null>(null);
  const pinchStateRef    = useRef<{ dist: number; zoom: number } | null>(null);
  const pinchActiveRef   = useRef(false);
  const traceStartTimeRef = useRef<number>(Date.now());
  const practiceStartedFiredRef = useRef(false);

  // ── Webcam ──────────────────────────────────────────────────────
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // ── Video ───────────────────────────────────────────────────────
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [speed,       setSpeed]       = useState(1);
  const [volume,      setVolume]      = useState(0.8);
  const [muted,       setMuted]       = useState(false);
  const [videoError,  setVideoError]  = useState<string | null>(null);

  // ── Overlay ─────────────────────────────────────────────────────
  const [viewMode,       setViewMode]       = useState<ViewMode>("overlay");
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [ghostBlend,     setGhostBlend]     = useState<GhostBlend>("screen");

  /**
   * ── Hold to peek ────────────────────────────────────────────────────
   *
   * Press and hold the canvas and the reference goes to full strength while
   * your own feed drops back; release and it springs home. This is the answer
   * to "sometimes seeing the video in full form makes it a lot easier" and it
   * costs no screen real estate at all — the alternative, a picture-in-picture
   * pane, is a small dancer, and a small dancer at eight feet is the exact
   * failure mode the squished side-by-side already had.
   *
   * `latched` is the hands-free half. Holding a phone is the one thing P1
   * cannot do mid-song, so peek is also a toggle: tap the Reference button and
   * it stays. Without that this feature only works for the desktop case, which
   * is not the case the app is for.
   */
  const [peeking, setPeeking] = useState(false);
  const [peekLatched, setPeekLatched] = useState(false);

  /**
   * Drill mode. Watch a pass, dance a pass, repeat, hands-free.
   * `drillPass` counts every pass through the section; the rep counter shown
   * to the user counts only the danced ones (lib/drill.ts).
   */
  const [drillOn, setDrillOn]     = useState(false);
  const [drillPass, setDrillPass] = useState(0);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekActive = peeking || peekLatched;

  const cancelPeekTimer = useCallback(() => {
    if (peekTimerRef.current) { clearTimeout(peekTimerRef.current); peekTimerRef.current = null; }
  }, []);
  const [mirrored,       setMirrored]       = useState(true);

  // ── Framing ─────────────────────────────────────────────────────
  const [proOffsetX, setProOffsetX] = useState(0);
  const [proOffsetY, setProOffsetY] = useState(0);
  const [proZoom,    setProZoom]    = useState(1.0);
  const [aligning,   setAligning]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [restoreReady, setRestoreReady] = useState(!initialFraming);

  // ── Loop ────────────────────────────────────────────────────────
  const [loopAll,           setLoopAll]           = useState(true);
  const [loopStart,         setLoopStart]         = useState<number | null>(initialResume?.loopStart ?? initialFraming?.trimStart ?? null);
  const [loopEnd,           setLoopEnd]           = useState<number | null>(initialResume?.loopEnd ?? initialFraming?.trimEnd ?? null);
  const [loopSectionActive, setLoopSectionActive] = useState(
    initialResume !== undefined ||
    (initialFraming?.trimStart !== undefined && initialFraming?.trimEnd !== undefined),
  );

  // ── Feedback ────────────────────────────────────────────────────
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [countsEnabled,   setCountsEnabled]   = useState(true);
  const [feedbackOffset,  setFeedbackOffset]  = useState(0);
  const [showTapTempo,    setShowTapTempo]    = useState(false);

  // ── Pre-scan ────────────────────────────────────────────────────
  const [scanEvents,      setScanEvents]      = useState<MovementEvent[] | null>(null);
  const [scanVideoHeight, setScanVideoHeight] = useState(0);
  const [scanProgress,       setScanProgress]       = useState<number | null>(null);
  const [scanEtaSeconds,     setScanEtaSeconds]     = useState<number | null>(null);
  const [scanCompleteFlash,  setScanCompleteFlash]  = useState(false);
  const [scanCompleteCount,  setScanCompleteCount]  = useState<number | null>(null);
  const [scanSource,         setScanSource]         = useState<"auto" | "feedback" | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  const [reacquireCandidates, setReacquireCandidates] = useState<PersonCenter[] | null>(null);
  const reacquireResolveRef = useRef<((idx: number) => void) | null>(null);

  /** Mid-scan reacquire: pause and let the user tap their dancer after a hard occlusion/crossing. */
  const handlePersonChoice = useCallback((persons: PersonCenter[]): Promise<number> => {
    return new Promise(resolve => {
      setReacquireCandidates(persons);
      reacquireResolveRef.current = (idx: number) => {
        setReacquireCandidates(null);
        reacquireResolveRef.current = null;
        resolve(idx);
      };
    });
  }, []);

  // ── Beat / count grid ───────────────────────────────────────────
  const [bpm,           setBpm]           = useState<number | null>(null);
  const [beatOneOffset, setBeatOneOffset] = useState(0);
  const [countGrid,     setCountGrid]     = useState<CountGrid | null>(null);
  const [beatDetecting, setBeatDetecting] = useState(false);
  const [beatFailure,   setBeatFailure]   = useState<BeatFailure | null>(null);
  const beatDetectedRef = useRef(false);
  const tapTimesRef     = useRef<number[]>([]);

  // ── UI ──────────────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toolsOpen,       setToolsOpen]       = useState(false);
  const [keysOpen,        setKeysOpen]        = useState(false);
  const [showBeatAlign,   setShowBeatAlign]   = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [showTutorial,    setShowTutorial]    = useState(false);

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    setCountGrid(bpm !== null ? new CountGrid(bpm, beatOneOffset) : null);
  }, [bpm, beatOneOffset]);

  useEffect(() => {
    if (beatDetectedRef.current) return;
    beatDetectedRef.current = true;
    runBeatDetection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);


  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const runBeatDetection = useCallback(async () => {
    setBeatDetecting(true);
    setBeatFailure(null);
    const startedAt = performance.now();
    try {
      // Analyse the section the user actually trimmed to. Reading the first 30
      // seconds instead meant a clip that opens on a logo card or a talking
      // intro was fed to the detector as if it were the song.
      const { start, end } = trimBoundsRef.current;
      const outcome = await detectBeatsFromVideo(videoUrl, { start, end });

      if (outcome.ok) {
        setBpm(outcome.bpm);
        if (outcome.firstBeatTime !== undefined) setBeatOneOffset(outcome.firstBeatTime);
      } else {
        setBeatFailure(outcome.reason);
      }

      // Which failure fires is the one thing that could not be established
      // from a phone before, and feedback is now gated on having a tempo.
      track("beat_detection", {
        ok:      outcome.ok,
        reason:  outcome.ok ? null : outcome.reason,
        detail:  outcome.ok ? null : outcome.detail ?? null,
        bpm:     outcome.ok ? outcome.bpm : null,
        from:    outcome.ok ? outcome.from : null,
        seconds: outcome.ok ? outcome.seconds : null,
        ms:      Math.round(performance.now() - startedAt),
      });
    } finally { setBeatDetecting(false); }
  }, [videoUrl]);

  const handleSetBeatOne = useCallback(() => {
    setBeatOneOffset(proVideoRef.current?.currentTime ?? 0);
  }, []);

  const handleAlignCount = useCallback((beatNum: number) => {
    if (bpm === null) return;
    const t = proVideoRef.current?.currentTime ?? 0;
    const beatInterval = 60 / bpm;
    // Snap to nearest existing beat tick — keeps all beat positions stable,
    // only relabels the count number at that position
    const snappedTime = countGrid?.nearestTick(t)?.time ?? t;
    setBeatOneOffset(snappedTime - (beatNum - 1) * beatInterval);
    setShowBeatAlign(false);
  }, [bpm, countGrid]);

  // Auto-play the reference video once the scan finishes so the user
  // immediately sees the result without having to press play manually.
  function autoPlayAfterScan() {
    const v = proVideoRef.current;
    if (v && v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    }
    if (!tutorialTriggeredRef.current && !localStorage.getItem(PRACTICE_TUTORIAL_KEY)) {
      tutorialTriggeredRef.current = true;
      setTimeout(() => setShowTutorial(true), 900);
    }
  }

  /**
   * The cue script is derived, never stored. Recomposing when the tempo or the
   * count-1 offset changes is what makes correcting the beat instant instead of
   * a rescan — the scan output itself is tempo-free.
   */
  const script: CueScript | null = useMemo(
    () => (scanEvents ? composeCueScript(scanEvents, countGrid, scanVideoHeight) : null),
    [scanEvents, countGrid, scanVideoHeight],
  );

  /** Adopt finished/cached scan output into practice state. */
  const adoptScan = useCallback((events: MovementEvent[], videoHeight: number) => {
    setScanEvents(events);
    setScanVideoHeight(videoHeight);
    // Cues stay opt-in while the feature is experimental: telling a dancer
    // which body part to move on which count is not reliable enough yet to
    // switch itself on over the reference video.
    setFeedbackEnabled(false);
    setScanCompleteCount(events.length);
    setScanCompleteFlash(true);
    setTimeout(() => setScanCompleteFlash(false), 2000);
  }, []);

  const runScan = useCallback((source: "auto" | "feedback" = "auto", overridePersonCenter?: { x: number; y: number }) => {
    if (scanProgress !== null) return;
    scanAbortRef.current?.abort();
    // Abort tears down the old scan's pending reacquire prompt; drop its UI too.
    reacquireResolveRef.current = null;
    setReacquireCandidates(null);
    const abort = new AbortController();
    scanAbortRef.current = abort;
    setScanSource(source);
    setScanProgress(0);
    setScanEtaSeconds(null);
    const { start, end, personCenter } = trimBoundsRef.current;
    const effectiveCenter = overridePersonCenter ?? personCenter;
    const cacheKey = `${videoUrl}|${start ?? 0}|${end ?? 0}|${effectiveCenter ? `${effectiveCenter.x.toFixed(2)},${effectiveCenter.y.toFixed(2)}` : "auto"}`;

    // L1: in-memory cache for this page load
    const cached = preScanCache.get(cacheKey);
    if (cached) {
      adoptScan(cached.events, cached.videoHeight);
      setScanProgress(null);
      autoPlayAfterScan();
      return;
    }

    // Shared scan-cache key (Supabase) — only for identifiable videos
    const identity: VideoIdentity | null =
      videoIdentity ?? parseLinkIdentity(videoUrl);
    const scanKey: ScanCacheKey | null = identity
      ? { identity, segmentStart: start ?? 0, segmentEnd: end ?? 0 }
      : null;

    const runFreshScan = () => {
      const startedAt = performance.now();
      preScanVideo(
        videoUrl,
        poseInitRef,
        (p) => {
          const pct = p.total > 0 ? (p.current / p.total) * 100 : 0;
          setScanProgress(Math.round(pct));
          if (pct > 5 && pct < 100) {
            const elapsed = (performance.now() - startedAt) / 1000;
            const estTotal = elapsed / (pct / 100);
            const remaining = Math.max(0, estTotal - elapsed);
            setScanEtaSeconds(Math.round(remaining));
          }
        },
        abort.signal,
        start,
        end,
        effectiveCenter,
        handlePersonChoice,
      )
        .then(result => {
          if (result && !abort.signal.aborted) {
            preScanCache.set(cacheKey, result);
            adoptScan(result.events, result.videoHeight);
            autoPlayAfterScan();
            if (scanKey) {
              // Best-effort shared cache write — never blocks practice
              putCachedScan(
                scanKey,
                { events: result.events, videoHeight: result.videoHeight },
                identity!.kind === "file",
              );
            }
            // Scan cost is dominated by device speed, and the phones that feel
            // slow are exactly the ones we can't profile locally. Report the
            // breakdown so the real distribution is visible.
            const { frames, totalMs, seekMs, detectMs, fps } = result.timings;
            track("scan_performance", {
              frames, totalMs, seekMs, detectMs, fps,
              msPerFrame:  frames > 0 ? Math.round(totalMs / frames) : null,
              seekShare:   totalMs > 0 ? +(seekMs / totalMs).toFixed(2) : null,
              detectShare: totalMs > 0 ? +(detectMs / totalMs).toFixed(2) : null,
              cueCount:    result.events.length,
              source:      source,
            });
          }
          setScanProgress(null);
          setScanEtaSeconds(null);
          setScanSource(null);
        })
        .catch(() => {
          setScanProgress(null);
          setScanEtaSeconds(null);
          setScanSource(null);
        });
    };

    // L2: shared Supabase cache — instant repeat practice across sessions
    if (scanKey) {
      getCachedScan(scanKey)
        .then(payload => {
          if (abort.signal.aborted) return;
          if (payload) {
            adoptScan(payload.events, payload.videoHeight);
            setScanProgress(null);
            setScanSource(null);
            autoPlayAfterScan();
          } else {
            runFreshScan();
          }
        })
        .catch(() => { if (!abort.signal.aborted) runFreshScan(); });
    } else {
      runFreshScan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, scanProgress, videoIdentity, adoptScan, handlePersonChoice]);

  useEffect(() => { return () => { scanAbortRef.current?.abort(); }; }, []);

  // ── Auto-scan on mount using trim bounds ─────────────────────────
  const runScanRef = useRef(runScan);
  runScanRef.current = runScan;

  useEffect(() => {
    if (autoScanFiredRef.current) return;
    autoScanFiredRef.current = true;
    const timer = setTimeout(() => { runScanRef.current(); }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply framing + trim from calibration data ───────────────────
  useEffect(() => {
    calibAppliedRef.current = false;
    setRestoreReady(!initialFraming);
    setProOffsetX(0); setProOffsetY(0);
    setProZoom(initialFraming?.zoom ?? 1.0);

    // Apply trim bounds as loop points
    trimBoundsRef.current = {
      start: initialFraming?.trimStart,
      end: initialFraming?.trimEnd,
      personCenter: initialFraming?.personCenter,
      solo: initialFraming?.solo,
    };
    const restoredStart = initialResume?.loopStart ?? initialFraming?.trimStart;
    const restoredEnd = initialResume?.loopEnd ?? initialFraming?.trimEnd;
    setLoopStart(restoredStart ?? null);
    setLoopEnd(restoredEnd ?? null);
    if (restoredStart !== undefined && restoredEnd !== undefined) {
      setLoopSectionActive(true);
    }
  }, [videoUrl, initialFraming, initialResume]);

  // ── Canvas drawing loop ─────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    function frame() {
      const canvas = overlayCanvasRef.current;
      const pro    = proVideoRef.current;
      if (!canvas || !pro || viewMode !== "overlay") { raf = requestAnimationFrame(frame); return; }
      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.offsetWidth, h = parent.offsetHeight;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        canvasSizeRef.current = { w: canvas.width, h: canvas.height };
      }
      if (initialFraming && !calibAppliedRef.current && canvas.width > 0 && canvas.height > 0) {
        calibAppliedRef.current = true;
        setRestoreReady(true);
        setProOffsetX(initialFraming.offsetXNorm * canvas.width);
        setProOffsetY(initialFraming.offsetYNorm * canvas.height);
        setProZoom(initialFraming.zoom);
      }
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawProVideo(ctx, pro, canvas.width, canvas.height, proOffsetX, proOffsetY, proZoom, mirrored);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, proOffsetX, proOffsetY, proZoom, mirrored]);

  useEffect(() => {
    if (viewMode !== "overlay") return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setProZoom(z => Math.min(Math.max(z * (e.deltaY < 0 ? 1.05 : 0.95), 0.3), 3.0));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [viewMode]);

  // ── Auto-align ──────────────────────────────────────────────────
  const autoAlign = useCallback(async () => {
    setAligning(true);
    if (!poseInitRef.current) { await initPoseDetection(); poseInitRef.current = true; }
    const proVideo = proVideoRef.current, webcam = webcamRef.current, canvas = overlayCanvasRef.current;
    if (!proVideo || !webcam || !canvas) { setAligning(false); return; }
    const proKps  = pickPrimaryPose(detectPoses(proVideo), proVideo.videoWidth);
    const userKps = pickPrimaryPose(detectPoses(webcam),   webcam.videoWidth);
    if (!proKps || !userKps) { setAligning(false); return; }
    const cW = canvas.width, cH = canvas.height;
    const pvW = proVideo.videoWidth, pvH = proVideo.videoHeight;
    const wcW = webcam.videoWidth, wcH = webcam.videoHeight;
    const vAspect = pvW / pvH, cAspect = cW / cH;
    const proPixelToCanvas = vAspect > cAspect ? cW / pvW : cH / pvH;
    const wAspect = wcW / wcH;
    const userPixelToCanvas = wAspect > cAspect ? cH / wcH : cW / wcW;
    const userYOffset = wAspect > cAspect ? 0 : (wcH * userPixelToCanvas - cH) / 2;
    const proTorsoRaw = torsoLength(proKps), userTorsoRaw = torsoLength(userKps);
    if (!proTorsoRaw || !userTorsoRaw) { setAligning(false); return; }
    const zoom = (userTorsoRaw * userPixelToCanvas) / (proTorsoRaw * proPixelToCanvas);
    const proHipVideoPx = { x: (proKps[L_HIP].x + proKps[R_HIP].x) / 2, y: (proKps[L_HIP].y + proKps[R_HIP].y) / 2 };
    const fitW = (vAspect > cAspect ? cW : cH * vAspect) * zoom;
    const fitH = (vAspect > cAspect ? cW / vAspect : cH) * zoom;
    const proHipCanvas = { x: (cW - fitW) / 2 + proHipVideoPx.x * proPixelToCanvas * zoom, y: (cH - fitH) / 2 + proHipVideoPx.y * proPixelToCanvas * zoom };
    const userHipCanvas = { x: cW - (userKps[L_HIP].x + userKps[R_HIP].x) / 2 * userPixelToCanvas, y: (userKps[L_HIP].y + userKps[R_HIP].y) / 2 * userPixelToCanvas - userYOffset };
    setProZoom(Math.min(Math.max(zoom, 0.3), 3.0));
    setProOffsetX(userHipCanvas.x - proHipCanvas.x);
    setProOffsetY(userHipCanvas.y - proHipCanvas.y);
    setAligning(false);
  }, []);

  // ── Loop enforcement, and the drill runtime that rides on it ────
  //
  // Drill is deliberately not a second clock. It is the existing section loop
  // plus a counter that advances on the wrap — so there is exactly one place
  // that decides when the section restarts, and the phase can never disagree
  // with what the video is doing.
  useEffect(() => {
    if (!loopSectionActive || loopStart === null || loopEnd === null) return;
    let raf: number;
    function check() {
      const v = proVideoRef.current;
      if (v && !v.paused && v.currentTime >= loopEnd!) {
        v.currentTime = loopStart!;
        if (drillOn) {
          setDrillPass(n => {
            const next = n + 1;
            // The cue announces what the *next* pass is, on the wrap, so it
            // lands before the section starts rather than after you have
            // already missed the first count of it.
            sfx(phaseForPass(next) === "dance" ? "countInGo" : "countIn");
            haptic("commit");
            return next;
          });
        }
      }
      raf = requestAnimationFrame(check);
    }
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [loopSectionActive, loopStart, loopEnd, drillOn]);

  const drillPhase = drillOn ? phaseForPass(drillPass) : null;
  const drillReps  = repsCompleted(drillPass);

  /**
   * Drill's "watch" phase and a held peek are the same thing on screen — the
   * reference at full strength with you dimmed behind it — so they drive one
   * switch rather than two competing opacity sources.
   */
  const referenceFull = peekActive || drillPhase === "watch";

  // Turning drill off mid-session must not leave the reference latched at full
  // opacity, and turning it on should start from rep zero rather than from
  // wherever a previous drill left the counter.
  useEffect(() => {
    if (!drillOn) return;
    setDrillPass(0);
    sfx("countIn");
  }, [drillOn]);

  // ── Webcam ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        webcamStreamRef.current = stream;
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          await webcamRef.current.play();
          if (!cancelled) {
            setWebcamReady(true);
            if (!practiceStartedFiredRef.current) {
              practiceStartedFiredRef.current = true;
              track("practice_started", { source: "trace", feature: "ghost_mirror" });
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        setWebcamError(err instanceof DOMException && err.name === "NotAllowedError" ? "Camera access denied." : "Could not access camera.");
      }
    }
    start();
    return () => { cancelled = true; webcamStreamRef.current?.getTracks().forEach(t => t.stop()); webcamStreamRef.current = null; };
  }, []);

  useEffect(() => {
    const webcam = webcamRef.current, stream = webcamStreamRef.current;
    if (webcam && stream && !webcam.srcObject) { webcam.srcObject = stream; webcam.play().catch(() => {}); }
  }, [viewMode]);

  // ── Auto-hide controls ──────────────────────────────────────────
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    // Only auto-hide during playback. While paused you are almost certainly
    // reaching for these controls, and hiding them after 3s of "idle" meant
    // they disappeared exactly when you were about to use them.
    if (playingRef.current) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), IDLE_TIMEOUT);
    }
  }, []);

  // ── Video callbacks ─────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const v = proVideoRef.current; if (!v) return;
    if (v.paused) { try { await v.play(); setPlaying(true); } catch { setVideoError("Cannot play this video."); } }
    else { v.pause(); setPlaying(false); }
  }, []);

  const restart = useCallback(() => {
    const v = proVideoRef.current; if (!v) return;
    const t = (loopSectionActive && loopStart !== null) ? loopStart : 0;
    v.currentTime = t; currentTimeRef.current = t; setCurrentTime(t);
  }, [loopSectionActive, loopStart]);

  const skipBack    = useCallback(() => { const v = proVideoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 5); }, []);
  const skipForward = useCallback(() => { const v = proVideoRef.current; if (v) v.currentTime = Math.min(durationRef.current, v.currentTime + 5); }, []);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    if (proVideoRef.current) proVideoRef.current.currentTime = t;
    setCurrentTime(t); currentTimeRef.current = t;
  }, [duration]);

  const markLoopStart = useCallback(() => { const t = proVideoRef.current?.currentTime ?? 0; setLoopStart(t); if (loopEnd !== null && loopEnd <= t) setLoopEnd(null); }, [loopEnd]);
  const markLoopEnd   = useCallback(() => { const t = proVideoRef.current?.currentTime ?? 0; setLoopEnd(t); if (loopStart !== null && loopStart >= t) setLoopStart(null); }, [loopStart]);

  const switchMode = useCallback((mode: ViewMode) => {
    const v = proVideoRef.current;
    if (v) currentTimeRef.current = v.currentTime;
    if (v && !v.paused) { v.pause(); setPlaying(false); }
    setViewMode(mode);
  }, []);

  const handleVideoMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    durationRef.current = v.duration; setDuration(v.duration);
    v.volume = volume; v.muted = muted; v.playbackRate = speed;
    if (currentTimeRef.current > 0.1) v.currentTime = currentTimeRef.current;
  }, [volume, muted, speed]);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime; currentTimeRef.current = t; setCurrentTime(t);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.code) {
        case "Space":        e.preventDefault(); togglePlay(); break;
        case "KeyR":         e.preventDefault(); restart(); break;
        case "KeyM":         e.preventDefault(); setMirrored(m => !m); break;
        case "KeyL":         e.preventDefault(); if (loopStart !== null && loopEnd !== null) setLoopSectionActive(a => !a); else setLoopAll(a => !a); break;
        case "BracketLeft":  e.preventDefault(); markLoopStart(); break;
        case "BracketRight": e.preventDefault(); markLoopEnd(); break;
        case "ArrowLeft":    e.preventDefault(); skipBack(); break;
        case "ArrowRight":   e.preventDefault(); skipForward(); break;
        case "KeyT":         e.preventDefault(); {
          const now = performance.now(); const taps = tapTimesRef.current;
          if (taps.length > 0 && now - taps[taps.length - 1] > 2000) tapTimesRef.current = [];
          tapTimesRef.current.push(now);
          if (tapTimesRef.current.length >= 3) {
            const intervals: number[] = [];
            for (let i = 1; i < tapTimesRef.current.length; i++) intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
            const derived = Math.round((60000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length)) * 10) / 10;
            if (derived >= 40 && derived <= 250) setBpm(derived);
          }
        } break;
        case "KeyB":     e.preventDefault(); handleSetBeatOne(); break;
        // Held, not toggled — the keyboard mirror of the canvas long-press, so
        // the gesture means the same thing on both inputs. `e.repeat` guards
        // the auto-repeat storm a held key produces.
        case "KeyV":     e.preventDefault(); if (!e.repeat) setPeeking(true); break;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "KeyV") setPeeking(false);
    }
    // A window blur while V is held would otherwise leave peek stuck on.
    const onBlur = () => setPeeking(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [togglePlay, restart, markLoopStart, markLoopEnd, skipBack, skipForward, loopStart, loopEnd, handleSetBeatOne]);

  // ── Drag-to-pan ─────────────────────────────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (viewMode !== "overlay") return;
    if (pinchActiveRef.current) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const baseX = proOffsetX, baseY = proOffsetY, startX = e.clientX, startY = e.clientY;
    setIsDragging(true);

    /*
      Long-press arms peek, movement cancels it. This canvas already owns
      drag-to-reposition and a two-finger pinch, so peek has to lose every
      ambiguous case rather than win it: 350ms is long enough that a
      reposition never trips it, and a 10px move disarms it outright. Getting
      this backwards would make the framing undraggable, which is worse than
      not having peek at all.
    */
    let moved = false;
    peekTimerRef.current = setTimeout(() => {
      if (!moved && !pinchActiveRef.current) { setPeeking(true); haptic("tick"); }
    }, 350);

    const onMove = (ev: PointerEvent) => {
      if (pinchActiveRef.current) return;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) {
        moved = true;
        cancelPeekTimer();
      }
      setProOffsetX(baseX + (ev.clientX - startX));
      setProOffsetY(baseY + (ev.clientY - startY));
    };
    const onUp = () => {
      setIsDragging(false);
      cancelPeekTimer();
      setPeeking(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Without pointercancel the reference sticks at full opacity when the OS
    // steals the pointer — a notification, a call, an edge-swipe.
    window.addEventListener("pointercancel", onUp);
  }

  function handleCanvasPinchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    if (viewMode !== "overlay" || e.touches.length < 2) return;
    pinchActiveRef.current = true;
    const t0 = e.touches[0], t1 = e.touches[1];
    const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
    pinchStateRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom: proZoom };
  }

  function handleCanvasPinchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    if (!pinchActiveRef.current || e.touches.length < 2 || !pinchStateRef.current) return;
    e.preventDefault();
    const t0 = e.touches[0], t1 = e.touches[1];
    const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setProZoom(Math.min(Math.max(pinchStateRef.current.zoom * (dist / pinchStateRef.current.dist), 0.3), 3.0));
  }

  function handleCanvasPinchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length < 2) {
      pinchActiveRef.current = false;
      pinchStateRef.current = null;
    }
  }

  function handleLoopHandlePointerDown(e: React.PointerEvent<HTMLDivElement>, which: "a" | "b") {
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    timelineDragRef.current = which;
  }

  function handleLoopHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!timelineDragRef.current || !duration) return;
    const timelineEl = document.getElementById("trace-timeline");
    if (!timelineEl) return;
    const rect = timelineEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    if (timelineDragRef.current === "a") {
      setLoopStart(Math.min(t, (loopEnd ?? duration) - 0.5));
    } else {
      setLoopEnd(Math.max(t, (loopStart ?? 0) + 0.5));
    }
  }

  function handleLoopHandlePointerUp() {
    timelineDragRef.current = null;
  }

  // ── Derived ─────────────────────────────────────────────────────
  const progressPct  = duration > 0 ? (currentTime / duration) * 100 : 0;
  /**
   * ── Persist the section, so it can be resumed ───────────────────────
   *
   * Loop points lived only in this component's state and died with the tab, so
   * P3 — the returning dancer, third session on the same song — re-marked the
   * same eight bars every single time. That is the difference between a tool
   * you drill with and a tool you set up.
   *
   * Debounced, because the framing offsets change on every frame of a drag and
   * this must never be in the path of one. Fire-and-forget: a failed resume
   * save is a lost convenience, never an interrupted session.
   */
  useEffect(() => {
    const key = videoIdentity ? identityKey(videoIdentity) : null;
    if (!key) return;
    const snapshot = resumeSnapshotWhenReady(restoreReady, {
      trimStart:    trimBoundsRef.current.start,
      trimEnd:      trimBoundsRef.current.end,
      loopStart, loopEnd,
      offsetXNorm:  canvasSizeRef.current.w ? proOffsetX / canvasSizeRef.current.w : undefined,
      offsetYNorm:  canvasSizeRef.current.h ? proOffsetY / canvasSizeRef.current.h : undefined,
      zoom:         proZoom,
      personCenter: trimBoundsRef.current.personCenter,
      solo:         trimBoundsRef.current.solo,
    });
    if (!snapshot) return;
    const t = setTimeout(() => {
      void saveResume(key, snapshot);
    }, 800);
    return () => clearTimeout(t);
  }, [videoIdentity, loopStart, loopEnd, proOffsetX, proOffsetY, proZoom, restoreReady]);

  const loopStartPct = loopStart !== null && duration > 0 ? (loopStart / duration) * 100 : null;
  const loopEndPct   = loopEnd   !== null && duration > 0 ? (loopEnd   / duration) * 100 : null;
  const canSection   = loopStart !== null && loopEnd !== null && loopEnd > loopStart;
  const proStyle     = mirrored ? { transform: "scaleX(-1)" } : undefined;

  const proProps = {
    src: videoUrl, playsInline: true, preload: "auto" as const, crossOrigin: "anonymous" as const, loop: loopAll,
    onLoadedMetadata: handleVideoMetadata, onTimeUpdate: handleTimeUpdate,
    onEnded: () => setPlaying(false), onError: () => setVideoError("Unable to load video."),
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div
      onMouseMove={showControls}
      onTouchStart={showControls}
      className="relative h-full w-full overflow-hidden bg-black"
    >
      {/* ══════════════════ FULL-BLEED VIDEO AREA ══════════════════ */}

      {viewMode === "overlay" ? (
        /* `isolation: isolate` makes this the blend group for the ghost: the
           canvas's mix-blend-mode composites against the webcam below it and
           stops there, rather than reaching through to the page. */
        <div className="absolute inset-0" style={{ isolation: "isolate" }}>
          {webcamError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-white/40">{webcamError}</p>
            </div>
          ) : (
            <video
              ref={webcamRef}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                transform: "scaleX(-1)",
                // Not 0. You still want to know roughly where you are while
                // peeking, and a feed that vanishes entirely is disorienting
                // when it comes back.
                opacity: referenceFull ? 0.15 : 1,
                transition: "opacity 140ms cubic-bezier(0.23,1,0.32,1)",
              }}
              playsInline muted autoPlay
            />
          )}

          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 h-full w-full"
            style={{
              // Peek overrides the slider rather than replacing it: release
              // and you are back at whatever you had set, which is the whole
              // point of a held gesture over a mode.
              opacity: referenceFull ? 1 : overlayOpacity / 100,
              // Peek shows the reference *as a video*, so the blend that makes
              // it a ghost is exactly what you do not want while looking at it.
              mixBlendMode: referenceFull ? "normal" : ghostBlend,
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              transition: "opacity 140ms cubic-bezier(0.23,1,0.32,1)",
            }}
            onPointerDown={handleCanvasPointerDown}
            onTouchStart={handleCanvasPinchStart}
            onTouchMove={handleCanvasPinchMove}
            onTouchEnd={handleCanvasPinchEnd}
          />

          <FeedbackCanvas
            proVideoRef={proVideoRef} enabled={feedbackEnabled}
            proOffsetX={proOffsetX} proOffsetY={proOffsetY} proZoom={proZoom} mirrored={mirrored}
            script={script} feedbackOffset={feedbackOffset}
          />
          <CountStrip
            proVideoRef={proVideoRef} grid={countGrid} script={script}
            visible={countsEnabled}
          />

          <video ref={proVideoRef} {...proProps} className="hidden" />

          {!webcamReady && !webcamError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <div className="h-6 w-6 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-white/10 border-t-white/50" />
            </div>
          )}
        </div>
      ) : (
        /*
          Side-by-side branches on **orientation, not width** (contract §7).

          This was an unconditional `grid-cols-2`, which on a 393×852 phone
          gives each pane 196px. The reference is `object-contain`, so a 16:9
          clip letterboxes into a 196×110 strip with ~370px of black above and
          below it — two squished columns and almost no dancer, which is
          exactly the reported symptom. A width breakpoint cannot fix it,
          because a phone *in landscape* genuinely does want columns.

          In portrait the panes stack, and **you are on top**: you are the body
          being corrected, so you get the position the eye returns to, and the
          reference sits below as the thing being consulted.
        */
        <div className={`absolute inset-0 grid ${isPortrait ? "grid-rows-2" : "grid-cols-2"}`}>
          <div className={`relative overflow-hidden bg-black ${isPortrait ? "order-2" : "order-1"}`}>
            <video ref={proVideoRef} {...proProps} className="absolute inset-0 h-full w-full object-contain" style={proStyle} />
            {/* In portrait this pane is the lower one, so it does not need to
                clear the header — TOP_STACK would push the badge 105px into
                the frame. Only the pane that touches the top edge pays it. */}
            <div className="absolute left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur" style={{ top: isPortrait ? "0.75rem" : TOP_STACK }}>
              <div className="h-1.5 w-1.5 rounded-full bg-identity-reference" />
              <span className="hud-text text-hud font-extrabold tracking-widest text-white">REFERENCE</span>
            </div>
          </div>
          <div className={`relative overflow-hidden bg-black ${isPortrait ? "order-1" : "order-2"}`}>
            {webcamError ? (
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-xs text-white/40">{webcamError}</p></div>
            ) : (
              <video ref={webcamRef} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted autoPlay />
            )}
            <div className="absolute left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur" style={{ top: TOP_STACK }}>
              <div className="h-1.5 w-1.5 rounded-full bg-identity-you" />
              <span className="hud-text text-hud font-extrabold tracking-widest text-white">YOU</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TEMPO GATE ══════════════════ */}
      <AnimatePresence>
        {showTapTempo && (
          <TapTempoSheet
            detecting={beatDetecting}
            failure={beatFailure ? BEAT_FAILURE_COPY[beatFailure] : null}
            onRetry={runBeatDetection}
            onCancel={() => setShowTapTempo(false)}
            onConfirm={(v) => {
              // The user has just been tapping along, so this is precisely the
              // moment they know where "1" falls — mark it while they do.
              setBpm(v);
              setBeatOneOffset(proVideoRef.current?.currentTime ?? 0);
              setShowTapTempo(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════ MID-SCAN REACQUIRE PROMPT ══════════════════ */}
      <AnimatePresence>
        {reacquireCandidates !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className={`w-[min(420px,92vw)] rounded-2xl ${GLASS} px-5 py-5`}
            >
              <p className="text-hud-lg font-extrabold text-stage-text">Lost track of your dancer</p>
              <p className="mt-1.5 text-hud font-medium leading-relaxed text-stage-text/70">
                Tap the dancer you&apos;re following to keep the scan on track.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {reacquireCandidates.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => reacquireResolveRef.current?.(i)}
                    className="group overflow-hidden rounded-xl border-2 border-transparent bg-white/10 transition-ui hover:border-duo-green"
                  >
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt={`Dancer ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center text-hud-lg text-stage-text/50">?</div>
                    )}
                    <span className="block bg-white/10 py-1.5 text-center text-hud font-bold text-stage-text/80 group-hover:text-duo-green">
                      Dancer {i + 1}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => reacquireResolveRef.current?.(-1)}
                className="mt-4 min-h-[44px] w-full rounded-full text-hud font-bold text-stage-text/65 transition-ui hover:bg-white/10 hover:text-stage-text"
              >
                Not sure — keep best guess
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════ SCAN PROGRESS PILL ══════════════════ */}
      {/*
        Deliberately non-blocking. Watching the reference dancer is the whole
        point of this tab and needs no scan — the scan only adds anticipatory
        cues on top. A full-screen overlay here used to lock the user out of
        the video for the entire scan, so the slowest part of the app blocked
        its most useful part. Cues fade in when the scan lands.
      */}
      <AnimatePresence>
        {scanProgress !== null && reacquireCandidates === null && (
          <motion.div
            initial={{ opacity: 0, y: 8, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 8, x: -8 }}
            className="pointer-events-none absolute bottom-20 left-4 z-40"
          >
            <div className="flex items-center gap-2 rounded-full bg-stage-glass px-3 py-2 text-hud font-bold text-stage-text backdrop-blur-xl">
              <div className="h-3 w-3 animate-spin motion-reduce:animate-pulse rounded-full border border-white/40 border-t-transparent" />
              <span>
                {scanSource === "feedback" ? "Scanning for feedback" : "Finding counts & cues"}
                {" "}{scanProgress}%
                {scanEtaSeconds != null && scanEtaSeconds > 0 ? ` · ~${scanEtaSeconds}s` : ""}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan complete flash */}
      <AnimatePresence>
        {scanCompleteFlash && scanCompleteCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none absolute bottom-24 left-1/2 z-40 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-full bg-duo-teal px-4 py-1.5 text-hud font-bold text-white shadow-stage">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="font-semibold">
                Scan complete — feedback ready ({scanCompleteCount} events)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════ FLOATING OVERLAYS ══════════════════ */}

      <div className={`pointer-events-none absolute inset-0 z-30 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>

        {/* ── Top-left: badge + loop indicator ────────────────── */}
        {/* Anchored to TOP_STACK like its top-right sibling below. The old
            top-16 (64px) sat 39px inside the header at a 59px inset, on top
            of the back button. */}
        <div className="pointer-events-auto absolute left-3 flex flex-col gap-2" style={{ top: TOP_STACK }}>
          <div className={`flex items-center gap-1.5 rounded-full ${GLASS} px-3 py-1.5`}>
            {/*
              `currentColor` at the label's own weight, not a hardcoded value.
              This mark was drawing itself in the literal value of `ink` — the
              *paper* text colour — at 60% opacity, on dark glass over a live
              camera feed, immediately beside a `text-stage-text/80` label. A
              near-black glyph on the stage ground is invisible from where the
              badge is read, which is across the room. It survived the ground
              rewrite because a raw hex is not a Tailwind class and so nothing
              swept it. Inheriting means the mark and its word can no longer
              disagree about what colour the badge is.
            */}
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="text-stage-text/80">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="2" fill="currentColor"/>
            </svg>
            <span className="text-hud font-extrabold tracking-widest text-stage-text/80">TRACE</span>
          </div>
          {loopSectionActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-duo-gold px-3 py-1.5 backdrop-blur">
              <div className="h-2 w-2 animate-pulse motion-reduce:animate-pulse rounded-full bg-ink" />
              <span className="text-hud font-extrabold tabular-nums text-ink">{fmt(loopStart ?? 0)} → {fmt(loopEnd ?? 0)}</span>
            </div>
          )}

          {/*
            The drill readout. Set at a size you can resolve from across the
            room, because that is the only place it is ever read — the entire
            point of drill mode is that you do not touch or approach the phone
            once it is running. WATCH and DANCE differ by fill *and* by word,
            not by hue: at eight feet a blue pill and a green pill are the same
            grey pill, which is the same reason the toggles are fill/no-fill.
          */}
          {drillPhase && (
            <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 shadow-stage ${
              drillPhase === "watch" ? "bg-duo-blue" : "bg-duo-green"
            }`}>
              <span className="text-hud-lg font-black uppercase tracking-[0.18em] text-white">
                {phaseLabel(drillPhase)}
              </span>
              <span className="text-hud font-extrabold tabular-nums text-white/75">
                rep {drillReps + (drillPhase === "dance" ? 1 : 0)}
              </span>
            </div>
          )}
        </div>

        {/* ── Top-right: utility buttons ──────────────────────── */}
        <div className="pointer-events-auto absolute right-3 flex items-center gap-2" style={{ top: TOP_STACK }}>
          {/* Auto-align */}
          {viewMode === "overlay" && (
            <button onClick={autoAlign} disabled={aligning} className={`h-11 w-11 rounded-lg sm:h-8 sm:w-8 ${GLASS} ${GLASS_BTN} disabled:opacity-40`} title="Auto-align">
              {aligning
                ? <div className="h-3.5 w-3.5 animate-spin motion-reduce:animate-pulse rounded-full border border-white/40 border-t-white" />
                : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" /></svg>
              }
            </button>
          )}
          {/* Keyboard shortcuts help */}
          <button onClick={() => setKeysOpen(k => !k)} className={`h-11 w-11 rounded-lg sm:h-8 sm:w-8 ${GLASS} ${GLASS_BTN}`} title="Keyboard shortcuts">
            <span className="text-xs font-bold">?</span>
          </button>
          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className={`h-11 w-11 rounded-lg sm:h-8 sm:w-8 ${GLASS} ${GLASS_BTN}`} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 15v4.5M9 15H4.5M15 9V4.5M15 9h4.5M15 15v4.5m0-4.5h4.5" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            )}
          </button>
        </div>

        {/* ── Keyboard shortcuts tooltip ──────────────────────── */}
        <AnimatePresence>
          {keysOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className={`pointer-events-auto absolute right-3 rounded-xl ${GLASS} p-3`}
              style={{ top: `calc(${TOP_STACK} + 2.5rem)` }}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ["Space", "Play/Pause"], ["R", "Restart"], ["←/→", "±5 sec"], ["M", "Mirror"],
                  ["L", "Loop"], ["[/]", "Set A/B"], ["T", "Tap BPM"], ["B", "Set beat-1"],
                  ["Hold V", "Peek at reference"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-hud text-stage-text/85">{key}</kbd>
                    <span className="text-hud text-stage-text/70">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Right-edge tools panel (opened from bottom-left satellite) ───── */}
        <div className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2">
          <AnimatePresence>
            {toolsOpen && (
              <motion.div
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                className={`mb-2 flex w-52 flex-col gap-3 rounded-2xl ${GLASS} p-3`}
              >
                {/* Timing offset (advanced) */}
                {feedbackEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-hud font-bold text-stage-text/70">Timing</span>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.05"
                      value={feedbackOffset}
                      onChange={e => setFeedbackOffset(parseFloat(e.target.value))}
                      aria-label="Reference timing offset"
                      className="slider slider-stage flex-1"
                    />
                    <button
                      onClick={() => setFeedbackOffset(0)}
                      className={`min-w-[3.5rem] text-right text-hud font-bold tabular-nums ${
                        feedbackOffset < 0
                          ? "text-sky-500"
                          : feedbackOffset > 0
                            ? "text-duo-gold"
                            : "text-stage-text/50"
                      }`}
                    >
                      {feedbackOffset === 0
                        ? "On beat"
                        : `${Math.abs(Math.round(feedbackOffset * 1000))}ms ${feedbackOffset < 0 ? "early" : "late"}`}
                    </button>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* ── Bottom satellites + dynamic island transport ─────── */}

        {/* Left satellites: tools + feedback + dancer pills */}
        <div
          className={`absolute bottom-4 left-4 flex flex-col gap-2 transition-opacity duration-500 ${controlsVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {/* Tools circle */}
          <button
            onClick={() => setToolsOpen(o => !o)}
            className={`flex h-11 w-11 items-center justify-center rounded-full ${GLASS} transition-ui ${
              toolsOpen ? "text-duo-blue" : "text-stage-text/70 hover:text-stage-text"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
          </button>

        </div>

        {/* Right satellites: beat align + ready */}
        <div
          className={`absolute bottom-4 right-4 flex flex-col items-end gap-3 transition-opacity duration-500 ${controlsVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {/* Beat alignment popover */}
          <AnimatePresence>
            {showBeatAlign && bpm !== null && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`mb-1 rounded-2xl ${GLASS} p-3`}
              >
                <p className="mb-1 text-hud-lg font-extrabold text-stage-text">
                  What count is playing right now?
                </p>
                <p className="mb-2.5 text-hud font-medium text-stage-text/70">
                  Pause the video on a moment you recognize, then tap the count number.
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => handleAlignCount(n)}
                      className="touch-target flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-hud-lg font-extrabold text-stage-text transition-ui hover:bg-white/25 active:scale-95 motion-reduce:active:scale-100"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowBeatAlign(false)}
                  className="touch-target mt-2 w-full py-1 text-center text-hud font-bold text-stage-text/60 hover:text-stage-text"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Landscape only. This was `hidden sm:flex` — a width breakpoint
              standing in for an orientation decision, with a second, drifted
              implementation inside the transport for the other case. */}
          {onComplete && !isPortrait && (
            <div className="flex flex-col items-end gap-1">
              <button
                id="trace-ready-btn"
                onClick={handleReadyForTest}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-duo-green text-white shadow-chunk-green transition-[transform,box-shadow] duration-[110ms] ease-out-strong active:translate-y-[4px] active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0"
                title="Ready for Test"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
              <span className="hud-text text-hud font-extrabold text-white">Ready to test</span>
            </div>
          )}
        </div>

        {/* Dynamic island transport */}
        <motion.div
          id="trace-transport"
          className="pointer-events-auto absolute left-1/2 z-30 w-[min(720px,96vw)] sm:w-[min(720px,90vw)]"
          // x lives here rather than as a -translate-x-1/2 class because framer
          // writes the whole transform; a Tailwind translate would be clobbered.
          style={{ bottom: BOTTOM_SAFE, x: "-50%" }}
          animate={{ y: controlsVisible ? 0 : "100%" }}
          transition={SPRING_UI}
          // Flick or drag the sheet away instead of waiting out a timeout.
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.45 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 56 || info.velocity.y > 480) {
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              setControlsVisible(false);
            }
          }}
        >
          <div className={`rounded-2xl ${GLASS} px-3 py-2 sm:rounded-3xl sm:px-4 sm:py-3`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
            {/* Drag handle — swipe the sheet down, or tap to collapse. */}
            <button
              className="mb-1 flex w-full cursor-grab items-center justify-center py-1.5 active:cursor-grabbing sm:hidden"
              onClick={() => {
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                setControlsVisible(false);
              }}
              aria-label="Hide controls"
            >
              <div className="h-1 w-10 rounded-full bg-white/35" />
            </button>
            {/* ── Ghost row ──────────────────────────────────────────────────
                Its own row, deliberately NOT inside the horizontally-scrolling
                row below. The ghost is the feature the practice screen exists
                for, and its controls could previously be scrolled off-screen —
                the single most-used control on the stage, reachable only by
                remembering to swipe a toolbar sideways mid-song.

                Blend mode leads and opacity follows, because blend is the
                control that actually makes the reference readable; opacity is
                the fine adjustment on top of it. */}
            {viewMode === "overlay" && (
              <div className="mb-2 flex flex-col gap-1.5 sm:mb-3 sm:flex-row sm:items-center sm:gap-3">
                <Segmented
                  tone="stage"
                  label="Ghost blend mode"
                  options={GHOST_BLEND_OPTIONS}
                  value={ghostBlend}
                  onChange={setGhostBlend}
                  className="shrink-0"
                />
                {/*
                  The hands-free half of peek. The long-press is the better
                  interaction but it needs a hand on the phone, which is the one
                  thing P1 does not have mid-song — so the same state is also a
                  latch you can arm before you start dancing. Without this, peek
                  is a desktop feature, and desktop is not what the app is for.
                */}
                <TogglePill
                  active={peekLatched}
                  onClick={() => setPeekLatched(v => !v)}
                  accent="blue"
                  tone="stage"
                  className="shrink-0"
                >
                  Reference {peekLatched ? "on" : "off"}
                </TogglePill>
                {/*
                  Drill needs a section, so the control only exists once there
                  is one — offering a mode that silently does nothing is how a
                  feature gets a reputation for being broken. Below ~2s a pass
                  ends before the count-in does, so canDrill gates that too.
                */}
                {canDrill(loopStart, loopEnd) && (
                  <TogglePill
                    active={drillOn}
                    onClick={() => {
                      // Drill without the section loop running is just the
                      // reference playing, so arm both together.
                      if (!drillOn) setLoopSectionActive(true);
                      setDrillOn(v => !v);
                    }}
                    accent="emerald"
                    tone="stage"
                    className="shrink-0"
                  >
                    Drill {drillOn ? "on" : "off"}
                  </TogglePill>
                )}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 text-hud font-bold text-stage-text/70">Ghost</span>
                  <input
                    type="range" min="10" max="90" value={overlayOpacity}
                    onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                    aria-label="Reference ghost opacity"
                    className="slider slider-stage min-w-0 flex-1"
                  />
                  <span className="w-9 shrink-0 text-right text-hud tabular-nums text-stage-text/70">{overlayOpacity}%</span>
                </div>
              </div>
            )}

            {/* ── Secondary controls row ─────────────────────────────────────── */}
            {/* Horizontal scroll rather than `flex-wrap`. The full set needs
                ~445px and a 375px phone has ~336px; wrapping turned that into a
                ragged two-row block whose height changed as toggles appeared,
                shoving the timeline down mid-session. Scrolling keeps the row
                one row and the timeline at a fixed height. */}
            <div
              id="trace-controls-row"
              className="scrollbar-hide -mx-1 mb-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mb-3 sm:gap-2"
            >
              {/* View mode segmented control */}
              <Segmented
                label="View mode"
                tone="stage"
                className="shrink-0"
                value={viewMode}
                onChange={switchMode}
                options={[
                  { value: "overlay" as ViewMode,      label: "Overlay" },
                  { value: "side-by-side" as ViewMode, label: "Side by Side" },
                ]}
              />

              {/* Mirror */}
              <button onClick={() => setMirrored(m => !m)} className={glassToggle(mirrored, "blue")}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 12m0 0 4.5-9M3 12h18m0 0-4.5 9M21 12l-4.5-9" /></svg>
                Mirror
              </button>

              {/* Divider */}
              <div className="h-5 w-px shrink-0 bg-white/15" />

              {/* Feedback pill */}
              <button
                id="trace-feedback-pill"
                onClick={() => {
                  // Cues land on counts, so a grid is a hard prerequisite. Without
                  // one the old code silently composed against a 0.1s spacing and
                  // showed no counts at all.
                  if (!countGrid?.hasBpm) { setShowTapTempo(true); return; }
                  if (scanEvents === null && scanProgress === null) { runScan("feedback"); return; }
                  if (scanEvents !== null) setFeedbackEnabled(f => !f);
                }}
                className={glassToggle(feedbackEnabled, "emerald")}
              >
                {scanProgress !== null && scanSource === "feedback"
                  ? <span className="h-3 w-3 animate-spin motion-reduce:animate-pulse rounded-full border border-current border-t-transparent" />
                  : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                }
                {!countGrid?.hasBpm
                  ? "Set tempo"
                  : feedbackEnabled ? "Cues on"
                  : scanEvents === null ? "Try cues" : "Cues"}
                <span className="ml-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-hud font-extrabold uppercase tracking-wide text-stage-text/70">
                  Beta
                </span>
              </button>

              {/* Divider */}
              <div className="h-5 w-px shrink-0 bg-white/15" />

              {/* BPM + Count section */}
              <div id="trace-bpm-count">
                <BpmInput bpm={bpm} onBpmChange={setBpm} onSetBeatOne={handleSetBeatOne}
                  detecting={beatDetecting} onDetect={runBeatDetection}
                  // Detection returns a typed reason now, so say which one:
                  // `decode-failed` means try another section, `no-audio-track`
                  // means don't bother, tap it. Both used to read "no tempo".
                  failure={beatFailure}
                  // Route to the real sheet rather than the cramped inline
                  // panel — it's a 160px pad, and it marks count one on confirm.
                  onOpenTapTempo={() => setShowTapTempo(true)} />
              </div>

              {/* Count on/off pill */}
              {bpm !== null && (
                <button onClick={() => setCountsEnabled(c => !c)} className={glassToggle(countsEnabled, "violet")}>
                  <span className="font-mono text-hud">1·2</span>
                  Counts
                </button>
              )}

              {/* Live count + Adjust (desktop only — mobile has the floating badge above) */}
              {bpm !== null && countsEnabled && countGrid && (
                <div className="hidden items-center gap-1 sm:flex">
                  <span className="text-hud font-bold text-stage-text/80">
                    Count: {countGrid.count(currentTime)?.count ?? "–"}
                  </span>
                  <button
                    onClick={() => setShowBeatAlign(a => !a)}
                    className={`touch-target px-1 text-hud font-bold ${showBeatAlign ? "text-cue-hip" : "text-stage-text/60 hover:text-stage-text"}`}
                  >
                    Adjust…
                  </button>
                </div>
              )}
            </div>

            {/* Mobile beat-align panel — inline, shown when Adjust is tapped on mobile */}
            <AnimatePresence>
              {showBeatAlign && bpm !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden sm:hidden"
                >
                  <div className="mb-2 rounded-2xl bg-white/10 p-3">
                    <p className="mb-2.5 text-hud font-bold text-stage-text/85">
                      Pause on a beat you recognize — what count is playing?
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <button
                          key={n}
                          onClick={() => handleAlignCount(n)}
                          className="touch-target flex h-11 items-center justify-center rounded-xl bg-white text-base font-extrabold text-ink active:scale-95 motion-reduce:active:scale-100"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile: Adjust button — visible only on mobile next to Counts pill */}
            {bpm !== null && countsEnabled && countGrid && (
              <div className="flex items-center gap-1 sm:hidden">
                <button
                  onClick={() => setShowBeatAlign(a => !a)}
                  className={glassToggle(showBeatAlign, "violet")}
                >
                  {showBeatAlign ? "Done" : "Adjust counts"}
                </button>
              </div>
            )}

            {/*
              Timeline.

              Three things were wrong with the old one, all of them only on the
              device it is actually used on. The track was a 6px hairline. The
              playhead handle was `opacity-0 group-hover:opacity-100`, and there
              is no hover on a phone — so on the target device the handle never
              appeared at all. And the A/B handles were 20px tall with 9px
              labels, well under the thumb minimum.

              The outer element is a 44px pointer area with the visible 8px
              track centred inside it, so the whole strip is grabbable without
              the bar itself becoming a slab.
            */}
            <div
              id="trace-timeline"
              className="group relative flex h-11 cursor-pointer items-center"
              onClick={handleTimelineClick}
              onPointerMove={handleLoopHandlePointerMove}
              onPointerUp={handleLoopHandlePointerUp}
              role="slider"
              aria-label="Video position"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${fmt(currentTime)} of ${fmt(duration)}`}
              tabIndex={0}
            >
              <div className="relative h-2 w-full rounded-full bg-white/20">
                {loopStartPct !== null && loopEndPct !== null && (
                  <div
                    className={`absolute top-0 h-full ${loopSectionActive ? "bg-duo-gold/70" : "bg-duo-gold/30"}`}
                    style={{ left: `${loopStartPct}%`, width: `${loopEndPct - loopStartPct}%` }}
                  />
                )}
                <div
                  className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-duo-green"
                  style={{ width: `${progressPct}%` }}
                />

                {/* A handle */}
                {loopStartPct !== null && (
                  <div
                    className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none select-none py-3"
                    style={{ left: `${loopStartPct}%` }}
                    onPointerDown={e => handleLoopHandlePointerDown(e, "a")}
                    onPointerMove={handleLoopHandlePointerMove}
                    onPointerUp={handleLoopHandlePointerUp}
                  >
                    <div className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-duo-gold px-1.5 text-hud font-extrabold text-ink shadow-stage-sm">A</div>
                  </div>
                )}
                {/* B handle */}
                {loopEndPct !== null && (
                  <div
                    className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none select-none py-3"
                    style={{ left: `${loopEndPct}%` }}
                    onPointerDown={e => handleLoopHandlePointerDown(e, "b")}
                    onPointerMove={handleLoopHandlePointerMove}
                    onPointerUp={handleLoopHandlePointerUp}
                  >
                    <div className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-duo-gold px-1.5 text-hud font-extrabold text-ink shadow-stage-sm">B</div>
                  </div>
                )}

                {/* Playhead — always visible, not hover-gated. */}
                <div
                  className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-stage bg-duo-green shadow-stage-sm"
                  style={{ left: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Controls row — wraps because the full set (skip, play, restart,
                loop, timecode, speed) needs ~445px and a 375px phone has ~336px.
                Without wrapping the icon buttons flex-shrink into ovals. */}
            <div className="scrollbar-hide -mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1">
              <button onClick={skipBack} title="−5s" aria-label="Back 5 seconds" className={`h-11 w-11 shrink-0 ${GLASS_BTN}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.406-1.683.977l-7.108-4.061a1.125 1.125 0 0 1 0-1.954l7.108-4.061A1.125 1.125 0 0 1 21 8.689v8.122ZM11.25 16.811c0 .864-.933 1.406-1.683.977l-7.108-4.061a1.125 1.125 0 0 1 0-1.954l7.108-4.061a1.125 1.125 0 0 1 1.683.977v8.122Z" /></svg>
              </button>

              <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-duo-green text-white shadow-chunk-green transition-[transform,box-shadow] duration-[110ms] ease-out-strong active:translate-y-[4px] active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0 sm:h-12 sm:w-12">
                {playing
                  ? <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
                  : <svg className="h-6 w-6 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                }
              </button>

              <button onClick={skipForward} title="+5s" aria-label="Forward 5 seconds" className={`h-11 w-11 shrink-0 ${GLASS_BTN}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" /></svg>
              </button>

              <button onClick={restart} title="Restart" aria-label="Restart" className={`h-11 w-11 shrink-0 ${GLASS_BTN}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
              </button>

              {/* Loop toggle */}
              <button
                onClick={() => {
                  if (canSection) setLoopSectionActive(a => !a);
                  else setLoopAll(a => !a);
                }}
                className={glassToggle(canSection ? loopSectionActive : loopAll, "amber")}
                title="Toggle loop (L)"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                {canSection
                  ? `A→B ${loopSectionActive ? "On" : "Off"}`
                  : `Loop${loopAll ? " On" : ""}`}
              </button>

              <span className="min-w-[5.5rem] shrink-0 text-center font-mono text-hud tabular-nums text-stage-text/80">
                {fmt(currentTime)} / {fmt(duration)}
              </span>

              {/* Speed — segmented control on all screen sizes */}
              <Segmented
                label="Playback speed"
                tone="stage"
                className="shrink-0"
                value={String(speed)}
                onChange={(v) => {
                  const s = parseFloat(v);
                  setSpeed(s);
                  if (proVideoRef.current) proVideoRef.current.playbackRate = s;
                }}
                options={SPEEDS.map(s => ({ value: String(s), label: `${s}x` }))}
              />

              {/* Volume — hidden on mobile */}
              <div className="ml-auto hidden items-center gap-2 sm:flex">
                <button onClick={() => { const next = !muted; setMuted(next); if (proVideoRef.current) proVideoRef.current.muted = next; }} aria-label={muted ? "Unmute" : "Mute"} className="touch-target text-stage-text/65 transition-ui hover:text-stage-text">
                  {muted
                    ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v16.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v16.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                  }
                </button>
                <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                  onChange={e => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); if (proVideoRef.current) { proVideoRef.current.volume = v; proVideoRef.current.muted = v === 0; } }}
                  aria-label="Volume"
                  className="slider slider-stage w-20"
                />
              </div>
            </div>

            {/* Portrait only — full width, in the transport, in the bottom third
                where the thumb already is (contract §7). */}
            {onComplete && isPortrait && (
              <button
                onClick={handleReadyForTest}
                className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-duo-green text-base font-extrabold tracking-tight text-white shadow-chunk-green transition-[transform,box-shadow] duration-[110ms] ease-out-strong active:translate-y-[4px] active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0"
              >
                Ready to test
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            )}
          </div>

        </motion.div>
      </div>

      {/* ── Video error toast ──────────────────────────────────── */}
      <AnimatePresence>
        {videoError && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-duo-red/20 px-4 py-2 text-hud font-bold text-stage-text backdrop-blur"
          >{videoError}</motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: peek handle — always visible, tap to show controls */}
      <AnimatePresence>
        {!controlsVisible && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute bottom-2 left-1/2 z-40 -translate-x-1/2 flex h-8 w-20 items-center justify-center sm:hidden"
            onClick={showControls}
            aria-label="Show controls"
          >
            <div className="h-1 w-10 rounded-full bg-white/50" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ══════════════════ PRACTICE TUTORIAL ══════════════════ */}
      <AnimatePresence>
        {showTutorial && (
          <DashboardTutorial
            onDone={() => setShowTutorial(false)}
            dismissKey={PRACTICE_TUTORIAL_KEY}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
