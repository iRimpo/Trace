"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Keypoint,
  detectPose,
  initPoseDetection,
  retryPoseDetection,
  getInitError,
  smoothKeypoints,
} from "@/lib/mediapipe";
import { drawSkeleton, clearCanvas, syncCanvasSize } from "@/lib/skeleton";
import {
  GhostSettings,
  loadGhostSettings,
  saveGhostSettings,
  normalizeKeypoints,
  mirrorForComparison,
  calculateMatchScore,
} from "@/lib/ghost";

// ── Constants ───────────────────────────────────────────────────────

const SPEEDS = [0.5, 0.75, 1, 1.25];
const FPS_OPTIONS = [
  { label: "15 fps", value: 15, interval: 66 },
  { label: "30 fps", value: 30, interval: 33 },
  { label: "60 fps", value: 60, interval: 16 },
] as const;

const SETTINGS_KEY = "trace-settings";

function loadSettings() {
  if (typeof window === "undefined") return { fps: 15 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { fps: 15, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { fps: 15 };
}

function saveSettings(s: { fps: number }) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

/** Linear interpolation between two keypoint arrays */
function lerpKeypoints(a: Keypoint[], b: Keypoint[], t: number): Keypoint[] {
  return b.map((kp, i) => {
    const prev = a[i];
    if (!prev || (kp.score ?? 0) < 0.3 || (prev.score ?? 0) < 0.3) return kp;
    return {
      ...kp,
      x: prev.x + (kp.x - prev.x) * t,
      y: prev.y + (kp.y - prev.y) * t,
    };
  });
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Props ───────────────────────────────────────────────────────────

interface TraceTabProps {
  videoUrl: string;
  onComplete?: () => void;
}

// ── Component ───────────────────────────────────────────────────────

export default function TraceTab({ videoUrl, onComplete }: TraceTabProps) {
  // Refs – media elements
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs – detection data (double-buffer for interpolation)
  const rafRef = useRef(0);
  const prevUserRef = useRef<Keypoint[] | null>(null);
  const currUserRef = useRef<Keypoint[] | null>(null);
  const prevProRef = useRef<Keypoint[] | null>(null);
  const currProRef = useRef<Keypoint[] | null>(null);
  const lastDetectTime = useRef(0);
  const lastVideoTime = useRef(-1);
  const highScoreStart = useRef<number | null>(null);

  // Detection counters
  const webcamDetCount = useRef(0);
  const videoDetCount = useRef(0);
  const attemptCount = useRef(0);

  // ── Settings state ──────────────────────────────────────────────
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const detectionInterval = FPS_OPTIONS.find(o => o.value === settings.fps)?.interval ?? 66;
  const detectionIntervalRef = useRef(detectionInterval);
  detectionIntervalRef.current = detectionInterval;

  // ── Fullscreen state ────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Video state ───────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // ── Webcam state ──────────────────────────────────────────────────
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // ── Pose state ────────────────────────────────────────────────────
  const [modelLoading, setModelLoading] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionStats, setDetectionStats] = useState({ webcam: 0, video: 0 });

  // ── Ghost state ───────────────────────────────────────────────────
  const [ghost, setGhost] = useState<GhostSettings>(loadGhostSettings);
  const [matchScore, setMatchScore] = useState(0);
  const [showGreat, setShowGreat] = useState(false);

  // ── PiP video state ───────────────────────────────────────────────
  const [pipCollapsed, setPipCollapsed] = useState(false);

  // ── Settings helpers ──────────────────────────────────────────────
  const updateFps = useCallback((fps: number) => {
    const next = { ...settings, fps };
    setSettings(next);
    saveSettings(next);
  }, [settings]);

  const updateGhost = useCallback((patch: Partial<GhostSettings>) => {
    setGhost((prev) => {
      const next = { ...prev, ...patch };
      saveGhostSettings(next);
      return next;
    });
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      setControlsVisible(true);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Auto-hide controls in fullscreen after 3s of no mouse movement
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isFullscreen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [isFullscreen]);

  // ── Initialize webcam ─────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled || !webcamRef.current) return;
        const webcam = webcamRef.current;
        webcam.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          webcam.onloadedmetadata = () => resolve();
          webcam.onerror = () => reject(new Error("Webcam stream failed"));
          setTimeout(() => resolve(), 3000);
        });
        if (cancelled) return;
        await webcam.play();
        if (!cancelled) {
          setWebcamReady(true);
          console.log("[Trace] Webcam ready");
        }
      } catch (err) {
        if (cancelled) return;
        const isDenied = err instanceof DOMException && err.name === "NotAllowedError";
        setWebcamError(isDenied
          ? "Camera access denied. Please enable camera permissions."
          : "Could not start camera. Please try refreshing.");
      }
    }
    start();
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── Initialize pose model ─────────────────────────────────────────
  useEffect(() => {
    initPoseDetection().then((ok) => {
      setModelReady(ok);
      if (!ok) setModelError(getInitError() || "Unknown error");
      setModelLoading(false);
    });
  }, []);

  const handleRetryModel = useCallback(async () => {
    setModelLoading(true);
    setModelError(null);
    const ok = await retryPoseDetection();
    setModelReady(ok);
    if (!ok) setModelError(getInitError() || "Unknown error");
    setModelLoading(false);
  }, []);

  // ── Detection loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!modelReady) return;
    let running = true;
    let lastTime = 0;

    async function loop() {
      console.log("[Trace] Detection loop started, interval:", detectionIntervalRef.current, "ms");
      while (running) {
        const now = performance.now();
        const interval = detectionIntervalRef.current;
        if (now - lastTime < interval) {
          await new Promise((r) => setTimeout(r, Math.min(4, interval / 4)));
          continue;
        }
        lastTime = now;
        attemptCount.current++;
        const attempt = attemptCount.current;

        // Webcam
        const webcam = webcamRef.current;
        if (webcam && webcam.readyState >= 2 && webcam.videoWidth > 0) {
          try {
            const raw = detectPose(webcam);
            if (raw) {
              const smoothed = smoothKeypoints(currUserRef.current, raw, 0.65);
              prevUserRef.current = currUserRef.current;
              currUserRef.current = smoothed;
              lastDetectTime.current = now;
              webcamDetCount.current++;
              if (webcamDetCount.current === 1) {
                console.log("[Trace] First webcam detection:", raw.length, "kps",
                  { x: Math.round(raw[0].x), y: Math.round(raw[0].y), score: raw[0].score?.toFixed(2) });
                setDetecting(true);
              }
            }
          } catch (err) {
            if (webcamDetCount.current === 0) console.error("[Trace] Webcam error:", err);
          }
        }

        // Video
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          const vt = video.currentTime;
          const frameChanged = Math.abs(vt - lastVideoTime.current) > 0.03;
          if (frameChanged || !currProRef.current) {
            lastVideoTime.current = vt;
            try {
              const raw = detectPose(video);
              if (raw) {
                const smoothed = smoothKeypoints(currProRef.current, raw, 0.65);
                prevProRef.current = currProRef.current;
                currProRef.current = smoothed;
                videoDetCount.current++;
                if (videoDetCount.current === 1) {
                  console.log("[Trace] First video detection:", raw.length, "kps",
                    { x: Math.round(raw[0].x), y: Math.round(raw[0].y), score: raw[0].score?.toFixed(2) });
                }
              }
            } catch (err) {
              if (videoDetCount.current === 0) console.error("[Trace] Video error:", err);
            }
          }
        }

        if (attempt % 30 === 0) {
          setDetectionStats({ webcam: webcamDetCount.current, video: videoDetCount.current });
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    loop();
    return () => { running = false; };
  }, [modelReady]);

  // ── Drawing loop (rAF 60fps) with interpolation ───────────────────
  useEffect(() => {
    if (!modelReady) return;

    function draw() {
      const webcamCanvas = webcamCanvasRef.current;
      const webcam = webcamRef.current;

      if (webcamCanvas && webcam && webcam.videoWidth > 0) {
        syncCanvasSize(webcamCanvas, webcam);
        const ctx = webcamCanvas.getContext("2d");
        if (ctx) {
          clearCanvas(webcamCanvas);

          // Interpolate user keypoints between detections for smooth rendering
          let userDraw = currUserRef.current;
          if (userDraw && prevUserRef.current) {
            const elapsed = performance.now() - lastDetectTime.current;
            const t = Math.min(1, elapsed / detectionIntervalRef.current);
            userDraw = lerpKeypoints(prevUserRef.current, userDraw, t);
          }

          // User skeleton
          if (userDraw) {
            drawSkeleton(ctx, userDraw, {
              color: "#3B82F6",
              lineWidth: 3,
              pointRadius: 5,
              glow: true,
              colorCoded: true,
            });
          }

          // Ghost overlay
          if (ghost.enabled && currProRef.current && userDraw) {
            const normalized = normalizeKeypoints(currProRef.current, userDraw);
            try {
              ctx.globalAlpha = ghost.opacity;
              drawSkeleton(ctx, normalized, {
                color: ghost.color,
                lineWidth: 4,
                pointRadius: 6,
                glow: true,
                colorCoded: false,
              });
            } finally {
              ctx.globalAlpha = 1;
            }

            const mirrored = mirrorForComparison(normalized, webcamCanvas.width);
            const result = calculateMatchScore(userDraw, mirrored);
            setMatchScore((prev) => result.score === prev ? prev : result.score);

            if (result.score >= 90) {
              if (!highScoreStart.current) {
                highScoreStart.current = Date.now();
              } else if (Date.now() - highScoreStart.current > 3000) {
                setShowGreat(true);
                highScoreStart.current = Date.now() + 5000;
                setTimeout(() => setShowGreat(false), 2500);
              }
            } else {
              highScoreStart.current = null;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [modelReady, ghost, detectionInterval]);

  // ── Video helpers ─────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try { await v.play(); setPlaying(true); }
      catch { setVideoError("This video cannot be played in the browser."); }
    } else { v.pause(); setPlaying(false); }
  }, []);

  const restart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setCurrentTime(0);
  }, []);

  const changeSpeed = useCallback((s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }, []);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = frac * duration;
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
    },
    [duration]
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyR") { e.preventDefault(); restart(); }
      if (e.code === "KeyF") { e.preventDefault(); toggleFullscreen(); }
      if (e.code === "Escape" && isFullscreen) { document.exitFullscreen(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, restart, toggleFullscreen, isFullscreen]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      onMouseMove={showControls}
      onClick={showControls}
      className={`flex flex-col ${
        isFullscreen ? "h-screen w-screen bg-black" : "gap-4"
      }`}
    >
      {/* Status bar — always visible in normal mode, auto-hide in fullscreen */}
      <div
        className={`flex flex-wrap items-center gap-3 px-4 py-2.5 transition-all duration-300 ${
          isFullscreen
            ? `absolute left-0 right-0 top-0 z-40 bg-black/60 backdrop-blur ${
                controlsVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
              }`
            : "rounded-xl border border-brand-dark/[0.06] bg-white"
        }`}
      >
        {/* Model */}
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${modelLoading ? "animate-pulse bg-amber-400" : modelReady ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className={`text-[10px] font-medium ${isFullscreen ? "text-white/50" : "text-brand-dark/40"}`}>
            {modelLoading ? "Loading model..." : modelReady ? "Model ready" : "Model failed"}
          </span>
          {modelError && !modelLoading && (
            <button onClick={handleRetryModel} className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/50 hover:bg-white/20">Retry</button>
          )}
        </div>
        <div className={`h-3 w-px ${isFullscreen ? "bg-white/10" : "bg-brand-dark/[0.06]"}`} />
        {/* Webcam */}
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${webcamError ? "bg-red-500" : webcamReady ? "bg-emerald-500" : "animate-pulse bg-amber-400"}`} />
          <span className={`text-[10px] font-medium ${isFullscreen ? "text-white/50" : "text-brand-dark/40"}`}>
            {webcamError ? "Webcam error" : webcamReady ? "Webcam on" : "Loading..."}
          </span>
        </div>
        <div className={`h-3 w-px ${isFullscreen ? "bg-white/10" : "bg-brand-dark/[0.06]"}`} />
        {/* Detection */}
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${detecting ? "animate-pulse bg-blue-500" : "bg-brand-dark/10"}`} />
          <span className={`text-[10px] font-medium ${isFullscreen ? "text-white/50" : "text-brand-dark/40"}`}>
            {detecting ? `${settings.fps}fps (cam:${detectionStats.webcam} vid:${detectionStats.video})` : "Waiting..."}
          </span>
        </div>
        {/* Match score */}
        {matchScore > 0 && (
          <>
            <div className={`h-3 w-px ${isFullscreen ? "bg-white/10" : "bg-brand-dark/[0.06]"}`} />
            <div className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${matchScore >= 90 ? "bg-emerald-500/15 text-emerald-500" : matchScore >= 60 ? "bg-amber-500/15 text-amber-500" : "bg-red-500/15 text-red-500"}`}>
              {matchScore}%
            </div>
          </>
        )}
      </div>

      {/* Model error */}
      {modelError && !modelLoading && !isFullscreen && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-xs font-medium text-red-600">Pose detection failed. {modelError}</p>
        </div>
      )}

      {/* ── Main webcam view ─────────────────────────────────────────── */}
      <div className={`relative ${isFullscreen ? "flex-1" : ""}`}>
        <div className={`relative overflow-hidden bg-black ${isFullscreen ? "h-full" : "rounded-2xl"}`}>
          {webcamError ? (
            <div className="flex aspect-video items-center justify-center p-6 text-center">
              <div>
                <svg className="mx-auto h-8 w-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.739-.207 1.165-.96.958-1.7a1.126 1.126 0 0 0-1.7-.957l.742 2.657Z" />
                </svg>
                <p className="mt-3 text-xs text-white/40">{webcamError}</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={webcamRef}
                className={`w-full object-cover ${isFullscreen ? "h-full" : "aspect-video"}`}
                style={{ transform: "scaleX(-1)" }}
                playsInline
                muted
              />
              <canvas
                ref={webcamCanvasRef}
                className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                style={{ transform: "scaleX(-1)" }}
              />
            </>
          )}

          {/* "Great!" */}
          <AnimatePresence>
            {showGreat && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="rounded-2xl bg-emerald-500/90 px-6 py-3 backdrop-blur">
                  <p className="text-2xl font-bold text-white">Great!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Webcam loading */}
          {!webcamReady && !webcamError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
            </div>
          )}

          {/* Top-left label */}
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg bg-black/50 px-2.5 py-1 backdrop-blur">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[10px] font-semibold tracking-wide text-white/70">YOU + GHOST</span>
          </div>

          {/* Top-right buttons: settings + fullscreen */}
          <div className={`absolute right-3 top-3 z-20 flex items-center gap-1.5 transition-opacity duration-300 ${isFullscreen && !controlsVisible ? "opacity-0" : "opacity-100"}`}>
            {/* Settings dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white/60 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </button>
              {showSettings && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-xl bg-gray-900/95 p-3 shadow-2xl backdrop-blur">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Detection FPS</p>
                  <div className="flex gap-1">
                    {FPS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateFps(opt.value)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all ${
                          settings.fps === opt.value
                            ? "bg-blue-500 text-white"
                            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[9px] text-white/20">
                    {settings.fps === 60 ? "Smoothest. Uses more CPU/GPU." : settings.fps === 30 ? "Balanced smoothness and performance." : "Lightest on resources."}
                  </p>
                </div>
              )}
            </div>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white/60 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
            >
              {isFullscreen ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* PiP reference video */}
        <div
          className={`absolute z-30 overflow-hidden rounded-xl border-2 border-white/20 shadow-2xl transition-all duration-200 ${
            pipCollapsed ? "bottom-3 right-3 h-10 w-32" : isFullscreen ? "bottom-4 right-4 w-64 sm:w-80" : "bottom-3 right-3 w-56 sm:w-72"
          } ${isFullscreen && !controlsVisible ? "opacity-0" : "opacity-100"}`}
        >
          <button
            onClick={() => setPipCollapsed(!pipCollapsed)}
            className="flex w-full items-center gap-1.5 bg-black/80 px-2.5 py-1.5 backdrop-blur"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="flex-1 text-left text-[9px] font-semibold tracking-wide text-white/60">REFERENCE</span>
            <svg className={`h-3 w-3 text-white/40 transition-transform ${pipCollapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {!pipCollapsed && (
            <div className="relative bg-black">
              {videoError ? (
                <div className="flex aspect-video items-center justify-center p-3">
                  <p className="text-center text-[9px] text-white/30">{videoError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="aspect-video w-full object-contain"
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                  onLoadedData={() => console.log("[Trace] Video loaded:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight)}
                  onLoadedMetadata={(e) => { const v = e.currentTarget; setDuration(v.duration); v.volume = volume; }}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => setPlaying(false)}
                  onError={(e) => { const v = e.currentTarget; console.error("[Trace] Video error:", v.error?.code); setVideoError(`Unable to load video (error ${v.error?.code}).`); }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Control bar ──────────────────────────────────────────── */}
      <div
        className={`transition-all duration-300 ${
          isFullscreen
            ? `absolute bottom-0 left-0 right-0 z-40 bg-black/60 p-4 backdrop-blur sm:p-5 ${
                controlsVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
              }`
            : "rounded-2xl border border-brand-dark/[0.06] bg-white p-4 sm:p-5"
        }`}
      >
        {/* Timeline */}
        <div className="group relative h-1.5 cursor-pointer rounded-full bg-brand-dark/[0.06]" onClick={handleTimelineClick}>
          <div className="h-full rounded-full bg-blue-500 transition-all duration-100" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
          <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 opacity-0 shadow-md transition-opacity group-hover:opacity-100" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
        </div>

        {/* Controls row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Play */}
          <button onClick={togglePlay} className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${isFullscreen ? "bg-white/15 text-white hover:bg-white/25" : "bg-brand-dark text-white hover:bg-brand-dark/80"}`}>
            {playing ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          {/* Restart */}
          <button onClick={restart} className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${isFullscreen ? "border-white/10 text-white/40 hover:text-white/70" : "border-brand-dark/[0.06] text-brand-dark/40 hover:text-brand-dark/70"}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          </button>
          {/* Time */}
          <span className={`min-w-[5rem] font-mono text-xs ${isFullscreen ? "text-white/40" : "text-brand-dark/40"}`}>
            {fmt(currentTime)} <span className={isFullscreen ? "text-white/20" : "text-brand-dark/20"}>/</span> {fmt(duration)}
          </span>
          {/* Speeds */}
          <div className={`flex items-center gap-1 rounded-lg border p-0.5 ${isFullscreen ? "border-white/10" : "border-brand-dark/[0.06]"}`}>
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => changeSpeed(s)} className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${speed === s ? (isFullscreen ? "bg-white/20 text-white" : "bg-brand-dark text-white") : (isFullscreen ? "text-white/25 hover:text-white/50" : "text-brand-dark/25 hover:text-brand-dark/50")}`}>
                {s}x
              </button>
            ))}
          </div>
          {/* Volume */}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { setMuted((m) => !m); if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }} className={isFullscreen ? "text-white/30 hover:text-white/60" : "text-brand-dark/30 hover:text-brand-dark/60"}>
              {muted ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v16.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v16.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
              )}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-brand-dark/[0.06] accent-blue-500 sm:w-20"
            />
          </div>
        </div>

        {/* Ghost controls */}
        <div className={`mt-4 flex flex-wrap items-center gap-3 border-t pt-4 ${isFullscreen ? "border-white/10" : "border-brand-dark/[0.06]"}`}>
          <button onClick={() => updateGhost({ enabled: !ghost.enabled })} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${ghost.enabled ? "bg-emerald-500/10 text-emerald-500" : isFullscreen ? "bg-white/5 text-white/25" : "bg-brand-dark/[0.04] text-brand-dark/25"}`}>
            <div className={`h-2 w-2 rounded-full ${ghost.enabled ? "bg-emerald-500" : "bg-brand-dark/15"}`} />
            Ghost {ghost.enabled ? "On" : "Off"}
          </button>
          {ghost.enabled && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium ${isFullscreen ? "text-white/25" : "text-brand-dark/25"}`}>Opacity</span>
              <input type="range" min="0" max="80" value={Math.round(ghost.opacity * 100)} onChange={(e) => updateGhost({ opacity: parseInt(e.target.value) / 100 })} className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-brand-dark/[0.06] accent-emerald-500" />
              <span className={`w-7 text-[10px] ${isFullscreen ? "text-white/20" : "text-brand-dark/20"}`}>{Math.round(ghost.opacity * 100)}%</span>
            </div>
          )}
          {ghost.enabled && (
            <label className="flex cursor-pointer items-center gap-1.5">
              <span className={`text-[10px] font-medium ${isFullscreen ? "text-white/25" : "text-brand-dark/25"}`}>Color</span>
              <input type="color" value={ghost.color} onChange={(e) => updateGhost({ color: e.target.value })} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" />
            </label>
          )}
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            {[{ key: "Space", label: "Play" }, { key: "R", label: "Restart" }, { key: "F", label: "Fullscreen" }].map(({ key, label }) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${isFullscreen ? "bg-white/5 text-white/20" : "bg-brand-dark/[0.04] text-brand-dark/20"}`}>{key}</kbd>
                <span className={`text-[9px] ${isFullscreen ? "text-white/15" : "text-brand-dark/15"}`}>{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Ready for Test */}
        {onComplete && !isFullscreen && (
          <div className="mt-4 border-t border-brand-dark/[0.06] pt-4">
            <button onClick={onComplete} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20">
              Ready for Test?
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
