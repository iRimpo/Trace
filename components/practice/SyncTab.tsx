"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { initPoseDetection, detectPose } from "@/lib/mediapipe";
import type { PoseFrame } from "@/lib/poseRecorder";
import type { CalibrationData } from "@/components/practice/CalibrationModal";
import { saveSyncScore } from "@/lib/uploadRecording";
import { loadRecordingSession, clearRecordingSession } from "@/lib/sessionVideoStorage";

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

function scoreColor(s: number): string {
  if (s >= 80) return "#10B981";
  if (s >= 55) return "#EAB308";
  if (s >= 30) return "#F97316";
  return "#EF4444";
}

function scoreLabel(s: number): string {
  if (s >= 80) return "Strong sync";
  if (s >= 55) return "Close";
  if (s >= 30) return "Needs work";
  return "Off-beat";
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const;

// ── Region color map ─────────────────────────────────────────────────────

const REGION_COLOR: Record<string, string> = {
  leftArm:  "#00D4FF",  // cyan
  rightArm: "#60A5FA",  // sky blue
  leftLeg:  "#34D399",  // teal
  rightLeg: "#10B981",  // emerald
  torso:    "#A78BFA",  // purple
  head:     "#FBBF24",  // amber
};

// ── Region definitions ───────────────────────────────────────────────────

type RegionName = "leftArm" | "rightArm" | "leftLeg" | "rightLeg" | "torso" | "head";

const REGION_LABELS: Record<RegionName, string> = {
  leftArm:  "Left Arm",
  rightArm: "Right Arm",
  leftLeg:  "Left Leg",
  rightLeg: "Right Leg",
  torso:    "Torso",
  head:     "Head",
};

const REGION_TRIPLETS: Record<RegionName, [number, number, number][]> = {
  leftArm:  [[23, 11, 13], [11, 13, 15]],
  rightArm: [[24, 12, 14], [12, 14, 16]],
  leftLeg:  [[11, 23, 25], [23, 25, 27]],
  rightLeg: [[12, 24, 26], [24, 26, 28]],
  torso:    [[23, 11, 13], [24, 12, 14], [11, 23, 25], [12, 24, 26]],
  head:     [],
};

const REGION_ORDER: RegionName[] = ["torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];

// ── Feedback tips ─────────────────────────────────────────────────────────

const REGION_TIPS: Partial<Record<RegionName, { low: string; mid: string }>> = {
  leftArm: {
    low: "Left arm is significantly off — watch the reference overlay and focus on matching your elbow angle on every beat.",
    mid: "Left arm almost there — pay attention to how fully you extend on the downbeats.",
  },
  rightArm: {
    low: "Right arm needs the most work — pause at the timestamp below and compare arm position frame-by-frame.",
    mid: "Right arm is close — try leading the movement from the shoulder rather than the hand.",
  },
  leftLeg: {
    low: "Left leg is lagging — slow the video to 0.5× and drill the footwork in isolation.",
    mid: "Left leg mostly in sync — make sure your weight shifts happen on the right beat.",
  },
  rightLeg: {
    low: "Right leg is off — check your stance width; it may differ from the reference.",
    mid: "Right leg is close — tighten the timing on your step-touches.",
  },
  torso: {
    low: "Core/torso is the biggest gap — this affects everything else. Practice isolating hip and shoulder rolls.",
    mid: "Torso is almost locked in — try consciously relaxing your shoulders to match the reference posture.",
  },
};

function generateFeedback(
  regionScores: Record<RegionName, number>,
  overallScore: number,
): { region: RegionName; tip: string }[] {
  if (overallScore >= 80) return [];
  const valid = REGION_ORDER.filter(r => regionScores[r] >= 0);
  const sorted = [...valid].sort((a, b) => regionScores[a] - regionScores[b]);
  const bottom = sorted.slice(0, 3).filter(r => regionScores[r] < 80);
  return bottom.flatMap(region => {
    const score = regionScores[region];
    const tips = REGION_TIPS[region];
    if (!tips) return [];
    const tip = score < 45 ? tips.low : score < 65 ? tips.mid : null;
    if (!tip) return [];
    return [{ region, tip }];
  });
}

// ── Pose scoring helpers ─────────────────────────────────────────────────

const JOINT_TRIPLETS: [number, number, number][] = [
  [11, 13, 15], // left elbow
  [12, 14, 16], // right elbow
  [23, 11, 13], // left shoulder
  [24, 12, 14], // right shoulder
  [23, 25, 27], // left knee
  [24, 26, 28], // right knee
  [11, 23, 25], // left hip
  [12, 24, 26], // right hip
];

function jointAngle(kps: number[][], vW: number, vH: number, p1: number, v: number, p2: number): number | null {
  const k1 = kps[p1], kv = kps[v], k2 = kps[p2];
  if (!k1 || !kv || !k2) return null;
  if ((k1[2] ?? 0) < 0.3 || (kv[2] ?? 0) < 0.3 || (k2[2] ?? 0) < 0.3) return null;
  const dx1 = (k1[0] - kv[0]) / vW, dy1 = (k1[1] - kv[1]) / vH;
  const dx2 = (k2[0] - kv[0]) / vW, dy2 = (k2[1] - kv[1]) / vH;
  const dot  = dx1 * dx2 + dy1 * dy2;
  const mag1 = Math.sqrt(dx1 ** 2 + dy1 ** 2);
  const mag2 = Math.sqrt(dx2 ** 2 + dy2 ** 2);
  if (mag1 < 1e-6 || mag2 < 1e-6) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
}

function comparePoseScore(
  userKps: number[][], uW: number, uH: number,
  refKps:  number[][], rW: number, rH: number,
): number {
  let totalDiff = 0, count = 0;
  for (const [p1, v, p2] of JOINT_TRIPLETS) {
    const ua = jointAngle(userKps, uW, uH, p1, v, p2);
    const ra = jointAngle(refKps,  rW, rH, p1, v, p2);
    if (ua === null || ra === null) continue;
    totalDiff += Math.abs(ua - ra);
    count++;
  }
  if (count < 2) return 50;
  const avgDiff = totalDiff / count;
  return Math.max(0, Math.min(100, Math.round((1 - avgDiff / 90) * 100)));
}

function compareRegionScores(
  userKps: number[][], uW: number, uH: number,
  refKps:  number[][], rW: number, rH: number,
): Record<RegionName, number> {
  const result = {} as Record<RegionName, number>;
  for (const region of REGION_ORDER) {
    const triplets = REGION_TRIPLETS[region];
    if (triplets.length === 0) { result[region] = -1; continue; }
    let totalDiff = 0, count = 0;
    for (const [p1, v, p2] of triplets) {
      const ua = jointAngle(userKps, uW, uH, p1, v, p2);
      const ra = jointAngle(refKps,  rW, rH, p1, v, p2);
      if (ua === null || ra === null) continue;
      totalDiff += Math.abs(ua - ra);
      count++;
    }
    result[region] = count > 0 ? Math.max(0, Math.min(100, Math.round((1 - totalDiff / count / 90) * 100))) : -1;
  }
  return result;
}

// ── Inline fallback for environments where Web Worker is unavailable ────

function computeScoresInline(
  userFrames: PoseFrame[],
  refFrames: PoseFrame[],
  uW: number, uH: number,
  rW: number, rH: number,
  callback: (scores: { t: number; score: number }[], regionScores: Record<RegionName, number>) => void
) {
  const sortedRef = [...refFrames].sort((a, b) => a.t - b.t);
  const regionAccum: Record<RegionName, number[]> = { leftArm: [], rightArm: [], leftLeg: [], rightLeg: [], torso: [], head: [] };
  const scores = userFrames.map(frame => {
    let lo = 0, hi = sortedRef.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedRef[mid].t < frame.t) lo = mid + 1; else hi = mid;
    }
    const nearest = sortedRef[lo];
    const score   = comparePoseScore(frame.kps, uW, uH, nearest.kps, rW, rH);
    const regions = compareRegionScores(frame.kps, uW, uH, nearest.kps, rW, rH);
    for (const r of REGION_ORDER) { if (regions[r] >= 0) regionAccum[r].push(regions[r]); }
    return { t: frame.t, score };
  });
  const avgRegions = {} as Record<RegionName, number>;
  for (const r of REGION_ORDER) {
    const arr = regionAccum[r];
    avgRegions[r] = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : -1;
  }
  callback(scores, avgRegions);
}

// ── Props ───────────────────────────────────────────────────────────────

interface SyncTabProps {
  videoUrl:         string;
  sessionId:        string;
  initialFraming?:  CalibrationData;
  onPracticeAgain:  () => void;
  onGoToDashboard:  () => void;
}

// ── Component ───────────────────────────────────────────────────────────

export default function SyncTab({ videoUrl, sessionId, initialFraming, onPracticeAgain, onGoToDashboard }: SyncTabProps) {

  // ── Session loading ───────────────────────────────────────────────
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [userFrames,   setUserFrames]   = useState<PoseFrame[]>([]);
  const [refFrames,    setRefFrames]    = useState<PoseFrame[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [scoringReady, setScoringReady] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────
  const userVideoRef     = useRef<HTMLVideoElement>(null);
  const proVideoRef      = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const calibAppliedRef  = useRef(false);

  // ── Overlay framing ──────────────────────────────────────────────
  const [proOffsetX,     setProOffsetX]     = useState(0);
  const [proOffsetY,     setProOffsetY]     = useState(0);
  const [proZoom,        setProZoom]        = useState(1.0);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [mirrored,       setMirrored]       = useState(true);
  const [isDragging,     setIsDragging]     = useState(false);
  const [framingExpanded, setFramingExpanded] = useState(false);

  // ── Playback ─────────────────────────────────────────────────────
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [speed,       setSpeed]       = useState(1);

  // ── Scoring ──────────────────────────────────────────────────────
  const [frameScores, setFrameScores] = useState<{ t: number; score: number }[]>([]);
  const [regionScores, setRegionScores] = useState<Record<RegionName, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────
  // Load recording session from sessionStorage
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const rec = loadRecordingSession();
    if (!rec) {
      setLoadError("Session data not found. Please complete the Test step first.");
      setLoading(false);
      return;
    }
    setRecordingUrl(rec.blobUrl);
    setUserFrames(rec.poseFrames);
    if (rec.refPoseFrames.length > 0) {
      setRefFrames(rec.refPoseFrames);
      setScoringReady(true);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Compute scores: offload to web worker when ref frames available,
  // otherwise fall back to visibility proxy on the main thread
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (userFrames.length === 0) return;

    if (scoringReady && refFrames.length > 0) {
      const rW = 1920, rH = 1080;
      const uW = 640,  uH = 480;

      const handleWorkerResult = (scores: { t: number; score: number }[], avgRegions: Record<RegionName, number>) => {
        setFrameScores(scores);
        setRegionScores(avgRegions);
      };

      try {
        const worker = new Worker("/workers/sync-scorer.js");
        worker.onmessage = (e) => {
          handleWorkerResult(e.data.scores, e.data.regionScores);
          worker.terminate();
        };
        worker.onerror = () => {
          worker.terminate();
          computeScoresInline(userFrames, refFrames, uW, uH, rW, rH, handleWorkerResult);
        };
        worker.postMessage({ userFrames, refFrames, uW, uH, rW, rH });
      } catch {
        computeScoresInline(userFrames, refFrames, uW, uH, rW, rH, handleWorkerResult);
      }
    } else {
      const BODY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      const scores = userFrames.map(frame => {
        const relevant = BODY_JOINTS.map(i => frame.kps[i]).filter(Boolean);
        const avg = relevant.length > 0
          ? relevant.reduce((s, kp) => s + (kp[2] ?? 0), 0) / relevant.length
          : 0;
        return { t: frame.t, score: Math.round(avg * 100) };
      });
      setFrameScores(scores);
    }
  }, [userFrames, refFrames, scoringReady, sessionId]);

  // ─────────────────────────────────────────────────────────────────
  // Async extraction: use a SEPARATE video element so the overlay
  // reference video is never disrupted during extraction
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (scoringReady || !recordingUrl || userFrames.length === 0) return;
    let cancelled = false;

    async function extractRefPoses() {
      await initPoseDetection();
      if (cancelled) return;

      // Dedicated extraction video — never touches proVideoRef
      const vid = document.createElement("video");
      vid.src = videoUrl;
      vid.crossOrigin = "anonymous";
      vid.preload = "auto";

      await new Promise<void>((resolve, reject) => {
        vid.addEventListener("loadedmetadata", () => resolve(), { once: true });
        vid.addEventListener("error", () => reject(), { once: true });
        vid.load();
      }).catch(() => null);

      if (cancelled || !vid.duration) return;

      const N         = 20;
      const dur       = vid.duration;
      const extracted: PoseFrame[] = [];

      for (let i = 0; i < N; i++) {
        if (cancelled) return;
        const t = (i / (N - 1)) * dur;
        vid.currentTime = t;
        await new Promise<void>(resolve => {
          const done = () => { vid.removeEventListener("seeked", done); resolve(); };
          vid.addEventListener("seeked", done);
        });
        if (cancelled) return;

        const off = document.createElement("canvas");
        off.width  = vid.videoWidth  || 640;
        off.height = vid.videoHeight || 480;
        const ctx2 = off.getContext("2d");
        if (ctx2) {
          ctx2.drawImage(vid, 0, 0);
          const kps = detectPose(off);
          if (kps) extracted.push({ t: t * 1000, kps: kps.map(k => [k.x, k.y, k.score ?? 0]) });
        }
      }

      if (!cancelled && extracted.length > 0) {
        setRefFrames(extracted);
        setScoringReady(true);
      }
    }

    extractRefPoses();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingUrl, userFrames.length]);

  // ─────────────────────────────────────────────────────────────────
  // Canvas drawing loop — uses requestVideoFrameCallback when available
  // for smooth draws that match actual video frame rate
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recordingUrl) return;
    let active = true;
    let rafId = 0;

    function drawFrame() {
      const canvas = overlayCanvasRef.current;
      const pro    = proVideoRef.current;
      if (!canvas || !pro) return;
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
      drawRefVideo(ctx, pro, canvas.width, canvas.height, proOffsetX, proOffsetY, proZoom, mirrored);
    }

    function scheduleDraw() {
      const pro = proVideoRef.current;
      if (!pro) { rafId = requestAnimationFrame(scheduleDraw); return; }
      if ("requestVideoFrameCallback" in pro) {
        (pro as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(() => {
          if (!active) return;
          drawFrame();
          scheduleDraw();
        });
      } else {
        rafId = requestAnimationFrame(() => {
          if (!active) return;
          drawFrame();
          scheduleDraw();
        });
      }
    }

    scheduleDraw();
    return () => { active = false; cancelAnimationFrame(rafId); };
  }, [recordingUrl, proOffsetX, proOffsetY, proZoom, mirrored, initialFraming]);

  // Scroll-wheel zoom
  useEffect(() => {
    if (!recordingUrl) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setProZoom(z => Math.min(Math.max(z * (e.deltaY < 0 ? 1.05 : 0.95), 0.3), 3.0));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [recordingUrl]);

  // ─────────────────────────────────────────────────────────────────
  // Sync reference video to user video as it plays
  // ─────────────────────────────────────────────────────────────────
  const syncRef = useCallback((time: number) => {
    const pro = proVideoRef.current;
    if (!pro) return;
    if (Math.abs(pro.currentTime - time) > 0.15) {
      pro.currentTime = time;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Drag-to-pan
  // ─────────────────────────────────────────────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
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
  // Playback controls
  // ─────────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const v = userVideoRef.current;
    const p = proVideoRef.current;
    if (!v) return;
    if (v.paused) {
      try {
        await v.play();
        p?.play().catch(() => {});
        setPlaying(true);
      } catch {
        // video not ready or format unsupported — ignore
      }
    } else {
      v.pause();
      p?.pause();
      setPlaying(false);
    }
  }, []);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Use video duration if available, else fall back to last frame timestamp
      const dur = duration > 0 ? duration
        : userFrames.length > 0 ? userFrames[userFrames.length - 1].t / 1000 : 0;
      if (!dur || !isFinite(dur)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = (e.clientX - rect.left) / rect.width;
      const t     = Math.max(0, Math.min(1, ratio)) * dur;
      if (!isFinite(t)) return;
      if (userVideoRef.current) userVideoRef.current.currentTime = t;
      if (proVideoRef.current)  proVideoRef.current.currentTime  = t;
      setCurrentTime(t);
    },
    [duration, userFrames]
  );

  // ─────────────────────────────────────────────────────────────────
  // Derived scoring
  // ─────────────────────────────────────────────────────────────────

  const effectiveDuration = duration > 0
    ? duration
    : userFrames.length > 0
      ? userFrames[userFrames.length - 1].t / 1000
      : 0;

  const overallScore = frameScores.length > 0
    ? Math.round(frameScores.reduce((s, f) => s + f.score, 0) / frameScores.length)
    : null;

  const feedbackTips = regionScores !== null && overallScore !== null
    ? generateFeedback(regionScores, overallScore)
    : [];

  const timelineBins = effectiveDuration > 0 && frameScores.length > 0
    ? Array.from({ length: 80 }, (_, i) => {
        const t0 = (i / 80) * effectiveDuration * 1000;
        const t1 = ((i + 1) / 80) * effectiveDuration * 1000;
        const inBin = frameScores.filter(f => f.t >= t0 && f.t < t1);
        return inBin.length > 0
          ? Math.round(inBin.reduce((s, f) => s + f.score, 0) / inBin.length)
          : null;
      })
    : [];

  const feedbackItems = (() => {
    if (effectiveDuration <= 0 || frameScores.length === 0) return [];
    const items: { t: number; score: number; label: string }[] = [];
    const step = effectiveDuration / 10;
    for (let i = 0; i < 10; i++) {
      const t0  = i * step * 1000;
      const t1  = (i + 1) * step * 1000;
      const bin = frameScores.filter(f => f.t >= t0 && f.t < t1);
      if (bin.length === 0) continue;
      const avg = Math.round(bin.reduce((s, f) => s + f.score, 0) / bin.length);
      items.push({ t: i * step, score: avg, label: scoreLabel(avg) });
    }
    return items;
  })();

  const progressPct = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // ─────────────────────────────────────────────────────────────────
  // Render: loading / error
  // ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  if (loadError || !recordingUrl) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center bg-black">
        <div className="rounded-2xl border border-white/[0.06] bg-black/50 px-5 py-8 text-center backdrop-blur-xl">
          <p className="text-sm font-medium text-red-400">{loadError ?? "Recording not found."}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[calc(100vh-3rem)] w-full overflow-hidden bg-black">

      {/* ── Video area (fills entire container) ────────────────── */}
      <div className="absolute inset-0">

        {/* User recording (base layer) */}
        <video
          ref={userVideoRef}
          src={recordingUrl}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          onLoadedMetadata={e => {
            const v = e.currentTarget;
            setDuration(v.duration);
            v.playbackRate = speed;
          }}
          onTimeUpdate={e => {
            const t = e.currentTarget.currentTime;
            setCurrentTime(t);
            syncRef(t);
          }}
          onEnded={() => { setPlaying(false); proVideoRef.current?.pause(); }}
        />

        {/* Reference overlay canvas (draggable) */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            opacity:     overlayOpacity / 100,
            cursor:      isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onPointerDown={handleCanvasPointerDown}
        />

        {/* Reference video — visually hidden but NOT display:none so audio plays */}
        <video
          ref={proVideoRef}
          src={videoUrl}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        />
      </div>

      {/* ── Top-left floating badge (Sync + score) ─────────────── */}
      <div className="absolute left-3 top-14 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-xl border border-white/[0.06]">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold tracking-wide text-white/70">SYNC</span>
        </div>


        {scoringReady ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 backdrop-blur-xl">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" />
            </svg>
            Pose comparison
          </span>
        ) : userFrames.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/40 backdrop-blur-xl border border-white/[0.06]">
            <span className="h-2 w-2 animate-spin rounded-full border border-white/20 border-t-white/50" />
            Analyzing…
          </span>
        ) : null}
      </div>

      {/* ── Score breakdown floating side panel (right) — hidden on phone, shown on tablet+ ─── */}
      {(feedbackItems.length > 0 || regionScores) && (
        <div className="absolute right-3 top-14 bottom-44 z-10 hidden w-56 overflow-y-auto rounded-2xl bg-black/50 backdrop-blur-xl border border-white/[0.06] p-3 md:block">

          {/* Region scores */}
          {regionScores && (
            <div className="mb-3">
              <h3 className="text-xs font-bold text-white/70">Body Parts</h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {REGION_ORDER.filter(r => regionScores[r] >= 0).map(r => {
                  const s = regionScores[r];
                  const off = 100 - s;
                  const rc = REGION_COLOR[r];
                  return (
                    <div key={r} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <div className="flex w-16 items-center gap-1 shrink-0">
                        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: rc }} />
                        <span className="text-[10px] font-semibold text-white/50 truncate">{REGION_LABELS[r]}</span>
                      </div>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${s}%`, backgroundColor: rc, opacity: 0.5 + (s / 100) * 0.5 }}
                        />
                      </div>
                      <span className="w-10 text-right text-[10px] font-bold tabular-nums" style={{ color: scoreColor(s) }}>{s}%</span>
                      {off > 15 && <span className="text-[9px] text-white/25">{off}% off</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Worst segment jump */}
          {feedbackItems.length > 0 && (() => {
            const worst = feedbackItems.reduce((a, b) => a.score < b.score ? a : b);
            return (
              <button
                onClick={() => {
                  if (!isFinite(worst.t)) return;
                  if (userVideoRef.current) userVideoRef.current.currentTime = worst.t;
                  if (proVideoRef.current)  proVideoRef.current.currentTime  = worst.t;
                  setCurrentTime(worst.t);
                }}
                className="mb-3 flex w-full items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                Jump to weakest ({fmt(worst.t)})
              </button>
            );
          })()}

          {/* Fixes section */}
          {regionScores && overallScore !== null && (
            <div className="mb-3">
              <h3 className="mb-2 text-xs font-bold text-white/70">Fixes</h3>
              {overallScore >= 80 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                  <p className="text-[10px] font-semibold text-emerald-400">Great run! Strong performance.</p>
                  {(() => {
                    const worst = REGION_ORDER
                      .filter(r => regionScores[r] >= 0)
                      .reduce<RegionName | null>((a, b) => a === null || regionScores[b] < regionScores[a] ? b : a, null);
                    return worst && regionScores[worst] < 90 ? (
                      <p className="mt-0.5 text-[9px] text-white/30">
                        Keep polishing your {REGION_LABELS[worst].toLowerCase()}.
                      </p>
                    ) : null;
                  })()}
                </div>
              ) : feedbackTips.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {feedbackTips.map(({ region, tip }) => (
                    <div
                      key={region}
                      className="rounded-xl border-l-2 bg-white/[0.03] p-2.5"
                      style={{ borderColor: REGION_COLOR[region] }}
                    >
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">
                        <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: REGION_COLOR[region] }} />
                        {REGION_LABELS[region]}
                      </span>
                      <p className="text-[10px] leading-relaxed text-white/60">{tip}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-white/30">No specific fixes needed — keep it up!</p>
              )}
            </div>
          )}

          <h3 className="text-xs font-bold text-white/70">Timeline</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {feedbackItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!isFinite(item.t)) return;
                  if (userVideoRef.current) userVideoRef.current.currentTime = item.t;
                  if (proVideoRef.current)  proVideoRef.current.currentTime  = item.t;
                  setCurrentTime(item.t);
                }}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span className="w-9 shrink-0 font-mono text-[11px] font-semibold text-white/40">
                  {fmt(item.t)}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.score}%`, backgroundColor: scoreColor(item.score) }}
                  />
                </div>
                <span className="w-16 shrink-0 text-[10px] font-medium text-right" style={{ color: scoreColor(item.score) }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-white/25">
            Click a timestamp to jump.
          </p>
        </div>
      )}

      {/* ── Done action sheet ───────────────────────────────────── */}
      {overallScore !== null && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-2 right-2 top-14 z-20 rounded-2xl border border-white/[0.08] bg-black/80 p-3 backdrop-blur-xl sm:left-3 sm:right-auto sm:w-72 sm:p-4"
        >
          {/* Score */}
          <div className="mb-3 text-center">
            <span className="text-5xl font-black tabular-nums" style={{ color: scoreColor(overallScore) }}>
              {overallScore}
            </span>
            <span className="ml-1 text-sm text-white/30">/ 100</span>
            <p className="mt-0.5 text-xs text-white/40">{scoreLabel(overallScore)}</p>
          </div>

          {/* Top-3 region breakdown */}
          {regionScores && (() => {
            const LABELS: Record<string, string> = {
              leftArm: "Left arm", rightArm: "Right arm",
              leftLeg: "Left leg", rightLeg: "Right leg", torso: "Core",
            };
            const sorted = Object.entries(regionScores)
              .filter(([k]) => k in LABELS)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return sorted.length > 0 ? (
              <div className="mb-3 space-y-1.5 rounded-xl bg-white/5 p-2.5">
                {sorted.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: REGION_COLOR[k] ?? "#ffffff" }} />
                    <span className="flex-1 text-[11px] text-white/60">{LABELS[k]}</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreColor(v) }}>{v}%</span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* Save & Done */}
          <button
            disabled={saving}
            onClick={async () => {
              if (saving) return;
              setSaving(true);
              setSaveError(null);
              try {
                if (!sessionId) throw new Error("No session ID — try re-recording in the Test tab.");
                await saveSyncScore(sessionId, overallScore, regionScores ?? {});
                clearRecordingSession();
                onGoToDashboard();
              } catch (e) {
                setSaveError(e instanceof Error ? e.message : "Save failed");
                setSaving(false);
              }
            }}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#080808] transition-all hover:bg-white/90 disabled:opacity-60"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#080808]/20 border-t-[#080808]" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {saving ? "Saving…" : "Save Progress →"}
          </button>

          {saveError && (
            <p className="mb-2 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[11px] text-red-400 text-center">{saveError}</p>
          )}

          {/* Practice Again */}
          <button
            onClick={onPracticeAgain}
            className="w-full rounded-xl border border-white/[0.08] py-2.5 text-sm font-semibold text-white/50 transition-all hover:border-white/20 hover:text-white"
          >
            Practice Again
          </button>
        </motion.div>
      )}

      {/* ── Bottom floating playback bar ───────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/[0.06] p-3">

          {/* Score timeline bars */}
          {timelineBins.length > 0 && (
            <div className="mb-1 flex h-1.5 gap-px overflow-hidden rounded-full">
              {timelineBins.map((score, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ backgroundColor: score !== null ? scoreColor(score) : "rgba(255,255,255,0.06)", opacity: 0.7 }}
                />
              ))}
            </div>
          )}

          {/* Scrub bar */}
          <div
            className="group relative h-2 cursor-pointer rounded-full bg-white/[0.08]"
            onClick={handleTimelineClick}
          >
            <div
              className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* Transport row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-white/20"
            >
              {playing
                ? <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
                : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              }
            </button>

            {/* Time */}
            <span className="min-w-[5.5rem] font-mono text-xs tabular-nums text-white/40">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            {/* Speed — full row on md+, compact toggle on mobile */}
            <div className="hidden items-center gap-0.5 rounded-lg border border-white/[0.06] p-0.5 sm:flex">
              {SPEEDS.map(s => (
                <button key={s}
                  onClick={() => {
                    setSpeed(s);
                    if (userVideoRef.current) userVideoRef.current.playbackRate = s;
                    if (proVideoRef.current)  proVideoRef.current.playbackRate  = s;
                  }}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
                    speed === s ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <button
              className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/50 sm:hidden"
              onClick={() => {
                const idx = SPEEDS.indexOf(speed as typeof SPEEDS[number]);
                const next = SPEEDS[(idx + 1) % SPEEDS.length];
                setSpeed(next);
                if (userVideoRef.current) userVideoRef.current.playbackRate = next;
                if (proVideoRef.current)  proVideoRef.current.playbackRate  = next;
              }}
            >
              {speed}x
            </button>
          </div>

          {/* Overlay controls row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 sm:gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[10px] font-medium text-white/30">Opacity</span>
              <input type="range" min="10" max="90" value={overlayOpacity}
                onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-indigo-500" />
              <span className="w-7 text-[10px] tabular-nums text-white/20">{overlayOpacity}%</span>
            </div>
            <button onClick={() => setMirrored(m => !m)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mirrored ? "bg-blue-500/10 text-blue-400" : "bg-white/[0.04] text-white/30 hover:bg-white/[0.08]"
              }`}>
              Mirror {mirrored ? "On" : "Off"}
            </button>

            {/* Fine-tune framing */}
            <div className="ml-auto">
              <button onClick={() => setFramingExpanded(x => !x)}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30 transition-colors hover:text-white/50">
                <svg className={`h-3 w-3 transition-transform ${framingExpanded ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Framing
              </button>
            </div>
          </div>

          {framingExpanded && (
            <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
              <SyncSlider label="X offset" min={-300} max={300} step={1}
                value={proOffsetX} onChange={v => setProOffsetX(Math.round(v))}
                display={`${proOffsetX > 0 ? "+" : ""}${proOffsetX}px`} />
              <SyncSlider label="Y offset" min={-300} max={300} step={1}
                value={proOffsetY} onChange={v => setProOffsetY(Math.round(v))}
                display={`${proOffsetY > 0 ? "+" : ""}${proOffsetY}px`} />
              <SyncSlider label="Zoom" min={0.3} max={3.0} step={0.05}
                value={proZoom} onChange={setProZoom}
                display={`${proZoom.toFixed(2)}×`} />
              <button onClick={() => { setProOffsetX(0); setProOffsetY(0); setProZoom(1.0); }}
                className="self-start rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/30 hover:bg-white/[0.08]">
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Slider helper ───────────────────────────────────────────────────────

function SyncSlider({
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
