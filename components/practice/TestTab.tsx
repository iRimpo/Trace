"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { detectPose, initPoseDetection } from "@/lib/mediapipe";
import { VideoRecorder } from "@/lib/videoRecorder";
import { PoseRecorder, type PoseFrame } from "@/lib/poseRecorder";
import { createPracticeSession } from "@/lib/uploadRecording";
import { storeRecordingSession, loadVideoSession } from "@/lib/sessionVideoStorage";
import { useAuth } from "@/context/AuthContext";
import type { CalibrationData } from "@/components/practice/CalibrationModal";

// ── Types ───────────────────────────────────────────────────────────────

type TestState = "framing" | "countdown" | "recording" | "preview";
type CountdownNum = 3 | 2 | 1 | 0;

// ── Helpers ─────────────────────────────────────────────────────────────

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function drawRefVideo(
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
  if (vAspect > cAspect) { fitW = cW; fitH = cW / vAspect; }
  else                   { fitH = cH; fitW = cH * vAspect; }
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

// ── Props ───────────────────────────────────────────────────────────────

interface TestTabProps {
  videoUrl:        string;
  videoId:         string | null;
  videoSource:     "youtube" | "tiktok" | "upload";
  videoTitle:      string;
  traceTimeSeconds?: number;
  onComplete:      (sessionId: string) => void;
  initialFraming?: CalibrationData;
}

// ── Component ───────────────────────────────────────────────────────────

export default function TestTab({ videoUrl, videoId, videoSource, videoTitle, traceTimeSeconds, onComplete, initialFraming }: TestTabProps) {
  const { user } = useAuth();

  // ── State machine ────────────────────────────────────────────────
  const [testState,    setTestState]    = useState<TestState>("framing");
  const [countdownNum, setCountdownNum] = useState<CountdownNum>(3);

  // ── Refs (stable across state transitions) ───────────────────────
  const webcamRef        = useRef<HTMLVideoElement>(null);
  const proVideoRef      = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamStreamRef  = useRef<MediaStream | null>(null);
  const recorderRef      = useRef<VideoRecorder | null>(null);
  const poseRecorderRef  = useRef<PoseRecorder | null>(null);
  const stopTriggerRef   = useRef<(() => void) | null>(null);
  const poseInitRef       = useRef(false);
  const refDurationRef    = useRef(0);
  const calibAppliedRef   = useRef(false);
  const refPoseRecorderRef = useRef<PoseRecorder | null>(null);

  // ── Webcam ───────────────────────────────────────────────────────
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // ── Reference video ──────────────────────────────────────────────
  const [refDuration, setRefDuration] = useState(0);
  const [refTime,     setRefTime]     = useState(0);

  // ── Overlay framing ──────────────────────────────────────────────
  const [proOffsetX,     setProOffsetX]     = useState(0);
  const [proOffsetY,     setProOffsetY]     = useState(0);
  const [proZoom,        setProZoom]        = useState(1.0);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [mirrored,       setMirrored]       = useState(true);
  const [isDragging,     setIsDragging]     = useState(false);
  const [framingExpanded, setFramingExpanded] = useState(false);

  // ── Results ──────────────────────────────────────────────────────
  const [recordingBlob,  setRecordingBlob]  = useState<Blob | null>(null);
  const [poseFrames,     setPoseFrames]     = useState<PoseFrame[]>([]);
  const [refPoseFrames,  setRefPoseFrames]  = useState<PoseFrame[]>([]);
  const [blobUrl,        setBlobUrl]        = useState<string | null>(null);

  // ── UI ───────────────────────────────────────────────────────────
  const [elapsedSec,   setElapsedSec]   = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────
  // Webcam init
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        webcamStreamRef.current = stream;
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          await webcamRef.current.play();
          if (!cancelled) setWebcamReady(true);
        }
      } catch {
        if (!cancelled) setWebcamError("Camera access denied.");
      }
    }
    start();
    return () => {
      cancelled = true;
      webcamStreamRef.current?.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    };
  }, []);

  // Re-attach webcam stream when video element remounts (preview → framing)
  useEffect(() => {
    if (testState === "preview") return;
    const webcam = webcamRef.current;
    const stream = webcamStreamRef.current;
    if (webcam && stream && !webcam.srcObject) {
      webcam.srcObject = stream;
      webcam.play().catch(() => {});
    }
  }, [testState]);

  // ─────────────────────────────────────────────────────────────────
  // Canvas drawing loop (all non-preview states)
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (testState === "preview") return;
    let raf: number;
    function frame() {
      const canvas = overlayCanvasRef.current;
      const pro    = proVideoRef.current;
      if (!canvas || !pro) { raf = requestAnimationFrame(frame); return; }
      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.offsetWidth, h = parent.offsetHeight;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      }

      // Apply calibration on first valid frame
      if (initialFraming && !calibAppliedRef.current && canvas.width > 0 && canvas.height > 0) {
        calibAppliedRef.current = true;
        setProOffsetX(initialFraming.offsetXNorm * canvas.width);
        setProOffsetY(initialFraming.offsetYNorm * canvas.height);
        setProZoom(initialFraming.zoom);
      }

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRefVideo(ctx, pro, canvas.width, canvas.height, proOffsetX, proOffsetY, proZoom, mirrored);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [testState, proOffsetX, proOffsetY, proZoom, mirrored, initialFraming]);

  // Scroll-wheel zoom on overlay canvas
  useEffect(() => {
    if (testState === "preview") return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setProZoom(z => Math.min(Math.max(z * (e.deltaY < 0 ? 1.05 : 0.95), 0.3), 3.0));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [testState]);

  // ─────────────────────────────────────────────────────────────────
  // Blob URL lifecycle
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recordingBlob) { setBlobUrl(null); return; }
    const url = URL.createObjectURL(recordingBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordingBlob]);

  // ─────────────────────────────────────────────────────────────────
  // Countdown → kick off recording
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (testState !== "countdown") return;
    setCountdownNum(3);
    const t1 = setTimeout(() => setCountdownNum(2), 1000);
    const t2 = setTimeout(() => setCountdownNum(1), 2000);
    const t3 = setTimeout(() => setCountdownNum(0), 3000);
    const t4 = setTimeout(() => {
      const stream = webcamStreamRef.current;
      if (!stream) { setTestState("framing"); return; }
      // Play reference from the scrubbed start position
      if (proVideoRef.current) {
        proVideoRef.current.currentTime = refTime;
        proVideoRef.current.play().catch(() => {});
      }
      const recorder = new VideoRecorder();
      recorderRef.current = recorder;
      recorder.startRecording(stream);
      const poseRec = new PoseRecorder();
      poseRecorderRef.current = poseRec;
      poseRec.start();
      const refPoseRec = new PoseRecorder();
      refPoseRecorderRef.current = refPoseRec;
      refPoseRec.start();
      setElapsedSec(0);
      setTestState("recording");
    }, 3500);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [testState, refTime]);

  // ─────────────────────────────────────────────────────────────────
  // Recording: pose capture rAF + display timer + auto-stop
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (testState !== "recording") return;
    const recorder = recorderRef.current;
    const poseRec  = poseRecorderRef.current;
    if (!recorder || !poseRec) return;
    const rec: VideoRecorder = recorder;
    const pr:  PoseRecorder  = poseRec;
    if (!poseInitRef.current) {
      poseInitRef.current = true;
      initPoseDetection().catch(console.error);
    }
    let stopped = false;
    let rafId: number;
    let frameCount = 0;
    function captureLoop() {
      if (stopped) return;
      frameCount++;
      if (frameCount % 4 === 0) {
        const webcam = webcamRef.current;
        if (webcam) { const kps = detectPose(webcam); if (kps) pr.capture(kps); }

        // Also capture reference video pose (for sync scoring)
        const proVideo = proVideoRef.current;
        if (proVideo && !proVideo.paused && proVideo.readyState >= 2) {
          const offscreen = document.createElement("canvas");
          offscreen.width  = proVideo.videoWidth;
          offscreen.height = proVideo.videoHeight;
          const ctx2 = offscreen.getContext("2d");
          if (ctx2) {
            ctx2.drawImage(proVideo, 0, 0);
            const refKps = detectPose(offscreen);
            if (refKps) refPoseRecorderRef.current?.capture(refKps);
          }
        }
      }
      rafId = requestAnimationFrame(captureLoop);
    }
    rafId = requestAnimationFrame(captureLoop);
    const timerInterval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    async function doStop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      clearInterval(timerInterval);
      if (autoStopTimeout) clearTimeout(autoStopTimeout);
      stopTriggerRef.current = null;
      proVideoRef.current?.pause();
      try {
        const blob      = await rec.stopRecording();
        const frames    = pr.stop();
        const refFrames = refPoseRecorderRef.current?.stop() ?? [];
        setRecordingBlob(blob);
        setPoseFrames(frames);
        setRefPoseFrames(refFrames);
      } catch (e) {
        console.error("stopRecording failed:", e);
        pr.stop();
        refPoseRecorderRef.current?.stop();
      }
      setTestState("preview");
    }
    stopTriggerRef.current = doStop;
    const duration = refDurationRef.current;
    const autoStopTimeout = duration > 0 ? setTimeout(doStop, duration * 1000) : null;
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      clearInterval(timerInterval);
      if (autoStopTimeout) clearTimeout(autoStopTimeout);
      rec.abort();
      pr.stop();
      stopTriggerRef.current = null;
    };
  }, [testState]);

  // ─────────────────────────────────────────────────────────────────
  // Drag-to-pan overlay
  // ─────────────────────────────────────────────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (testState !== "framing") return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const baseX = proOffsetX, baseY = proOffsetY;
    const startX = e.clientX, startY = e.clientY;
    setIsDragging(true);
    function onMove(ev: PointerEvent) {
      setProOffsetX(baseX + (ev.clientX - startX));
      setProOffsetY(baseY + (ev.clientY - startY));
    }
    function onUp() {
      setIsDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // ─────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (saving) return;
    if (!user || !recordingBlob) { onComplete(""); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const recBlobUrl = URL.createObjectURL(recordingBlob);
      const thumbnailUrl = loadVideoSession()?.thumbnailUrl;
      const sessionId = await createPracticeSession(user.id, videoId, videoSource, videoTitle, traceTimeSeconds, thumbnailUrl);
      storeRecordingSession({ blobUrl: recBlobUrl, poseFrames, refPoseFrames, sessionId });
      onComplete(sessionId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }, [user, videoId, videoSource, videoTitle, traceTimeSeconds, recordingBlob, poseFrames, refPoseFrames, saving, onComplete]);

  const handleReRecord = useCallback(() => {
    setRecordingBlob(null);
    setPoseFrames([]);
    setRefPoseFrames([]);
    setElapsedSec(0);
    setSaveError(null);
    calibAppliedRef.current = false;
    setTestState("framing");
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Preview state
  // ─────────────────────────────────────────────────────────────────
  if (testState === "preview") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative h-[calc(100vh-3rem)] w-full overflow-hidden bg-black"
      >
        {blobUrl && (
          <video
            src={blobUrl}
            controls
            autoPlay
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Floating header badge */}
        <div className="absolute left-4 top-4 z-10 rounded-xl bg-black/50 px-4 py-2.5 backdrop-blur-xl border border-white/[0.06]">
          <h2 className="text-sm font-bold text-white">Recording Complete!</h2>
          <p className="mt-0.5 text-[11px] text-white/40">Review your take, then analyze.</p>
        </div>

        {saveError && (
          <div className="absolute left-4 right-4 top-20 z-10">
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-400 backdrop-blur-xl border border-red-500/20">{saveError}</p>
          </div>
        )}

        {/* Floating action bar */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <button onClick={handleReRecord} disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 backdrop-blur-xl border border-white/[0.06] transition-all hover:bg-white/20 disabled:opacity-40">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            Re-record
          </button>
          <button onClick={handleAnalyze} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500/90 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-xl border border-white/[0.06] transition-all hover:bg-indigo-500 disabled:opacity-60">
            {saving ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />Saving…</>
            ) : (
              <>Analyze<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg></>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Framing / Countdown / Recording — immersive overlay structure
  // ─────────────────────────────────────────────────────────────────
  const isCountdown = testState === "countdown";
  const isRecording = testState === "recording";
  const isGo        = countdownNum === 0;

  return (
    <div className="relative h-[calc(100vh-3rem)] w-full overflow-hidden bg-black">

      {/* Webcam base — fills entire container */}
      <div className="absolute inset-0">
        {webcamError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-white/40">{webcamError}</p>
          </div>
        ) : (
          <video
            ref={webcamRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            playsInline muted autoPlay
          />
        )}

        {/* Reference overlay canvas — hidden during recording so user sees only themselves */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            opacity:     testState === "recording" ? 0 : overlayOpacity / 100,
            cursor:      testState === "framing" ? (isDragging ? "grabbing" : "grab") : "default",
            touchAction: "none",
          }}
          onPointerDown={handleCanvasPointerDown}
        />
      </div>

      {/* Countdown dim + number */}
      {isCountdown && (
        <>
          <div className="absolute inset-0 z-10 bg-black/50" />
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={countdownNum}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`select-none font-bold ${
                  isGo ? "text-6xl text-green-400 drop-shadow-lg"
                       : "text-[120px] leading-none text-white drop-shadow-2xl"
                }`}
              >
                {isGo ? "GO!" : countdownNum}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Recording HUD */}
      {isRecording && (
        <>
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl bg-black/50 px-3 py-1.5 backdrop-blur-xl border border-white/[0.06]">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-white">Recording</span>
            <span className="font-mono text-xs text-white/50">
              {fmt(elapsedSec)} / {fmt(refDurationRef.current)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
            <button
              onClick={() => stopTriggerRef.current?.()}
              className="flex items-center gap-2 rounded-xl bg-black/50 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl border border-white/[0.06] transition-all hover:bg-white/20"
            >
              <div className="h-3 w-3 rounded-sm bg-white" />
              Stop Recording
            </button>
          </div>
        </>
      )}

      {/* PREVIEW badge (framing) */}
      {testState === "framing" && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-xl border border-white/[0.06]">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <span className="text-[10px] font-semibold tracking-wide text-white/70">PREVIEW</span>
        </div>
      )}

      {/* Framing instruction — floating badge top-left */}
      {testState === "framing" && (
        <div className="absolute left-3 top-11 z-20 max-w-xs rounded-xl bg-black/50 px-3.5 py-2 backdrop-blur-xl border border-white/[0.06]">
          <h2 className="text-xs font-bold text-white">Position yourself</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-white/40">
            Drag the reference overlay to align with your body. Scrub to your starting frame, then press &ldquo;I&apos;m Ready&rdquo;.
          </p>
        </div>
      )}

      {/* Webcam loading */}
      {!webcamReady && !webcamError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
        </div>
      )}

      {/* Reference video — visually hidden but NOT display:none so audio plays */}
      <video
        ref={proVideoRef}
        src={videoUrl}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        onLoadedMetadata={e => {
          const v = e.currentTarget;
          refDurationRef.current = v.duration;
          setRefDuration(v.duration);
        }}
      />

      {/* Framing controls — floating glassmorphic bar at bottom */}
      {testState === "framing" && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3">
          <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/[0.06] px-5 py-4">

            {/* Opacity + mirror */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-white/30">Opacity</span>
                <input type="range" min="10" max="90" value={overlayOpacity}
                  onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                  className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-indigo-500" />
                <span className="w-7 text-[10px] tabular-nums text-white/20">{overlayOpacity}%</span>
              </div>
              <button onClick={() => setMirrored(m => !m)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  mirrored ? "bg-indigo-500/20 text-indigo-400" : "bg-white/[0.04] text-white/30 hover:bg-white/[0.08]"
                }`}>
                Mirror {mirrored ? "On" : "Off"}
              </button>
            </div>

            {/* Fine-tune framing (collapsible) */}
            <div className="mt-3 border-t border-white/[0.06]">
              <button onClick={() => setFramingExpanded(x => !x)}
                className="mt-2 flex w-full items-center gap-1.5 text-[10px] font-semibold text-white/30 transition-colors hover:text-white/50">
                <svg className={`h-3 w-3 transition-transform ${framingExpanded ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Fine-tune framing
              </button>
              {framingExpanded && (
                <div className="mt-2 flex flex-col gap-2">
                  <SliderRow label="X offset" min={-300} max={300} step={1}
                    value={proOffsetX} onChange={v => setProOffsetX(Math.round(v))}
                    display={`${proOffsetX > 0 ? "+" : ""}${proOffsetX}px`} />
                  <SliderRow label="Y offset" min={-300} max={300} step={1}
                    value={proOffsetY} onChange={v => setProOffsetY(Math.round(v))}
                    display={`${proOffsetY > 0 ? "+" : ""}${proOffsetY}px`} />
                  <SliderRow label="Zoom" min={0.3} max={3.0} step={0.05}
                    value={proZoom} onChange={setProZoom}
                    display={`${proZoom.toFixed(2)}×`} />
                  <button onClick={() => { setProOffsetX(0); setProOffsetY(0); setProZoom(1.0); }}
                    className="self-start rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/30 hover:bg-white/[0.08]">
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Start frame scrubber */}
            <div className="mt-3 flex items-center gap-3 border-t border-white/[0.06] pt-3">
              <span className="text-[10px] font-medium text-white/40">Start frame</span>
              <input type="range" min={0} max={refDuration || 1} step={0.033} value={refTime}
                onChange={e => {
                  const t = parseFloat(e.target.value);
                  setRefTime(t);
                  if (proVideoRef.current) proVideoRef.current.currentTime = t;
                }}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-indigo-500" />
              <span className="w-10 text-right font-mono text-[10px] text-white/30">{fmt(refTime)}</span>
            </div>

            {/* Ready button */}
            <div className="mt-4 flex justify-end">
              <button onClick={() => {
                // Warm up audio inside user gesture so browser allows future play() calls
                proVideoRef.current?.play().then(() => proVideoRef.current?.pause()).catch(() => {});
                setTestState("countdown");
              }} disabled={!webcamReady}
                className="flex items-center gap-2 rounded-xl bg-indigo-500/90 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
                I&apos;m Ready
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slider helper ───────────────────────────────────────────────────────

function SliderRow({
  label, min, max, step, value, onChange, display,
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[10px] font-medium text-white/30">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-indigo-500" />
      <span className="w-12 text-[10px] tabular-nums text-white/20">{display}</span>
    </div>
  );
}
