"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { initPoseDetection, detectPose, detectAllPosesFromFrame, smoothKeypoints } from "@/lib/mediapipe";
import type { Keypoint } from "@/lib/mediapipe";
import { extractFaceThumbnail } from "@/lib/faceExtraction";

// ── BlazePose indices ────────────────────────────────────────────────────────
const NOSE = 0;
const L_EAR = 7, R_EAR = 8;
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW = 13, R_ELBOW = 14;
const L_WRIST = 15, R_WRIST = 16;
const L_HIP = 23, R_HIP = 24;

const PALM_HOLD_MS = 1500;

const SKELETON_EDGES = [
  [L_SHOULDER, R_SHOULDER],
  [L_SHOULDER, L_ELBOW], [L_ELBOW, L_WRIST],
  [R_SHOULDER, R_ELBOW], [R_ELBOW, R_WRIST],
  [L_SHOULDER, L_HIP], [R_SHOULDER, R_HIP],
  [L_HIP, R_HIP],
  [NOSE, L_EAR], [NOSE, R_EAR],
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationData {
  zoom:          number;
  offsetXNorm:   number;
  offsetYNorm:   number;
  trimStart?:    number;
  trimEnd?:      number;
  personCenter?: { x: number; y: number }; // normalized 0-1 hip center of selected person
  solo?:         boolean; // if true, skip multi-dancer tracking
}

interface CalibrationModalProps {
  videoUrl:     string;
  onCalibrated: (data: CalibrationData) => void;
  onSkip:       () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPalmRaised(kps: Keypoint[], videoH: number): boolean {
  const nose   = kps[NOSE];
  const lWrist = kps[L_WRIST];
  const rWrist = kps[R_WRIST];
  if (!nose || (nose.score ?? 0) < 0.4) return false;
  const noseY   = nose.y / videoH;
  const leftUp  = lWrist  && (lWrist.score  ?? 0) > 0.5 && lWrist.y  / videoH < noseY;
  const rightUp = rWrist  && (rWrist.score  ?? 0) > 0.5 && rWrist.y  / videoH < noseY;
  return !!(leftUp || rightUp);
}

interface TorsoStats { centerX: number; centerY: number; lengthNorm: number; }

function torsoStats(kps: Keypoint[], vW: number, vH: number): TorsoStats | null {
  const ls = kps[L_SHOULDER], rs = kps[R_SHOULDER];
  if (!ls || !rs || (ls.score ?? 0) < 0.25 || (rs.score ?? 0) < 0.25) return null;
  const shoulderMidX = (ls.x + rs.x) / 2 / vW;
  const shoulderMidY = (ls.y + rs.y) / 2 / vH;
  const lh = kps[L_HIP], rh = kps[R_HIP];
  const hipsOk = lh && rh && (lh.score ?? 0) > 0.2 && (rh.score ?? 0) > 0.2;
  if (hipsOk) {
    const hipMidX = (lh!.x + rh!.x) / 2 / vW;
    const hipMidY = (lh!.y + rh!.y) / 2 / vH;
    return { centerX: (shoulderMidX + hipMidX) / 2, centerY: (shoulderMidY + hipMidY) / 2, lengthNorm: Math.abs(hipMidY - shoulderMidY) };
  }
  const shoulderWidthNorm = Math.abs(ls.x - rs.x) / vW;
  const estimatedLength   = shoulderWidthNorm / 1.1;
  return { centerX: shoulderMidX, centerY: shoulderMidY + estimatedLength * 0.35, lengthNorm: estimatedLength };
}

function drawRefFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cW: number, cH: number, opacity: number) {
  const pvW = video.videoWidth, pvH = video.videoHeight;
  if (!pvW || !pvH) return;
  const vAspect = pvW / pvH, cAspect = cW / cH;
  let fitW: number, fitH: number;
  if (vAspect > cAspect) { fitW = cW; fitH = cW / vAspect; }
  else                   { fitH = cH; fitW = cH * vAspect; }
  const x = (cW - fitW) / 2, y = (cH - fitH) / 2;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cW, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, cW - x - fitW, y, fitW, fitH);
  ctx.restore();
}

function drawSkeleton(ctx: CanvasRenderingContext2D, kps: Keypoint[], cW: number, cH: number, vW: number, vH: number, palmRaised: boolean) {
  const px = (kp: Keypoint) => (1 - kp.x / vW) * cW;
  const py = (kp: Keypoint) => (kp.y / vH) * cH;
  const accent = palmRaised ? "#10B981" : "#60A5FA";
  ctx.save();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.75;
  for (const [a, b] of SKELETON_EDGES) {
    const ka = kps[a], kb = kps[b];
    if (!ka || !kb || (ka.score ?? 0) < 0.3 || (kb.score ?? 0) < 0.3) continue;
    ctx.beginPath(); ctx.moveTo(px(ka), py(ka)); ctx.lineTo(px(kb), py(kb)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const kp of kps) {
    if (!kp || (kp.score ?? 0) < 0.3) continue;
    ctx.beginPath(); ctx.arc(px(kp), py(kp), 3, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
  }
  ctx.restore();
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────────

type FrameState = "loading" | "ready" | "palm" | "calibrating" | "done";
type CalibStep  = "frame" | "trim" | "mode" | "dancer";

export default function CalibrationModal({ videoUrl, onCalibrated, onSkip }: CalibrationModalProps) {
  const webcamRef    = useRef<HTMLVideoElement>(null);
  const refVideoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const prevKpsRef   = useRef<Keypoint[] | null>(null);
  const palmStartRef = useRef<number | null>(null);

  // ── Frame step state ──
  const [frameState,     setFrameState]     = useState<FrameState>("loading");
  const [webcamReady,    setWebcamReady]     = useState(false);
  const [refReady,       setRefReady]        = useState(false);
  const [poseReady,      setPoseReady]       = useState(false);
  const [poseLoading,    setPoseLoading]     = useState(true);
  const [palmProgress,   setPalmProgress]    = useState(0);
  const [bodyDetected,   setBodyDetected]    = useState(false);
  const [overlayOpacity, setOverlayOpacity]  = useState(40);

  // ── Step & pending calibration ──
  const [calibStep,    setCalibStep]    = useState<CalibStep>("frame");
  const [pendingFrame, setPendingFrame] = useState<Omit<CalibrationData, "trimStart" | "trimEnd">>({ zoom: 1, offsetXNorm: 0, offsetYNorm: 0 });
  const pendingFrameRef = useRef(pendingFrame);
  pendingFrameRef.current = pendingFrame;

  // ── Trim step state ──
  const [trimDuration, setTrimDuration] = useState(0);
  const [trimStart,    setTrimStart]    = useState(0);
  const [trimEnd,      setTrimEnd]      = useState(0);
  const [trimTime,     setTrimTime]     = useState(0);
  const [trimPlaying,  setTrimPlaying]  = useState(false);

  // ── Person selection state ──
  const personCanvasRef = useRef<HTMLCanvasElement>(null);
  const [persons, setPersons] = useState<{ x: number; y: number }[]>([]);
  const [faceThumbnails, setFaceThumbnails] = useState<(string | null)[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<number>(0);

  // ── Dancer step state ──
  const [personsLoading, setPersonsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0); // 0-1

  // ── Refs for stable values in event handlers ──
  const trimDragRef         = useRef<"start" | "end" | null>(null);
  const trimStartRef        = useRef(0);
  const trimEndRef          = useRef(0);
  const trimDurationRef     = useRef(0);

  // Sync refs with current state (runs every render, always up-to-date in handlers)
  trimStartRef.current    = trimStart;
  trimEndRef.current      = trimEnd;
  trimDurationRef.current = trimDuration;

  // ── Init webcam ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.play().then(() => { if (!cancelled) setWebcamReady(true); });
        }
      })
      .catch(() => { if (!cancelled) setWebcamReady(true); });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Init pose detection ───────────────────────────────────────────────────
  useEffect(() => {
    setPoseLoading(true);
    initPoseDetection().then(() => { setPoseReady(true); setPoseLoading(false); });
  }, []);

  // ── Reference video ready ─────────────────────────────────────────────────
  useEffect(() => {
    const v = refVideoRef.current;
    if (!v) return;
    if (v.readyState >= 2) { setRefReady(true); return; }
    const onLoaded = () => setRefReady(true);
    v.addEventListener("loadeddata", onLoaded);
    return () => v.removeEventListener("loadeddata", onLoaded);
  }, []);

  useEffect(() => {
    if (webcamReady && refReady && poseReady) setFrameState("ready");
  }, [webcamReady, refReady, poseReady]);

  // ── Extract normalized hip/shoulder centres from a pose result ───────────
  function extractCenters(kpss: Keypoint[][], vW: number, vH: number): { x: number; y: number }[] {
    return kpss.map(kps => {
      const lh = kps[23], rh = kps[24], ls = kps[11], rs = kps[12];
      const hipsOk = lh && rh && (lh.score ?? 0) > 0.2 && (rh.score ?? 0) > 0.2;
      const ax = hipsOk ? (lh!.x + rh!.x) / 2 : ((ls?.x ?? 0) + (rs?.x ?? 0)) / 2;
      const ay = hipsOk ? (lh!.y + rh!.y) / 2 : ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
      return { x: ax / vW, y: ay / vH };
    });
  }

  // ── Transition to trim step ───────────────────────────────────────────────
  function goToTrim(frameData: Omit<CalibrationData, "trimStart" | "trimEnd">) {
    setPendingFrame(frameData);
    const v = refVideoRef.current;
    if (v) {
      v.currentTime = 0;
      const dur = isFinite(v.duration) ? v.duration : 0;
      setTrimDuration(dur);
      setTrimStart(0);
      setTrimEnd(dur);
      setTrimTime(0);
    }
    setPersons([]);
    setFaceThumbnails([]);
    setCalibStep("trim");
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  // ── Calibration math ──────────────────────────────────────────────────────
  const triggerCalibration = useCallback((userKps: Keypoint[], cW: number, cH: number) => {
    setFrameState("calibrating");
    const webcam   = webcamRef.current;
    const refVideo = refVideoRef.current;
    if (!webcam || !refVideo) { goToTrim({ zoom: 1, offsetXNorm: 0, offsetYNorm: 0 }); return; }

    const refKps = detectPose(refVideo);
    const wW = webcam.videoWidth || 640, wH = webcam.videoHeight || 480;
    const uStats = torsoStats(userKps, wW, wH);
    const rStats = refKps ? torsoStats(refKps, refVideo.videoWidth, refVideo.videoHeight) : null;

    if (!uStats || !rStats) {
      setTimeout(() => {
        setFrameState("done");
        setTimeout(() => goToTrim({ zoom: 1, offsetXNorm: 0, offsetYNorm: 0 }), 600);
      }, 300);
      return;
    }

    const scale   = Math.max(cW / wW, cH / wH);
    const cropX   = (wW * scale - cW) / 2, cropY = (wH * scale - cH) / 2;
    const uCanvasX = cW - (uStats.centerX * wW * scale - cropX);
    const uCanvasY = uStats.centerY * wH * scale - cropY;
    const uTorsoPx = uStats.lengthNorm * wH * scale;

    const rVAspect = refVideo.videoWidth / refVideo.videoHeight, cAspect = cW / cH;
    let fitW: number, fitH: number;
    if (rVAspect > cAspect) { fitW = cW; fitH = cW / rVAspect; }
    else                    { fitH = cH; fitW = cH * rVAspect; }

    const rTorsoPx = rStats.lengthNorm * fitH;
    const zoom     = rTorsoPx > 0 ? Math.max(0.3, Math.min(3.0, uTorsoPx / rTorsoPx)) : 1;
    const fitWZ    = fitW * zoom, fitHZ = fitH * zoom;
    const rCanvasX = (cW - fitWZ) / 2 + (1 - rStats.centerX) * fitWZ;
    const rCanvasY = (cH - fitHZ) / 2 + rStats.centerY * fitHZ;

    const frameData: Omit<CalibrationData, "trimStart" | "trimEnd"> = {
      zoom,
      offsetXNorm: (uCanvasX - rCanvasX) / cW,
      offsetYNorm: (uCanvasY - rCanvasY) / cH,
    };

    setTimeout(() => {
      setFrameState("done");
      setTimeout(() => goToTrim(frameData), 700);
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Frame rAF loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (calibStep !== "frame") return;
    if (frameState !== "ready" && frameState !== "palm") return;
    let raf: number;
    let lastKps: Keypoint[] | null = null;

    function frame() {
      const canvas = canvasRef.current, webcam = webcamRef.current, refVideo = refVideoRef.current;
      if (!canvas) { raf = requestAnimationFrame(frame); return; }
      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.offsetWidth, h = parent.offsetHeight;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      }
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (refVideo && refVideo.readyState >= 2) drawRefFrame(ctx, refVideo, canvas.width, canvas.height, overlayOpacity / 100);
      if (webcam && poseReady && webcam.readyState >= 2) {
        const raw = detectPose(webcam);
        if (raw) {
          const kps = smoothKeypoints(prevKpsRef.current, raw);
          prevKpsRef.current = kps; lastKps = kps;
          const raised = isPalmRaised(kps, webcam.videoHeight || 480);
          setBodyDetected(true);
          drawSkeleton(ctx, kps, canvas.width, canvas.height, webcam.videoWidth || 640, webcam.videoHeight || 480, raised);
          if (raised) {
            if (palmStartRef.current === null) palmStartRef.current = performance.now();
            const elapsed  = performance.now() - palmStartRef.current;
            const progress = Math.min(1, elapsed / PALM_HOLD_MS);
            setPalmProgress(progress);
            if (frameState !== "palm") setFrameState("palm");
            if (elapsed >= PALM_HOLD_MS) { cancelAnimationFrame(raf); triggerCalibration(kps, canvas.width, canvas.height); return; }
          } else {
            palmStartRef.current = null; setPalmProgress(0);
            if (frameState === "palm") setFrameState("ready");
          }
        } else {
          if (lastKps === null) setBodyDetected(false);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [calibStep, frameState, poseReady, overlayOpacity, triggerCalibration]);

  // ── Multi-frame person scan on dancer step entry ──────────────────────────
  // Samples TARGET_SAMPLE_FRAMES evenly across the trim range, clustering
  // detected person centres so briefly-occluded people are still discovered.
  // Much faster than a per-frame scan: a 3-min clip scans in ~5s.
  useEffect(() => {
    if (calibStep !== "dancer" || !personsLoading) return;
    const v = refVideoRef.current;
    if (!v) { setPersonsLoading(false); return; }

    let cancelled = false;

    async function waitForVideo(): Promise<void> {
      if (v!.readyState >= 2) return;
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 2000);
        v!.addEventListener("loadeddata", () => { clearTimeout(timeout); resolve(); }, { once: true });
      });
    }

    async function seekAndSettle(t: number): Promise<void> {
      if (Math.abs(v!.currentTime - t) < 0.05 && v!.readyState >= 2) return;
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 1000);
        v!.addEventListener("seeked", () => { clearTimeout(timeout); resolve(); }, { once: true });
        v!.currentTime = t;
      });
      await new Promise(r => setTimeout(r, 120)); // let GPU decode the frame
    }

    async function runScan() {
      v!.pause();
      await waitForVideo();
      if (cancelled) return;

      const start = trimStartRef.current;
      const end   = trimEndRef.current;
      const span  = end - start;

      // Sample 30 frames spread evenly across the trim range.
      // Each sample is positioned at the midpoint of its interval so we
      // avoid the very start/end (often black frames or hard cuts).
      const TARGET_FRAMES = 30;
      const step = span / TARGET_FRAMES;
      const sampleTimes = Array.from({ length: TARGET_FRAMES }, (_, i) => start + (i + 0.5) * step);
      const totalFrames = sampleTimes.length;

      // Track unique person centers seen across all frames.
      // We merge a new detection into an existing cluster if its
      // normalised hip-centre is within 0.12 units of the cluster centre.
      const MERGE_DIST = 0.12;
      const clusters: { x: number; y: number; count: number; thumbnail: string | null; bestNoseScore: number }[] = [];

      let frameIdx = 0;
      for (const t of sampleTimes) {
        if (cancelled) return;

        await seekAndSettle(t);
        if (cancelled) return;

        const kpss = detectAllPosesFromFrame(v!);
        console.log(`[CalibModal] frame ${frameIdx + 1}/${totalFrames} @ ${t.toFixed(2)}s → ${kpss?.length ?? 0} pose(s)`);
        if (kpss && kpss.length > 0) {
          const centers = extractCenters(kpss, v!.videoWidth, v!.videoHeight);
          for (let ki = 0; ki < centers.length; ki++) {
            const c         = centers[ki];
            const kps       = kpss[ki];
            const noseScore = kps[NOSE]?.score ?? 0;
            // Find nearest cluster
            let best = -1, bestD = Infinity;
            for (let i = 0; i < clusters.length; i++) {
              const d = (clusters[i].x - c.x) ** 2 + (clusters[i].y - c.y) ** 2;
              if (d < bestD) { bestD = d; best = i; }
            }
            if (best >= 0 && bestD < MERGE_DIST ** 2) {
              // Merge into existing cluster (running average)
              const cl = clusters[best];
              const n  = cl.count + 1;
              cl.x = (cl.x * cl.count + c.x) / n;
              cl.y = (cl.y * cl.count + c.y) / n;
              cl.count = n;
              // Update thumbnail if this frame has better face visibility
              if (noseScore > cl.bestNoseScore) {
                const thumb = extractFaceThumbnail(v!, kps, 120);
                if (thumb) { cl.thumbnail = thumb; cl.bestNoseScore = noseScore; }
              }
            } else {
              const thumb = extractFaceThumbnail(v!, kps, 120);
              clusters.push({ ...c, count: 1, thumbnail: thumb, bestNoseScore: noseScore });
            }
          }
        }

        frameIdx++;
        setScanProgress(frameIdx / totalFrames);
      }

      // Sort by horizontal position (left → right) for consistent labelling
      const sortedClusters = clusters.sort((a, b) => a.x - b.x);
      const centers        = sortedClusters.map(({ x, y }) => ({ x, y }));
      const thumbnails     = sortedClusters.map(cl => cl.thumbnail);

      console.log(`[CalibModal] scan complete — ${clusters.length} cluster(s):`, clusters);
      console.log(`[CalibModal] setPersons →`, centers);

      // Leave the video sitting on trimStart for the dancer circles overlay
      if (Math.abs(v!.currentTime - start) > 0.05) {
        await seekAndSettle(start);
      }
      if (cancelled) return;

      setPersons(centers);
      setFaceThumbnails(thumbnails);
      setSelectedPerson(0);
      setScanProgress(1);
      setPersonsLoading(false);
    }

    runScan();
    return () => { cancelled = true; };
  // extractCenters is stable (defined in render body, same reference each render
  // since it has no captures from state/props). trimStartRef/trimEndRef are refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibStep, personsLoading]);

  // ── Draw person selection overlay ────────────────────────────────────────
  useEffect(() => {
    const canvas = personCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) { canvas.width = parent.offsetWidth; canvas.height = parent.offsetHeight; }
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (persons.length === 0) return;

    const COLORS = ["#00D4FF", "#34D399", "#FBBF24", "#F472B6"];
    persons.forEach(({ x, y }, i) => {
      const cx = x * canvas.width, cy = y * canvas.height;
      const isSelected = i === selectedPerson;
      const c = COLORS[i % COLORS.length];
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 22 : 18, 0, Math.PI * 2);
      ctx.strokeStyle = c;
      ctx.lineWidth   = isSelected ? 3 : 1.5;
      ctx.globalAlpha = isSelected ? 0.9 : 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.globalAlpha = isSelected ? 0.3 : 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle   = "#ffffff";
      ctx.font        = `bold ${isSelected ? 13 : 11}px system-ui`;
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cx, cy);
    });
  }, [persons, selectedPerson]);

  // ── Trim playback ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (calibStep !== "trim") return;
    const v = refVideoRef.current;
    if (!v) return;
    const onTime = () => {
      setTrimTime(v.currentTime);
      if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimEnd; setTrimPlaying(false); }
    };
    const onEnded = () => setTrimPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnded); };
  }, [calibStep, trimEnd]);

  // ── Dancer video ended ────────────────────────────────────────────────────
  useEffect(() => {
    if (calibStep !== "dancer") return;
    const v = refVideoRef.current;
    if (!v) return;
    const onEnded = () => setTrimPlaying(false);
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [calibStep]);

  function toggleTrimPlay() {
    const v = refVideoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime >= trimEnd || v.currentTime < trimStart) v.currentTime = trimStart;
      v.play(); setTrimPlaying(true);
    } else {
      v.pause(); setTrimPlaying(false);
    }
  }

  function handlePersonCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = personCanvasRef.current;
    if (!canvas || persons.length <= 1 || personsLoading) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top)  / rect.height;
    let closest = 0, bestDist = Infinity;
    persons.forEach(({ x, y }, i) => {
      const d = (x - mx) ** 2 + (y - my) ** 2;
      if (d < bestDist) { bestDist = d; closest = i; }
    });
    setSelectedPerson(closest);
  }

  // ── Transition to mode step (trim → solo/group choice) ───────────────────
  function goToMode() {
    const v = refVideoRef.current;
    if (v) { v.pause(); v.currentTime = trimStart; }
    setTrimPlaying(false);
    setCalibStep("mode");
  }

  // ── Transition to dancer step (mode → group → scan) ──────────────────────
  function goToDancer() {
    const v = refVideoRef.current;
    if (v) {
      v.pause();
      // Seek the trim video to trimStart now, so:
      // 1. The exit animation shows the trimStart frame (visual continuity)
      // 2. If runScan ends up running on this element (AnimatePresence timing),
      //    it's already at the right position
      v.currentTime = trimStart;
    }
    setTrimPlaying(false);
    setPersons([]);
    setScanProgress(0);
    setPersonsLoading(true);
    setCalibStep("dancer");
  }

  // ── Complete calibration ──────────────────────────────────────────────────
  function handleStartFromDancer() {
    const personCenter = persons.length > 0 ? persons[selectedPerson] : undefined;
    onCalibrated({ ...pendingFrame, trimStart, trimEnd, personCenter, solo: persons.length <= 1 });
  }

  // ── Auto-advance when exactly 1 dancer is found ───────────────────────────
  useEffect(() => {
    if (calibStep !== "dancer" || personsLoading || persons.length !== 1) return;
    const timer = setTimeout(() => {
      onCalibrated({ ...pendingFrameRef.current, trimStart: trimStartRef.current, trimEnd: trimEndRef.current, personCenter: persons[0], solo: true });
    }, 800);
    return () => clearTimeout(timer);
  // onCalibrated is a stable prop; persons/personsLoading/calibStep cover re-entry
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibStep, personsLoading, persons]);

  // ── Timeline drag handlers ────────────────────────────────────────────────
  function handleTimelinePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (trimDurationRef.current <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct      = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const startPct = trimStartRef.current / trimDurationRef.current;
    const endPct   = trimEndRef.current   / trimDurationRef.current;
    const which: "start" | "end" = Math.abs(pct - startPct) <= Math.abs(pct - endPct) ? "start" : "end";
    trimDragRef.current = which;
    e.currentTarget.setPointerCapture(e.pointerId);

    const t = pct * trimDurationRef.current;
    const v = refVideoRef.current;
    if (which === "start") {
      const newStart = Math.max(0, Math.min(t, trimEndRef.current - 0.5));
      setTrimStart(newStart);
      trimStartRef.current = newStart;
      if (v) { v.pause(); v.currentTime = newStart; }
    } else {
      const newEnd = Math.min(trimDurationRef.current, Math.max(t, trimStartRef.current + 0.5));
      setTrimEnd(newEnd);
      trimEndRef.current = newEnd;
      if (v) { v.pause(); v.currentTime = newEnd; }
    }
    setTrimPlaying(false);
  }

  function handleTimelinePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!trimDragRef.current || trimDurationRef.current <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t   = pct * trimDurationRef.current;
    const v   = refVideoRef.current;

    if (trimDragRef.current === "start") {
      const newStart = Math.max(0, Math.min(t, trimEndRef.current - 0.5));
      setTrimStart(newStart);
      trimStartRef.current = newStart;
      if (v) v.currentTime = newStart;
    } else {
      const newEnd = Math.min(trimDurationRef.current, Math.max(t, trimStartRef.current + 0.5));
      setTrimEnd(newEnd);
      trimEndRef.current = newEnd;
      if (v) v.currentTime = newEnd;
    }
  }

  function handleTimelinePointerUp() {
    trimDragRef.current = null;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const loadingItems = [
    { label: "Camera",    done: webcamReady },
    { label: "Reference", done: refReady    },
    { label: "AI model",  done: poseReady && !poseLoading },
  ];

  const trimStartPct  = trimDuration > 0 ? (trimStart / trimDuration) * 100 : 0;
  const trimEndPct    = trimDuration > 0 ? (trimEnd   / trimDuration) * 100 : 100;
  const trimTimePct   = trimDuration > 0 ? (trimTime  / trimDuration) * 100 : 0;
  const trimLengthSec = trimEnd - trimStart;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">

        {/* ── Step 1: Frame ──────────────────────────────────────────── */}
        {calibStep === "frame" && (
          <motion.div
            key="frame"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, x: -20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#f8f4e0] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#1a0f00]/08 bg-white px-5 py-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/30">Step 1 of 3</span>
                  <div className="h-px flex-1 bg-[#1a0f00]/08 w-12" />
                  <span className="text-[10px] text-[#1a0f00]/20">Trim →</span>
                </div>
                <h2 className="font-bold text-base text-[#1a0f00]">Frame Yourself</h2>
                <p className="mt-0.5 text-xs text-[#1a0f00]/40 max-w-xs leading-relaxed">
                  Position yourself so your skeleton aligns with the reference, then raise your palm to lock in the framing.
                </p>
              </div>
              <button onClick={() => goToTrim({ zoom: 1, offsetXNorm: 0, offsetYNorm: 0 })}
                className="ml-4 mt-0.5 shrink-0 rounded-lg bg-[#1a0f00]/06 px-3 py-1.5 text-xs font-medium text-[#1a0f00]/40 hover:bg-[#1a0f00]/10 hover:text-[#1a0f00]/60 transition-all">
                Skip
              </button>
            </div>

            {/* Camera view */}
            <div className="relative aspect-video bg-black overflow-hidden">
              <video ref={webcamRef} playsInline muted
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

              {/* Loading overlay */}
              {frameState === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="flex flex-col items-center gap-3">
                    {loadingItems.map(item => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center ${item.done ? "bg-emerald-500" : "border border-white/20"}`}>
                          {item.done
                            ? <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            : <div className="h-2 w-2 animate-spin rounded-full border border-white/20 border-t-white/60" />
                          }
                        </div>
                        <span className={`text-xs ${item.done ? "text-white/70" : "text-white/40"}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Palm progress ring */}
              <AnimatePresence>
                {palmProgress > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative h-28 w-28">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 112 112">
                        <circle cx="56" cy="56" r="50" fill="none" stroke="white" strokeWidth="4" strokeOpacity="0.15" />
                        <circle cx="56" cy="56" r="50" fill="none" stroke="#10B981" strokeWidth="4"
                          strokeDasharray={`${Math.PI * 2 * 50 * palmProgress} 999`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-3xl select-none">✋</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {frameState === "calibrating" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur">
                    <p className="text-sm font-semibold text-white">Calibrating…</p>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {frameState === "done" && (
                  <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-emerald-900/30">
                    <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/80 px-6 py-3 backdrop-blur">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <p className="text-sm font-bold text-white">Framed!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(frameState === "ready" || frameState === "palm") && (
                <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 backdrop-blur">
                  <div className={`h-1.5 w-1.5 rounded-full ${bodyDetected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
                  <span className="text-[10px] font-semibold tracking-wide text-white/70">
                    {bodyDetected ? "Body detected" : "Looking for body…"}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-white border-t border-[#1a0f00]/08">
              <div className="flex items-center gap-2 min-w-0">
                {frameState === "loading" && <p className="text-xs text-[#1a0f00]/40">Initialising…</p>}
                {(frameState === "ready" || frameState === "palm") && !bodyDetected && (
                  <p className="text-xs text-[#1a0f00]/50">Position yourself so your shoulders are visible</p>
                )}
                {(frameState === "ready" || frameState === "palm") && bodyDetected && palmProgress === 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👋</span>
                    <p className="text-xs text-[#1a0f00]/60">Raise your palm above your face to calibrate</p>
                  </div>
                )}
                {palmProgress > 0 && <p className="text-xs font-medium text-emerald-600">Hold still… {Math.round(palmProgress * 100)}%</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {(frameState === "ready" || frameState === "palm") && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#1a0f00]/30">Overlay</span>
                    <input type="range" min={0} max={80} value={overlayOpacity}
                      onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                      className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[#1a0f00]/08 accent-emerald-500" />
                  </div>
                )}
                {(frameState === "ready" || frameState === "palm") && (
                  <button onClick={() => goToTrim({ zoom: 1, offsetXNorm: 0, offsetYNorm: 0 })}
                    className="flex items-center gap-1.5 rounded-full bg-[#080808] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#1a1a1a]">
                    Next
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Trim ───────────────────────────────────────────── */}
        {calibStep === "trim" && (
          <motion.div
            key="trim"
            initial={{ opacity: 0, scale: 0.96, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#f8f4e0] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#1a0f00]/08 bg-white px-5 py-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <button onClick={() => setCalibStep("frame")} className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/30 hover:text-[#1a0f00]/60 transition-colors">
                    ← Frame
                  </button>
                  <div className="h-px w-8 bg-[#1a0f00]/08" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60">Step 2 of 3</span>
                  <div className="h-px w-8 bg-[#1a0f00]/08" />
                  <span className="text-[10px] text-[#1a0f00]/20">Mode →</span>
                </div>
                <h2 className="font-bold text-base text-[#1a0f00]">Trim Video</h2>
                <p className="mt-0.5 text-xs text-[#1a0f00]/40 leading-relaxed">
                  Drag the green and orange handles to set the section you want to practice.
                </p>
              </div>
              <button onClick={onSkip}
                className="ml-4 mt-0.5 shrink-0 rounded-lg bg-[#1a0f00]/06 px-3 py-1.5 text-xs font-medium text-[#1a0f00]/40 hover:bg-[#1a0f00]/10 hover:text-[#1a0f00]/60 transition-all">
                Skip All
              </button>
            </div>

            {/* Video preview */}
            <div className="relative aspect-video bg-black overflow-hidden">
              <video ref={refVideoRef} src={videoUrl} playsInline preload="auto" crossOrigin="anonymous"
                className="h-full w-full object-contain"
                onLoadedMetadata={() => {
                  const v = refVideoRef.current;
                  if (!v) return;
                  const dur = isFinite(v.duration) ? v.duration : 0;
                  setTrimDuration(dur);
                  if (trimEnd === 0) setTrimEnd(dur);
                }}
              />

              {/* Play/pause overlay button */}
              <button onClick={toggleTrimPlay}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors group">
                {!trimPlaying && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-all">
                    <svg className="h-5 w-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Time badges */}
              <div className="pointer-events-none absolute left-3 bottom-3 flex items-center gap-2">
                <div className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-mono text-white/80 backdrop-blur">{fmt(trimTime)}</div>
              </div>
              <div className="pointer-events-none absolute right-3 bottom-3">
                <div className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-mono text-white/50 backdrop-blur">{fmt(trimDuration)}</div>
              </div>
            </div>

            {/* Timeline scrubber with drag handles */}
            <div className="px-5 pt-5 pb-2">
              {/* Handle timestamp labels */}
              <div className="relative h-5 mb-1 select-none">
                <span
                  className="absolute -translate-x-1/2 text-[10px] font-mono font-semibold text-[#34D399]"
                  style={{ left: `${trimStartPct}%` }}
                >
                  {fmt(trimStart)}
                </span>
                <span
                  className="absolute -translate-x-1/2 text-[10px] font-mono font-semibold text-[#F97316]"
                  style={{ left: `${trimEndPct}%` }}
                >
                  {fmt(trimEnd)}
                </span>
              </div>

              {/* Drag timeline */}
              <div
                className="relative h-4 rounded-full bg-[#1a0f00]/08 touch-none select-none cursor-ew-resize"
                onPointerDown={handleTimelinePointerDown}
                onPointerMove={handleTimelinePointerMove}
                onPointerUp={handleTimelinePointerUp}
              >
                {/* Playhead progress */}
                <div className="pointer-events-none absolute top-0 h-full rounded-full bg-[#080808]/20"
                  style={{ width: `${trimTimePct}%` }} />
                {/* Trim region highlight */}
                <div className="pointer-events-none absolute top-0 h-full bg-[#34D399]/20 rounded"
                  style={{ left: `${trimStartPct}%`, width: `${trimEndPct - trimStartPct}%` }} />
                {/* Start handle */}
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-2.5 rounded shadow-md bg-[#34D399]"
                  style={{ left: `${trimStartPct}%` }}
                />
                {/* End handle */}
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-2.5 rounded shadow-md bg-[#F97316]"
                  style={{ left: `${trimEndPct}%` }}
                />
              </div>

              {/* Playback controls */}
              <div className="mt-3 flex items-center gap-3">
                <button onClick={toggleTrimPlay}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a0f00]/08 text-[#1a0f00]/60 transition-all hover:bg-[#1a0f00]/14 hover:text-[#1a0f00]">
                  {trimPlaying
                    ? <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
                    : <svg className="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  }
                </button>
                <span className="text-xs font-mono text-[#1a0f00]/40">
                  {fmt(trimLengthSec)} selected
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white border-t border-[#1a0f00]/08">
              <p className="text-xs text-[#1a0f00]/40">
                Scan <span className="font-semibold text-[#1a0f00]/60">{fmt(trimStart)}</span> → <span className="font-semibold text-[#1a0f00]/60">{fmt(trimEnd)}</span>
              </p>
              <button onClick={goToMode}
                className="flex items-center gap-2 rounded-full bg-[#080808] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1a1a1a] active:scale-95">
                Next
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Mode (Solo / Group) ────────────────────────────── */}
        {calibStep === "mode" && (
          <motion.div
            key="mode"
            initial={{ opacity: 0, scale: 0.96, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#f8f4e0] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#1a0f00]/08 bg-white px-5 py-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <button onClick={() => setCalibStep("trim")} className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/30 hover:text-[#1a0f00]/60 transition-colors">
                    ← Trim
                  </button>
                  <div className="h-px w-8 bg-[#1a0f00]/08" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60">Step 3 of 3</span>
                </div>
                <h2 className="font-bold text-base text-[#1a0f00]">How many dancers are in the video?</h2>
                <p className="mt-0.5 text-xs text-[#1a0f00]/40 leading-relaxed">
                  Choose based on the video you uploaded.
                </p>
              </div>
            </div>

            {/* Mode selection */}
            <div className="flex flex-col gap-3 p-5">
              {/* Solo option */}
              <button
                onClick={() => {
                  onCalibrated({ ...pendingFrame, trimStart, trimEnd, personCenter: undefined, solo: true });
                }}
                className="flex flex-col gap-0.5 rounded-2xl border-2 border-[#1a0f00]/08 bg-white px-5 py-4 text-left transition-all hover:border-[#1a0f00]/20 hover:shadow-sm active:scale-[0.99]"
              >
                <span className="font-bold text-sm text-[#1a0f00]">Solo</span>
                <span className="text-xs text-[#1a0f00]/50">One dancer — tracking is automatic</span>
              </button>

              {/* Group option */}
              <button
                onClick={goToDancer}
                className="flex items-center gap-3 rounded-2xl border-2 border-[#1a0f00]/08 bg-white px-5 py-4 text-left transition-all hover:border-[#1a0f00]/20 hover:shadow-sm active:scale-[0.99]"
              >
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="font-bold text-sm text-[#1a0f00]">Group</span>
                  <span className="text-xs text-[#1a0f00]/50">Multiple dancers — you&apos;ll select who to follow</span>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                  EXPERIMENTAL
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-start gap-4 px-5 py-3.5 bg-white border-t border-[#1a0f00]/08">
              <button onClick={() => setCalibStep("trim")}
                className="flex items-center gap-1.5 rounded-full bg-[#1a0f00]/06 px-4 py-1.5 text-xs font-medium text-[#1a0f00]/50 hover:bg-[#1a0f00]/10 hover:text-[#1a0f00]/70 transition-all">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Dancer ─────────────────────────────────────────── */}
        {calibStep === "dancer" && (
          <motion.div
            key="dancer"
            initial={{ opacity: 0, scale: 0.96, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#f8f4e0] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#1a0f00]/08 bg-white px-5 py-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <button onClick={() => setCalibStep("mode")} className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/30 hover:text-[#1a0f00]/60 transition-colors">
                    ← Mode
                  </button>
                  <div className="h-px w-8 bg-[#1a0f00]/08" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60">Step 3 of 3</span>
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">EXPERIMENTAL</span>
                </div>
                <h2 className="font-bold text-base text-[#1a0f00]">Select Dancer</h2>
                <p className="mt-0.5 text-xs text-[#1a0f00]/40 leading-relaxed">
                  {persons.length > 1
                    ? "Tap the dancer you want Trace to track and give feedback on."
                    : "Trace will automatically track the dancer in frame."}
                </p>
              </div>
            </div>

            {/* Video area */}
            <div className="relative aspect-video bg-black overflow-hidden">
              <video ref={refVideoRef} src={videoUrl} playsInline preload="auto" crossOrigin="anonymous"
                className="h-full w-full object-contain"
                onLoadedData={() => {
                  const v = refVideoRef.current;
                  if (v) { v.pause(); v.currentTime = trimStart; }
                }}
              />

              {/* Person selection canvas */}
              <canvas
                ref={personCanvasRef}
                className="absolute inset-0 h-full w-full"
                style={{ cursor: persons.length > 1 && !personsLoading ? "pointer" : "default" }}
                onClick={handlePersonCanvasClick}
              />

              {/* Loading overlay */}
              {personsLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex flex-col items-center gap-3 w-48">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span className="text-xs font-medium text-white/70">Scanning video for dancers…</span>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-150"
                        style={{ width: `${Math.round(scanProgress * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/40">{Math.round(scanProgress * 100)}%</span>
                  </div>
                </div>
              )}

              {/* 1 dancer → auto-advancing */}
              {!personsLoading && persons.length === 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/80 px-5 py-3 backdrop-blur">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <p className="text-sm font-semibold text-white">1 dancer found — starting…</p>
                  </div>
                </motion.div>
              )}

              {/* 0 dancers → error */}
              {!personsLoading && persons.length === 0 && scanProgress >= 1 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/75 px-6 py-4 backdrop-blur text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                      <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-white">No dancer detected</p>
                    <p className="text-[11px] leading-relaxed text-white/50">Try adjusting the trim range to a section<br />with clearly visible movement</p>
                  </div>
                </div>
              )}

              {/* Small play button (bottom-left) — doesn't block canvas clicks */}
              {!personsLoading && (
                <button onClick={toggleTrimPlay}
                  className="absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors">
                  {trimPlaying
                    ? <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
                    : <svg className="h-3.5 w-3.5 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  }
                </button>
              )}
            </div>

            {/* Dancer face-thumbnail cards (shown when 2+ dancers detected) */}
            {!personsLoading && persons.length > 1 && (
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-[#1a0f00]/60 mb-3">Who should Trace focus on?</p>
                <div className="flex flex-wrap gap-3">
                  {persons.map((p, i) => {
                    const posLabel     = p.x < 0.33 ? "Left" : p.x > 0.66 ? "Right" : "Center";
                    const BORDER_COLORS = ["border-[#00D4FF]", "border-[#34D399]", "border-[#FBBF24]", "border-[#F472B6]"];
                    const isSelected   = i === selectedPerson;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedPerson(i)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-all ${
                          isSelected
                            ? `${BORDER_COLORS[i % BORDER_COLORS.length]} bg-white shadow-md scale-[1.04]`
                            : "border-[#1a0f00]/08 bg-white hover:border-[#1a0f00]/20 hover:shadow-sm"
                        }`}
                      >
                        {/* Thumbnail or stick-figure fallback */}
                        <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-[#1a0f00]/05">
                          {faceThumbnails[i] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={faceThumbnails[i]!}
                              alt={`Dancer ${i + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-10 w-10 text-[#1a0f00]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <circle cx="12" cy="5" r="2.5" />
                                <line x1="12" y1="7.5" x2="12" y2="15" />
                                <line x1="8"  y1="11" x2="16" y2="11" />
                                <line x1="12" y1="15" x2="9"  y2="21" />
                                <line x1="12" y1="15" x2="15" y2="21" />
                              </svg>
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 flex items-end justify-end p-1 bg-gradient-to-t from-black/20 to-transparent">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-[#1a0f00]/60">{posLabel}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-[11px] text-[#1a0f00]/40">
                  Trace will analyze this dancer&apos;s movements to give you feedback
                </p>
              </div>
            )}

            {/* Spacer when 0 or 1 dancer (keeps footer height stable) */}
            {!personsLoading && persons.length <= 1 && (
              <div className="px-5 py-3">
                <p className="text-[11px] text-[#1a0f00]/40">
                  You can re‑calibrate later from the Trace screen if needed.
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-white border-t border-[#1a0f00]/08">
              <button onClick={() => setCalibStep("mode")}
                className="flex items-center gap-1.5 rounded-full bg-[#1a0f00]/06 px-4 py-1.5 text-xs font-medium text-[#1a0f00]/50 hover:bg-[#1a0f00]/10 hover:text-[#1a0f00]/70 transition-all">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
              <button onClick={handleStartFromDancer} disabled={personsLoading}
                className="flex items-center gap-2 rounded-full bg-[#080808] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1a1a1a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                Start Trace & Pre‑scan
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Hidden reference video (used by frame step for pose detection) */}
      {calibStep === "frame" && (
        <video ref={refVideoRef} src={videoUrl}
          playsInline preload="auto" crossOrigin="anonymous"
          className="hidden"
          onLoadedData={() => setRefReady(true)}
        />
      )}
    </div>
  );
}
