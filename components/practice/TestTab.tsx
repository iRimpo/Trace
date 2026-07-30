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
import { TOP_STACK, BOTTOM_SAFE } from "@/components/practice/chrome";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import TogglePill from "@/components/ui/TogglePill";

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

/*
 * Ground: the stage, same as `TraceTab` — see `docs/DESIGN_SYSTEM.md` §1. This
 * tab was still black glass with 10px labels and an indigo accent that belongs
 * to no token. `Panel tone="stage"` carries the fill, the blur and the shadow;
 * `text-hud` is the 12px floor for anything read from dancing distance.
 */

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
        className="relative h-full w-full overflow-hidden bg-black"
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

        {/* Floating header badge. TOP_STACK owns the offset — see §5 of the
            design contract; this used to be a bare `top-3`. */}
        <div className="absolute left-3 right-3 z-10 sm:right-auto sm:max-w-sm" style={{ top: TOP_STACK }}>
          <Panel tone="stage" className="px-4 py-3">
            <h2 className="text-hud-lg font-extrabold text-stage-text">Take recorded</h2>
            <p className="mt-1 text-hud font-bold text-stage-text/70">Watch it back, then analyse.</p>
          </Panel>
        </div>

        {saveError && (
          /* Sits below the "Take recorded" badge, which is anchored to
             TOP_STACK — the +4.5rem keeps the badge/banner relationship. */
          <div className="absolute left-3 right-3 z-10" style={{ top: `calc(${TOP_STACK} + 4.5rem)` }}>
            <p className="rounded-xl border border-duo-red/40 bg-duo-red/20 px-3.5 py-2.5 text-hud font-bold text-stage-text backdrop-blur-xl">
              {saveError}
            </p>
          </div>
        )}

        {/* Floating action bar. One green "go" per screen — Analyse is it. */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent p-3"
          style={{ paddingBottom: `calc(0.75rem + ${BOTTOM_SAFE})` }}
        >
          <Pressable variant="stage" size="md" onClick={handleReRecord} disabled={saving}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            Re-record
          </Pressable>
          <Pressable variant="primary" size="lg" onClick={handleAnalyze} disabled={saving} className="flex-1">
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-white/30 border-t-white" />
                Saving…
              </>
            ) : (
              <>
                Analyse my run
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </Pressable>
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

  // "How much time is left" is the second thing the HUD has to answer, so it is
  // computed rather than left for the dancer to subtract from a `x / y` pair
  // across the room.
  const recTotal     = refDurationRef.current;
  const recRemaining = recTotal > 0 ? Math.max(0, Math.ceil(recTotal - elapsedSec)) : null;
  const recPct       = recTotal > 0 ? Math.min(100, (elapsedSec / recTotal) * 100) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">

      {/* Webcam base — fills entire container */}
      <div className="absolute inset-0">
        {webcamError ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <p className="hud-text text-hud-lg font-bold text-stage-text/80">{webcamError}</p>
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
            {/*
              A countdown has to land on its own beat. `mode="wait"` serialised
              a 300ms exit before a 300ms enter, so each digit finished
              appearing ~600ms after the setTimeout that set it — and since the
              "GO!" timer and the start-recording timer both fire at 3000ms,
              recording began while GO was still animating in.

              Overlapping enter/exit and a short fade keep the digit on the
              beat. Scale is nearly neutral on entry too: the user is several
              feet away, and a digit that grows into place reads as "not yet"
              at exactly the moment it means "now".
            */}
            <AnimatePresence>
              <motion.div
                key={countdownNum}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.25 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className={`hud-text select-none font-black tabular-nums tracking-tight ${
                  isGo ? "text-7xl text-duo-green sm:text-8xl"
                       : "text-[9rem] leading-none text-stage-text sm:text-[11rem]"
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
          {/*
            You stand several feet back from a propped-up phone while recording,
            and the only "you are being recorded" signal was an 8px pulsing dot
            in a corner — unreadable from dancing distance. A full-bleed red
            edge glow reads instantly from across a room, and it costs no
            screen space because it lives in the margin the video letterboxes
            into anyway. Non-interactive, so it never eats a tap.

            `motion-reduce:animate-pulse`, not `animate-none`: the pulse is an
            opacity change, which is not a vestibular trigger, and an indicator
            that stops indicating is worse than one that pulses (contract §4.3).
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 animate-pulse motion-reduce:animate-pulse ring-[6px] ring-inset ring-duo-red"
          />

          {/*
            The two facts that matter while dancing, in the order you need them:
            *you are recording*, and *how long is left*. Both are now set at a
            size you can resolve from across a room instead of a 14px `0:04 /
            0:37` pair. `role="timer"` + `aria-live="off"` keeps a screen reader
            from announcing every tick.
          */}
          <div className="pointer-events-none absolute inset-x-3 z-20 flex justify-center" style={{ top: TOP_STACK }}>
            <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl bg-duo-red px-4 py-3 shadow-stage">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-pulse rounded-full bg-white" />
                  <span className="text-hud-lg font-black tracking-[0.18em] text-white">REC</span>
                </span>
                <span
                  role="timer"
                  aria-live="off"
                  className="font-mono text-4xl font-black leading-none tabular-nums text-white sm:text-5xl"
                >
                  {recRemaining !== null ? fmt(recRemaining) : fmt(elapsedSec)}
                </span>
                <span className="text-hud font-extrabold uppercase tracking-widest text-white/75">
                  {recRemaining !== null ? "left" : "elapsed"}
                </span>
              </div>
              {/* Elapsed share of the take — width is the only thing that moves,
                  and it is a static bar, not an animation. */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white" style={{ width: `${recPct}%` }} />
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 z-20 flex justify-center px-3" style={{ bottom: `calc(1rem + ${BOTTOM_SAFE})` }}>
            <Pressable variant="danger" size="lg" onClick={() => stopTriggerRef.current?.()}>
              <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
              Stop recording
            </Pressable>
          </div>
        </>
      )}

      {/* PREVIEW badge + framing instruction (framing).
          Both anchored off TOP_STACK; the +2.5rem preserves the badge → card
          gap. Never a hardcoded `top-*` — see docs/HANDOFF.md §4. */}
      {testState === "framing" && (
        <div className="absolute left-3 z-20 flex items-center gap-1.5 rounded-full bg-duo-blue px-3 py-1.5 shadow-stage" style={{ top: TOP_STACK }}>
          <span className="h-2 w-2 rounded-full bg-white" />
          <span className="text-hud font-extrabold tracking-widest text-white">NOT RECORDING</span>
        </div>
      )}

      {testState === "framing" && (
        <div className="absolute left-3 right-3 z-20 sm:right-auto sm:max-w-xs" style={{ top: `calc(${TOP_STACK} + 2.5rem)` }}>
          <Panel tone="stage" className="px-4 py-3">
            <h2 className="text-hud-lg font-extrabold text-stage-text">Position yourself</h2>
            <p className="mt-1 text-hud font-bold leading-relaxed text-stage-text/70">
              Drag the ghost until it lands on your body, scrub to your starting frame, then hit Start recording.
            </p>
          </Panel>
        </div>
      )}

      {/* Webcam loading */}
      {!webcamReady && !webcamError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="h-8 w-8 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-white/10 border-t-white/50" />
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

      {/* Framing controls — floating stage panel at the bottom edge */}
      {testState === "framing" && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 px-2 pt-2"
          style={{ paddingBottom: BOTTOM_SAFE }}
        >
          <Panel tone="stage" radius="2xl" className="px-3 py-3 sm:px-4">

            {/*
              One scrolling row rather than `flex-wrap`. The full set needs more
              width than a 320px phone has, and wrapping made the panel's height
              change as controls appeared, shoving the Start button around under
              the thumb. Same fix as TraceTab's transport row.
            */}
            <div className="scrollbar-hide -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
              <TogglePill active={mirrored} onClick={() => setMirrored(m => !m)} accent="blue" tone="stage">
                Mirror {mirrored ? "on" : "off"}
              </TogglePill>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-hud font-bold text-stage-text/70">Ghost</span>
                <input type="range" min="10" max="90" value={overlayOpacity}
                  onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                  aria-label="Reference overlay opacity"
                  className="slider slider-stage w-24" />
                <span className="w-10 text-right text-hud tabular-nums text-stage-text/70">{overlayOpacity}%</span>
              </div>

              <TogglePill
                active={framingExpanded}
                onClick={() => setFramingExpanded(x => !x)}
                accent="violet"
                tone="stage"
                icon={
                  <svg className={`h-3.5 w-3.5 transition-transform duration-150 ease-out-strong motion-reduce:transition-none ${framingExpanded ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                }
              >
                Fine-tune
              </TogglePill>
            </div>

            {/* Fine-tune framing (collapsible) */}
            <AnimatePresence initial={false}>
              {framingExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-white/[0.07] p-3">
                    <SliderRow label="X offset" min={-300} max={300} step={1}
                      value={proOffsetX} onChange={v => setProOffsetX(Math.round(v))}
                      display={`${proOffsetX > 0 ? "+" : ""}${proOffsetX}px`} />
                    <SliderRow label="Y offset" min={-300} max={300} step={1}
                      value={proOffsetY} onChange={v => setProOffsetY(Math.round(v))}
                      display={`${proOffsetY > 0 ? "+" : ""}${proOffsetY}px`} />
                    <SliderRow label="Zoom" min={0.3} max={3.0} step={0.05}
                      value={proZoom} onChange={setProZoom}
                      display={`${proZoom.toFixed(2)}×`} />
                    <Pressable
                      variant="stage"
                      size="sm"
                      className="mt-1 self-start"
                      onClick={() => { setProOffsetX(0); setProOffsetY(0); setProZoom(1.0); }}
                    >
                      Reset framing
                    </Pressable>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start frame scrubber */}
            <div className="mt-2 flex items-center gap-3 border-t border-white/10 pt-3">
              <span className="shrink-0 text-hud font-bold text-stage-text/70">Start at</span>
              <input type="range" min={0} max={refDuration || 1} step={0.033} value={refTime}
                onChange={e => {
                  const t = parseFloat(e.target.value);
                  setRefTime(t);
                  if (proVideoRef.current) proVideoRef.current.currentTime = t;
                }}
                aria-label="Reference start frame"
                className="slider slider-stage flex-1" />
              <span className="w-11 shrink-0 text-right font-mono text-hud tabular-nums text-stage-text/80">{fmt(refTime)}</span>
            </div>

            {/* The one green "go" on this screen. Full width — it is the only
                thing you reach for from across the room. */}
            <Pressable
              block
              variant="primary"
              size="lg"
              className="mt-3"
              disabled={!webcamReady}
              onClick={() => {
                // Warm up audio inside user gesture so browser allows future play() calls
                proVideoRef.current?.play().then(() => proVideoRef.current?.pause()).catch(() => {});
                setTestState("countdown");
              }}
            >
              {webcamReady ? "Start recording" : "Waiting for camera…"}
              {webcamReady && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              )}
            </Pressable>
          </Panel>
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
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 text-hud font-bold text-stage-text/70">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="slider slider-stage min-w-0 flex-1" />
      <span className="w-14 shrink-0 text-right text-hud tabular-nums text-stage-text/70">{display}</span>
    </div>
  );
}
