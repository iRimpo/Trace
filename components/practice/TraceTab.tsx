"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { initPoseDetection, detectPose } from "@/lib/mediapipe";
import FeedbackCanvas from "@/components/practice/FeedbackCanvas";
import BpmInput from "@/components/practice/BpmInput";
import type { CalibrationData } from "@/components/practice/CalibrationModal";
import { CountGrid } from "@/lib/countGrid";
import { detectBeatsFromVideo } from "@/lib/beatDetector";
import { preScanVideo, type PersonCenter, type PreScanResult } from "@/lib/videoPreScan";
import type { MovementEvent } from "@/lib/movementEventDetector";
import type { Keypoint } from "@/lib/mediapipe";
import { track } from "@/lib/analytics";
import TraceTutorial from "@/components/practice/TraceTutorial";

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

const GLASS = "bg-white/90 backdrop-blur-xl border border-[#1a0f00]/10 shadow-sm";
const GLASS_BTN = "flex items-center justify-center rounded-lg transition-all text-[#1a0f00]/40 hover:text-[#1a0f00] hover:bg-[#1a0f00]/06";
const GLASS_PILL = "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all";

function glassToggle(active: boolean, color: string) {
  return active
    ? `${GLASS_PILL} bg-${color}-100 text-${color}-700`
    : `${GLASS_PILL} text-[#1a0f00]/35 hover:text-[#1a0f00]/60 hover:bg-[#1a0f00]/05`;
}

// ── Props ──────────────────────────────────────────────────────────────

interface TraceTabProps {
  videoUrl:       string;
  onComplete?:    (traceTimeSeconds: number) => void;
  initialFraming?: CalibrationData;
}

// ── Component ──────────────────────────────────────────────────────────

export default function TraceTab({ videoUrl, onComplete, initialFraming }: TraceTabProps) {
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
  const autoScanFiredRef    = useRef(false);
  const tutorialShownRef    = useRef(false);
  const timelineDragRef  = useRef<"a" | "b" | null>(null);
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
  const [loopAll,           setLoopAll]           = useState(false);
  const [loopStart,         setLoopStart]         = useState<number | null>(null);
  const [loopEnd,           setLoopEnd]           = useState<number | null>(null);
  const [loopSectionActive, setLoopSectionActive] = useState(false);

  // ── Feedback ────────────────────────────────────────────────────
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [countsEnabled,   setCountsEnabled]   = useState(true);
  const [feedbackOffset,  setFeedbackOffset]  = useState(0);

  // ── Pre-scan ────────────────────────────────────────────────────
  const [preScannedEvents,   setPreScannedEvents]   = useState<MovementEvent[]>([]);
  const [scanProgress,       setScanProgress]       = useState<number | null>(null);
  const [scanEtaSeconds,     setScanEtaSeconds]     = useState<number | null>(null);
  const [scanCompleteFlash,  setScanCompleteFlash]  = useState(false);
  const [scanCompleteCount,  setScanCompleteCount]  = useState<number | null>(null);
  const [scanSource,         setScanSource]         = useState<"auto" | "feedback" | null>(null);
  const [personChoices,      setPersonChoices]      = useState<PersonCenter[] | null>(null);
  const personChoiceResolverRef = useRef<((idx: number) => void) | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  const [detectedDancers,    setDetectedDancers]    = useState<PersonCenter[]>([]);
  const [focusedDancerIdx,   setFocusedDancerIdx]   = useState<number | null>(null);

  function requestPersonChoice(persons: PersonCenter[]): Promise<number> {
    setDetectedDancers(persons);
    return new Promise(resolve => {
      setPersonChoices(persons);
      personChoiceResolverRef.current = (idx: number) => {
        resolve(idx);
        setPersonChoices(null);
        personChoiceResolverRef.current = null;
        setFocusedDancerIdx(idx);
      };
    });
  }

  // ── Beat / count grid ───────────────────────────────────────────
  const [bpm,           setBpm]           = useState<number | null>(null);
  const [beatOneOffset, setBeatOneOffset] = useState(0);
  const [countGrid,     setCountGrid]     = useState<CountGrid | null>(null);
  const [beatDetecting, setBeatDetecting] = useState(false);
  const beatDetectedRef = useRef(false);
  const tapTimesRef     = useRef<number[]>([]);

  // ── UI ──────────────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toolsOpen,       setToolsOpen]       = useState(false);
  const [keysOpen,        setKeysOpen]        = useState(false);
  const [showBeatAlign,   setShowBeatAlign]   = useState(false);
  const [showTutorial,    setShowTutorial]    = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);

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
    try {
      const result = await detectBeatsFromVideo(videoUrl);
      if (result) {
        setBpm(result.bpm);
        if (result.firstBeatTime !== undefined) setBeatOneOffset(result.firstBeatTime);
      }
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

  const runScan = useCallback((source: "auto" | "feedback" = "auto", overridePersonCenter?: { x: number; y: number }) => {
    if (scanProgress !== null) return;
    scanAbortRef.current?.abort();
    const abort = new AbortController();
    scanAbortRef.current = abort;
    setScanSource(source);
    setScanProgress(0);
    setScanEtaSeconds(null);
    const { start, end, personCenter } = trimBoundsRef.current;
    const effectiveCenter = overridePersonCenter ?? personCenter;
    const cacheKey = `${videoUrl}|${start ?? 0}|${end ?? 0}|${effectiveCenter ? `${effectiveCenter.x.toFixed(2)},${effectiveCenter.y.toFixed(2)}` : "auto"}`;

    // Use cached scan if available
    const cached = preScanCache.get(cacheKey);
    if (cached) {
      setPreScannedEvents(cached.events);
      setFeedbackEnabled(true);
      setScanCompleteCount(cached.events.length);
      setScanCompleteFlash(true);
      setTimeout(() => setScanCompleteFlash(false), 2000);
      setScanProgress(null);
      return;
    }

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
      initialFraming?.solo ? undefined : requestPersonChoice,
    )
      .then(result => {
        if (result && !abort.signal.aborted) {
          preScanCache.set(cacheKey, result);
          setPreScannedEvents(result.events);
          setFeedbackEnabled(true);
          setScanCompleteCount(result.events.length);
          setScanCompleteFlash(true);
          setTimeout(() => setScanCompleteFlash(false), 2000);
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
  }, [videoUrl, scanProgress]);

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
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), IDLE_TIMEOUT);
  }, []);

  // ── Video callbacks ─────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const v = proVideoRef.current; if (!v) return;
    if (v.paused) {
      try { await v.play(); setPlaying(true); } catch { setVideoError("Cannot play this video."); return; }
      // Show tutorial on first play for new users
      if (!tutorialShownRef.current && !localStorage.getItem("trace_tutorial_v1_done")) {
        tutorialShownRef.current = true;
        setTimeout(() => setShowTutorial(true), 600);
      }
    } else {
      v.pause(); setPlaying(false);
    }
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
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const baseX = proOffsetX, baseY = proOffsetY, startX = e.clientX, startY = e.clientY;
    setIsDragging(true);
    const onMove = (ev: PointerEvent) => { setProOffsetX(baseX + (ev.clientX - startX)); setProOffsetY(baseY + (ev.clientY - startY)); };
    const onUp = () => { setIsDragging(false); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
      className="relative h-[calc(100vh-3rem)] w-full overflow-hidden bg-black"
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
          />

          <FeedbackCanvas
            proVideoRef={proVideoRef} enabled={feedbackEnabled} showCounts={countsEnabled}
            proOffsetX={proOffsetX} proOffsetY={proOffsetY} proZoom={proZoom} mirrored={mirrored}
            preScannedEvents={preScannedEvents} countGrid={countGrid} feedbackOffset={feedbackOffset}
            topOffset={64}
          />

          <video ref={proVideoRef} {...proProps} className="hidden" />

          {!webcamReady && !webcamError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative overflow-hidden bg-black">
            <video ref={proVideoRef} {...proProps} className="absolute inset-0 h-full w-full object-contain" style={proStyle} />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
              <div className="h-1.5 w-1.5 rounded-full bg-pink-500" />
              <span className="text-[10px] font-semibold tracking-wide text-white/70">REFERENCE</span>
            </div>
          </div>
          <div className="relative overflow-hidden bg-black">
            {webcamError ? (
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-xs text-white/40">{webcamError}</p></div>
            ) : (
              <video ref={webcamRef} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted autoPlay />
            )}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-semibold tracking-wide text-white/70">YOU</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ SCAN PROGRESS OVERLAY ══════════════════ */}
      <AnimatePresence>
        {scanProgress !== null && scanSource !== "feedback" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className={`w-[min(360px,90vw)] rounded-2xl ${GLASS} px-5 py-4`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#080808] text-white">
                  <div className="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-transparent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1a0f00]/80">Scanning video… {scanProgress}%</p>
                  <p className="mt-0.5 text-[11px] text-[#1a0f00]/45">
                    Analyzing movement patterns and counts
                    {scanEtaSeconds != null && scanEtaSeconds > 0 && (
                      <> · ~{scanEtaSeconds}s remaining</>
                    )}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1a0f00]/10">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact scan pill when scan started from feedback button */}
      <AnimatePresence>
        {scanProgress !== null && scanSource === "feedback" && (
          <motion.div
            initial={{ opacity: 0, y: 8, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 8, x: -8 }}
            className="pointer-events-none absolute bottom-20 left-4 z-40"
          >
            <div className={`flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white backdrop-blur`}>
              <div className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-transparent" />
              <span>
                Scanning for feedback… {scanProgress}%{scanEtaSeconds != null && scanEtaSeconds > 0 ? ` · ~${scanEtaSeconds}s` : ""}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════ PERSON SELECTION OVERLAY ════════════════ */}
      <AnimatePresence>
        {personChoices && personChoices.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className={`w-[min(420px,92vw)] rounded-2xl ${GLASS} px-5 py-5`}
            >
              <h2 className="text-sm font-semibold text-[#1a0f00]">Who should Trace focus on?</h2>
              <p className="mt-1 text-xs text-[#1a0f00]/55">
                We detected multiple people in the video. Choose the dancer you want feedback for.
              </p>

              <div className="mt-4 flex flex-wrap items-end justify-center gap-3">
                {personChoices.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => personChoiceResolverRef.current?.(idx)}
                    className="group relative flex h-20 w-20 flex-col items-center justify-end rounded-2xl bg-[#1a0f00]/3 text-[#1a0f00]/70 shadow-sm transition-all hover:bg-[#1a0f00]/6 hover:text-[#1a0f00]"
                  >
                    <div className="absolute inset-x-3 top-3 h-1 rounded-full bg-gradient-to-r from-emerald-400/60 via-sky-400/60 to-violet-400/60 opacity-60" />
                    <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#080808] text-[11px] font-semibold text-white shadow">
                      {idx + 1}
                    </div>
                    <span className="mb-2 text-[10px] font-medium">
                      {p.x < 0.33 ? "Left" : p.x > 0.66 ? "Right" : "Center"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-center">
                <button
                  onClick={() => personChoiceResolverRef.current?.(0)}
                  className="text-[11px] font-medium text-[#1a0f00]/45 hover:text-[#1a0f00]/75"
                >
                  Or continue with Person 1
                </button>
              </div>
            </motion.div>
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
        <div className="pointer-events-auto absolute left-3 top-16 flex flex-col gap-2">
          <div className={`flex items-center gap-1.5 rounded-full ${GLASS} px-3 py-1.5`}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="#1a0f00" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
              <circle cx="7" cy="7" r="2" fill="#1a0f00" opacity="0.6"/>
            </svg>
            <span className="text-[10px] font-bold tracking-widest text-[#1a0f00]/60">TRACE</span>
          </div>
          {loopSectionActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/80 px-3 py-1.5 backdrop-blur">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              <span className="text-[10px] font-semibold text-white">{fmt(loopStart ?? 0)} → {fmt(loopEnd ?? 0)}</span>
            </div>
          )}
        </div>

        {/* ── Top-right: utility buttons ──────────────────────── */}
        <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2">
          {/* Auto-align */}
          {viewMode === "overlay" && (
            <button onClick={autoAlign} disabled={aligning} className={`h-8 w-8 rounded-lg ${GLASS} ${GLASS_BTN} disabled:opacity-40`} title="Auto-align">
              {aligning
                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" /></svg>
              }
            </button>
          )}
          {/* Keyboard shortcuts help */}
          <button onClick={() => setKeysOpen(k => !k)} className={`h-8 w-8 rounded-lg ${GLASS} ${GLASS_BTN}`} title="Keyboard shortcuts">
            <span className="text-xs font-bold">?</span>
          </button>
          {/* Tutorial */}
          <button onClick={() => setShowTutorial(true)} className={`h-8 w-8 rounded-lg ${GLASS} ${GLASS_BTN}`} title="Tutorial">
            <span className="text-sm">📚</span>
          </button>
          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className={`h-8 w-8 rounded-lg ${GLASS} ${GLASS_BTN}`} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
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
              className={`pointer-events-auto absolute right-3 top-14 rounded-xl ${GLASS} p-3`}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ["Space", "Play/Pause"], ["R", "Restart"], ["←/→", "±5 sec"], ["M", "Mirror"],
                  ["L", "Loop"], ["[/]", "Set A/B"], ["T", "Tap BPM"], ["B", "Set beat-1"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="rounded bg-[#1a0f00]/08 px-1.5 py-0.5 font-mono text-[9px] text-[#1a0f00]/50">{key}</kbd>
                    <span className="text-[9px] text-[#1a0f00]/40">{label}</span>
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
                    <span className="w-14 text-[10px] text-[#1a0f00]/40">Timing</span>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.05"
                      value={feedbackOffset}
                      onChange={e => setFeedbackOffset(parseFloat(e.target.value))}
                      className="h-0.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#1a0f00]/10 accent-[#080808]"
                    />
                    <button
                      onClick={() => setFeedbackOffset(0)}
                      className={`min-w-[3.5rem] text-right text-[10px] tabular-nums ${
                        feedbackOffset < 0
                          ? "text-sky-500"
                          : feedbackOffset > 0
                            ? "text-amber-600"
                            : "text-[#1a0f00]/25"
                      }`}
                    >
                      {feedbackOffset === 0
                        ? "On beat"
                        : `${Math.abs(Math.round(feedbackOffset * 1000))}ms ${feedbackOffset < 0 ? "early" : "late"}`}
                    </button>
                  </div>
                )}

                <div className="border-t border-[#1a0f00]/08" />

                {/* Tutorial re-open */}
                <button onClick={() => setShowTutorial(true)} className="text-left text-[10px] text-[#1a0f00]/40 hover:text-[#1a0f00]/70">
                  📚 View Tutorial
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* ── Bottom satellites + dynamic island transport ─────── */}

        {/* Left satellites: tools + feedback + dancer pills */}
        <div className={`pointer-events-auto absolute bottom-4 left-4 flex flex-col gap-2 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
          {/* Tools circle */}
          <button
            onClick={() => setToolsOpen(o => !o)}
            className={`flex h-11 w-11 items-center justify-center rounded-full ${GLASS} transition-all ${
              toolsOpen ? "text-[#080808]" : "text-[#1a0f00]/40 hover:text-[#1a0f00]"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
          </button>

          {/* Detected dancer pills */}
          {detectedDancers.length > 1 && (
            <div className="flex flex-col gap-1">
              {detectedDancers.map((d, idx) => {
                const isFocused = focusedDancerIdx === idx;
                const isScanning = scanProgress !== null && isFocused;
                const label = d.x < 0.33 ? "Left" : d.x > 0.66 ? "Right" : "Center";
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setFocusedDancerIdx(idx);
                      runScan("feedback", d);
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all backdrop-blur ${
                      isFocused
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-black/50 text-white/70 hover:bg-black/70 hover:text-white"
                    }`}
                  >
                    {isScanning ? (
                      <div className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <span className={`h-2 w-2 rounded-full ${isFocused ? "bg-white" : "bg-emerald-400"}`} />
                    )}
                    Dancer {idx + 1} · {label}
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Right satellites: beat align + ready */}
        <div className={`pointer-events-auto absolute bottom-4 right-4 flex flex-col items-end gap-3 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
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
                <p className="mb-0.5 text-[10px] font-semibold text-[#1a0f00]/50">
                  What count is playing right now?
                </p>
                <p className="mb-2 text-[9px] text-[#1a0f00]/35">
                  Pause the video on a moment you recognize, then tap the count number.
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => handleAlignCount(n)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1a0f00]/06 text-xs font-bold text-[#1a0f00]/60 transition-all hover:bg-[#1a0f00]/12 hover:text-[#1a0f00] active:scale-95"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowBeatAlign(false)}
                  className="mt-2 w-full text-center text-[9px] text-[#1a0f00]/30 hover:text-[#1a0f00]/50"
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
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#080808] text-white shadow-md transition-all hover:bg-[#1a1a1a] active:scale-95"
                title="Ready for Test"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
              <span className="text-[10px] font-semibold text-white/80 drop-shadow">Ready to test</span>
            </div>
          )}
        </div>

        {/* Dynamic island transport */}
        <div
          id="trace-transport"
          className={`pointer-events-auto absolute bottom-2 left-1/2 z-30 w-[min(720px,96vw)] -translate-x-1/2 transition-transform duration-500 sm:bottom-4 sm:w-[min(720px,90vw)] ${
            controlsVisible ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className={`rounded-2xl ${GLASS} px-3 py-2 sm:rounded-3xl sm:px-4 sm:py-3`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
            {/* Mobile drag handle — tap to collapse */}
            <button
              className="mb-1 flex w-full cursor-pointer items-center justify-center py-0.5 sm:hidden"
              onClick={() => setControlsVisible(false)}
              aria-label="Collapse controls"
            >
              <div className="h-1 w-8 rounded-full bg-[#1a0f00]/20" />
            </button>
            {/* ── Secondary controls row ─────────────────────────────────────── */}
            <div id="trace-controls-row" className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-3 sm:gap-2">
              {/* View mode segmented control */}
              <div className="flex items-center gap-0.5 rounded-lg bg-[#1a0f00]/06 p-0.5">
                {(["overlay", "side-by-side"] as ViewMode[]).map(m => (
                  <button key={m} onClick={() => switchMode(m)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${viewMode === m ? "bg-white text-[#1a0f00] shadow-sm" : "text-[#1a0f00]/30 hover:text-[#1a0f00]/60"}`}>
                    {m === "overlay" ? "Overlay" : "Side by Side"}
                  </button>
                ))}
              </div>

              {/* Mirror */}
              <button onClick={() => setMirrored(m => !m)} className={glassToggle(mirrored, "blue")}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 12m0 0 4.5-9M3 12h18m0 0-4.5 9M21 12l-4.5-9" /></svg>
                Mirror
              </button>

              {/* Divider */}
              <div className="h-4 w-px bg-[#1a0f00]/10" />

              {/* Feedback pill */}
              <button
                id="trace-feedback-pill"
                onClick={() => {
                  if (preScannedEvents.length === 0 && scanProgress === null) { runScan("feedback"); return; }
                  if (preScannedEvents.length > 0) setFeedbackEnabled(f => !f);
                }}
                className={glassToggle(feedbackEnabled, "emerald")}
              >
                {scanProgress !== null && scanSource === "feedback"
                  ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                }
                {feedbackEnabled ? "Feedback" : preScannedEvents.length === 0 ? "Scan & Feedback" : "Feedback"}
              </button>

              {/* Opacity slider (overlay only, hidden on very small screens) */}
              {viewMode === "overlay" && (
                <div className="hidden items-center gap-1.5 sm:flex">
                  <span className="text-[10px] text-[#1a0f00]/40">Opacity</span>
                  <input type="range" min="10" max="90" value={overlayOpacity}
                    onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                    className="h-0.5 w-20 cursor-pointer appearance-none rounded-full bg-[#1a0f00]/10 accent-[#080808]" />
                  <span className="w-7 text-right text-[10px] tabular-nums text-[#1a0f00]/30">{overlayOpacity}%</span>
                </div>
              )}

              {/* Divider */}
              <div className="h-4 w-px bg-[#1a0f00]/10" />

              {/* BPM + Count section */}
              <div id="trace-bpm-count">
                <BpmInput bpm={bpm} onBpmChange={setBpm} onSetBeatOne={handleSetBeatOne}
                  detecting={beatDetecting} onDetect={runBeatDetection} />
              </div>

              {/* Count on/off pill */}
              {bpm !== null && (
                <button onClick={() => setCountsEnabled(c => !c)} className={glassToggle(countsEnabled, "violet")}>
                  <span className="font-mono text-[10px]">1·2</span>
                  Counts
                </button>
              )}

              {/* Live count + Adjust */}
              {bpm !== null && countsEnabled && countGrid && (
                <div className="flex items-center gap-1.5">
                  {/* Mobile: large count number */}
                  <span className="font-mono text-2xl font-bold tabular-nums text-[#1a0f00]/75 sm:hidden">
                    {countGrid.count(currentTime)?.count ?? "–"}
                  </span>
                  {/* Desktop: small "Count: N" label */}
                  <span className="hidden text-[10px] font-semibold text-[#1a0f00]/50 sm:inline">
                    Count: {countGrid.count(currentTime)?.count ?? "–"}
                  </span>
                  <button
                    onClick={() => setShowBeatAlign(a => !a)}
                    className={`text-[9px] font-semibold ${showBeatAlign ? "text-violet-600" : "text-[#1a0f00]/30 hover:text-[#1a0f00]/60"}`}
                  >
                    Adjust…
                  </button>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div
              id="trace-timeline"
              className="group relative h-1.5 cursor-pointer rounded-full bg-[#1a0f00]/10"
              onClick={handleTimelineClick}
              onPointerMove={handleLoopHandlePointerMove}
              onPointerUp={handleLoopHandlePointerUp}
            >
              {loopStartPct !== null && loopEndPct !== null && (
                <div className={`absolute top-0 h-full rounded-full ${loopSectionActive ? "bg-amber-400/40" : "bg-amber-400/20"}`} style={{ left: `${loopStartPct}%`, width: `${loopEndPct - loopStartPct}%` }} />
              )}
              <div className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-[#080808]" style={{ width: `${progressPct}%` }} />
              {/* A handle */}
              {loopStartPct !== null && (
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none select-none"
                  style={{ left: `${loopStartPct}%` }}
                  onPointerDown={e => handleLoopHandlePointerDown(e, "a")}
                  onPointerMove={handleLoopHandlePointerMove}
                  onPointerUp={handleLoopHandlePointerUp}
                >
                  <div className="flex h-5 items-center rounded-full bg-amber-500 px-1.5 text-[9px] font-bold text-white shadow">A</div>
                </div>
              )}
              {/* B handle */}
              {loopEndPct !== null && (
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none select-none"
                  style={{ left: `${loopEndPct}%` }}
                  onPointerDown={e => handleLoopHandlePointerDown(e, "b")}
                  onPointerMove={handleLoopHandlePointerMove}
                  onPointerUp={handleLoopHandlePointerUp}
                >
                  <div className="flex h-5 items-center rounded-full bg-amber-500 px-1.5 text-[9px] font-bold text-white shadow">B</div>
                </div>
              )}
              <div className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#080808] opacity-0 shadow-md transition-opacity group-hover:opacity-100" style={{ left: `${progressPct}%` }} />
            </div>

            {/* Controls row */}
            <div className="mt-2.5 flex items-center gap-2">
              <button onClick={skipBack} title="−5s" className={`h-8 w-8 ${GLASS_BTN} rounded-lg`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.406-1.683.977l-7.108-4.061a1.125 1.125 0 0 1 0-1.954l7.108-4.061A1.125 1.125 0 0 1 21 8.689v8.122ZM11.25 16.811c0 .864-.933 1.406-1.683.977l-7.108-4.061a1.125 1.125 0 0 1 0-1.954l7.108-4.061a1.125 1.125 0 0 1 1.683.977v8.122Z" /></svg>
              </button>

              <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a0f00]/10 text-[#1a0f00] transition-all hover:bg-[#1a0f00]/18">
                {playing
                  ? <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
                  : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                }
              </button>

              <button onClick={skipForward} title="+5s" className={`h-8 w-8 ${GLASS_BTN} rounded-lg`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" /></svg>
              </button>

              <button onClick={restart} title="Restart" className={`h-8 w-8 ${GLASS_BTN} rounded-lg border border-white/[0.06]`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
              </button>

              {/* Loop toggle */}
              <button
                onClick={() => {
                  if (canSection) setLoopSectionActive(a => !a);
                  else setLoopAll(a => !a);
                }}
                className={`${GLASS_PILL} ${(canSection ? loopSectionActive : loopAll)
                  ? "bg-amber-100 text-amber-700"
                  : "text-[#1a0f00]/35 hover:text-[#1a0f00]/60 hover:bg-[#1a0f00]/05"}`}
                title="Toggle loop (L)"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                {canSection
                  ? `A→B ${loopSectionActive ? "On" : "Off"}`
                  : `Loop${loopAll ? " On" : ""}`}
              </button>

              <span className="min-w-[5rem] font-mono text-[11px] tabular-nums text-[#1a0f00]/50">
                {fmt(currentTime)} / {fmt(duration)}
              </span>

              {/* Speed pills — show all on md+, compact on mobile */}
              <div className="hidden items-center gap-0.5 rounded-lg bg-[#1a0f00]/06 p-0.5 sm:flex">
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => { setSpeed(s); if (proVideoRef.current) proVideoRef.current.playbackRate = s; }}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${speed === s ? "bg-white text-[#1a0f00] shadow-sm" : "text-[#1a0f00]/30 hover:text-[#1a0f00]/60"}`}
                  >{s}x</button>
                ))}
              </div>
              {/* Mobile speed toggle */}
              <button
                className="flex items-center gap-0.5 rounded-lg bg-[#1a0f00]/06 px-2 py-1 text-[10px] font-bold text-[#1a0f00]/60 sm:hidden"
                onClick={() => {
                  const idx = SPEEDS.indexOf(speed as typeof SPEEDS[number]);
                  const next = SPEEDS[(idx + 1) % SPEEDS.length];
                  setSpeed(next);
                  if (proVideoRef.current) proVideoRef.current.playbackRate = next;
                }}
              >
                {speed}x
              </button>

              {/* Volume — hidden on mobile */}
              <div className="ml-auto hidden items-center gap-2 sm:flex">
                <button onClick={() => { const next = !muted; setMuted(next); if (proVideoRef.current) proVideoRef.current.muted = next; }} className="text-[#1a0f00]/30 hover:text-[#1a0f00]/60">
                  {muted
                    ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v16.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v16.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                  }
                </button>
                <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                  onChange={e => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); if (proVideoRef.current) { proVideoRef.current.volume = v; proVideoRef.current.muted = v === 0; } }}
                  className="h-0.5 w-16 cursor-pointer appearance-none rounded-full bg-[#1a0f00]/10 accent-[#080808]"
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
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#080808] py-2.5 text-sm font-semibold text-white active:scale-[0.98] sm:hidden"
              >
                Ready to test
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            )}
          </div>

        </div>
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

      {/* Tutorial overlay */}
      {showTutorial && (
        <TraceTutorial onClose={() => setShowTutorial(false)} />
      )}
    </div>
  );
}

