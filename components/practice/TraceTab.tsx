"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { initPoseDetection, detectPose } from "@/lib/mediapipe";
import FeedbackCanvas from "@/components/practice/FeedbackCanvas";
import CountStrip from "@/components/practice/CountStrip";
import { TOP_STACK, BOTTOM_SAFE } from "@/components/practice/chrome";
import TapTempoSheet from "@/components/practice/TapTempoSheet";
import BpmInput from "@/components/practice/BpmInput";
import Segmented from "@/components/ui/Segmented";
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
import { parseLinkIdentity, type VideoIdentity } from "@/lib/videoIdentity";
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
  emerald: "bg-duo-green text-white  border-duo-green",
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
  /** Stable identity for the video (enables the shared scan cache). */
  videoIdentity?: VideoIdentity | null;
}

// ── Component ──────────────────────────────────────────────────────────

export default function TraceTab({ videoUrl, onComplete, initialFraming, videoIdentity }: TraceTabProps) {
  const proVideoRef      = useRef<HTMLVideoElement>(null);
  const webcamRef        = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamStreamRef  = useRef<MediaStream | null>(null);
  const hideTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseInitRef      = useRef(false);
  const currentTimeRef   = useRef(0);
  const durationRef      = useRef(0);
  const calibAppliedRef  = useRef(false);
  const trimBoundsRef    = useRef<{ start?: number; end?: number; personCenter?: { x: number; y: number } }>({
    start:        initialFraming?.trimStart,
    end:          initialFraming?.trimEnd,
    personCenter: initialFraming?.personCenter,
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
  const [mirrored,       setMirrored]       = useState(true);

  // ── Framing ─────────────────────────────────────────────────────
  const [proOffsetX, setProOffsetX] = useState(0);
  const [proOffsetY, setProOffsetY] = useState(0);
  const [proZoom,    setProZoom]    = useState(1.0);
  const [aligning,   setAligning]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Loop ────────────────────────────────────────────────────────
  const [loopAll,           setLoopAll]           = useState(true);
  const [loopStart,         setLoopStart]         = useState<number | null>(null);
  const [loopEnd,           setLoopEnd]           = useState<number | null>(null);
  const [loopSectionActive, setLoopSectionActive] = useState(false);

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
    setProOffsetX(0); setProOffsetY(0);
    setProZoom(initialFraming?.zoom ?? 1.0);

    // Apply trim bounds as loop points
    trimBoundsRef.current = { start: initialFraming?.trimStart, end: initialFraming?.trimEnd, personCenter: initialFraming?.personCenter };
    if (initialFraming?.trimStart !== undefined) setLoopStart(initialFraming.trimStart);
    if (initialFraming?.trimEnd   !== undefined) setLoopEnd(initialFraming.trimEnd);
    if (initialFraming?.trimStart !== undefined && initialFraming?.trimEnd !== undefined) {
      setLoopSectionActive(true);
    }
  }, [videoUrl, initialFraming]);

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
      }
      if (initialFraming && !calibAppliedRef.current && canvas.width > 0 && canvas.height > 0) {
        calibAppliedRef.current = true;
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
    const proKps = detectPose(proVideo), userKps = detectPose(webcam);
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

  // ── Loop enforcement ────────────────────────────────────────────
  useEffect(() => {
    if (!loopSectionActive || loopStart === null || loopEnd === null) return;
    let raf: number;
    function check() { const v = proVideoRef.current; if (v && !v.paused && v.currentTime >= loopEnd!) v.currentTime = loopStart!; raf = requestAnimationFrame(check); }
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [loopSectionActive, loopStart, loopEnd]);

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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, restart, markLoopStart, markLoopEnd, skipBack, skipForward, loopStart, loopEnd, handleSetBeatOne]);

  // ── Drag-to-pan ─────────────────────────────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (viewMode !== "overlay") return;
    if (pinchActiveRef.current) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const baseX = proOffsetX, baseY = proOffsetY, startX = e.clientX, startY = e.clientY;
    setIsDragging(true);
    const onMove = (ev: PointerEvent) => {
      if (pinchActiveRef.current) return;
      setProOffsetX(baseX + (ev.clientX - startX));
      setProOffsetY(baseY + (ev.clientY - startY));
    };
    const onUp = () => { setIsDragging(false); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
        <div className="absolute inset-0">
          {webcamError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-white/40">{webcamError}</p>
            </div>
          ) : (
            <video ref={webcamRef} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted autoPlay />
          )}

          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 h-full w-full"
            style={{ opacity: overlayOpacity / 100, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
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
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative overflow-hidden bg-black">
            <video ref={proVideoRef} {...proProps} className="absolute inset-0 h-full w-full object-contain" style={proStyle} />
            <div className="absolute left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur" style={{ top: TOP_STACK }}>
              <div className="h-1.5 w-1.5 rounded-full bg-pink-500" />
              <span className="hud-text text-hud font-extrabold tracking-widest text-white">REFERENCE</span>
            </div>
          </div>
          <div className="relative overflow-hidden bg-black">
            {webcamError ? (
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-xs text-white/40">{webcamError}</p></div>
            ) : (
              <video ref={webcamRef} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted autoPlay />
            )}
            <div className="absolute left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur" style={{ top: TOP_STACK }}>
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
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
            <div className={`flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-1.5 text-xs text-white shadow-lg`}>
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
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="#1a0f00" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
              <circle cx="7" cy="7" r="2" fill="#1a0f00" opacity="0.6"/>
            </svg>
            <span className="text-hud font-extrabold tracking-widest text-stage-text/80">TRACE</span>
          </div>
          {loopSectionActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-duo-gold px-3 py-1.5 backdrop-blur">
              <div className="h-2 w-2 animate-pulse motion-reduce:animate-pulse rounded-full bg-ink" />
              <span className="text-hud font-extrabold tabular-nums text-ink">{fmt(loopStart ?? 0)} → {fmt(loopEnd ?? 0)}</span>
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
                      className="touch-target flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-hud-lg font-extrabold text-stage-text transition-ui hover:bg-white/25 active:scale-95 motion-reduce:active:scale-100"
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

          {onComplete && (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <button
                id="trace-ready-btn"
                onClick={() => {
                  const elapsed = Math.round((Date.now() - traceStartTimeRef.current) / 1000);
                  onComplete(elapsed);
                }}
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
          transition={{ type: "spring", stiffness: 420, damping: 42 }}
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

              {/* Opacity slider (overlay only, hidden on very small screens) */}
              {viewMode === "overlay" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-hud font-bold text-stage-text/70">Opacity</span>
                  <input type="range" min="10" max="90" value={overlayOpacity}
                    onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                    aria-label="Reference overlay opacity"
                    className="slider slider-stage w-20 sm:w-24" />
                  <span className="w-9 text-right text-hud tabular-nums text-stage-text/70">{overlayOpacity}%</span>
                </div>
              )}

              {/* Divider */}
              <div className="h-5 w-px shrink-0 bg-white/15" />

              {/* BPM + Count section */}
              <div id="trace-bpm-count">
                <BpmInput bpm={bpm} onBpmChange={setBpm} onSetBeatOne={handleSetBeatOne}
                  detecting={beatDetecting} onDetect={runBeatDetection} />
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

            {/* Mobile: Ready to test CTA — inside transport panel, hidden on sm+ */}
            {onComplete && (
              <button
                onClick={() => {
                  const elapsed = Math.round((Date.now() - traceStartTimeRef.current) / 1000);
                  onComplete(elapsed);
                }}
                className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-duo-green text-base font-extrabold tracking-tight text-white shadow-chunk-green transition-[transform,box-shadow] duration-[110ms] ease-out-strong active:translate-y-[4px] active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0 sm:hidden"
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
            className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 backdrop-blur"
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

