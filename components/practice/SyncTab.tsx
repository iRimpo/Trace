"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { initPoseDetection, detectPose, detectAllPosesFromFrame } from "@/lib/mediapipe";
import type { PoseFrame } from "@/lib/poseRecorder";
import type { CalibrationData } from "@/components/practice/CalibrationModal";
import { saveSyncScore } from "@/lib/uploadRecording";
import { loadRecordingSession, clearRecordingSession } from "@/lib/sessionVideoStorage";
import { TOP_STACK, BOTTOM_SAFE, useIsPortrait } from "@/components/practice/chrome";
import { SPRING_UI, SPRING_POP, SEC, staggerDelay } from "@/lib/motion";
import { sfx, haptic, registerDuckTarget } from "@/lib/feedback";
import { scoreRun, MAX_MATCH_MS } from "@/lib/poseScore";
import { DancerTracker } from "@/lib/dancerTracker";
import Confetti from "@/components/ui/Confetti";
import { CelebratingCharacter, ThinkingCharacter } from "@/components/illustrations";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import IconButton from "@/components/ui/IconButton";
import TogglePill from "@/components/ui/TogglePill";
import Segmented from "@/components/ui/Segmented";

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

/**
 * Score bands.
 *
 * These were four raw hex literals (an emerald, a yellow, an orange and a red)
 * applied through inline `style={{ color }}`, so the palette could not be
 * changed in one edit and none of it matched the app's tokens. They are now
 * token *classes*, which also means a band reads the same in a bar, a number
 * and a label without three separate values.
 *
 * Three colours, four labels: green means done, gold means nearly, red means
 * this is the thing to fix. Four hues at dancing distance is more precision
 * than the eye actually resolves, and the label already carries the nuance.
 */
type ScoreBand = "strong" | "close" | "work";

function scoreBand(s: number): ScoreBand {
  if (s >= 80) return "strong";
  if (s >= 55) return "close";
  return "work";
}

const BAND_TEXT: Record<ScoreBand, string> = {
  strong: "text-duo-green",
  close:  "text-duo-gold",
  work:   "text-duo-red",
};

const BAND_BG: Record<ScoreBand, string> = {
  strong: "bg-duo-green",
  close:  "bg-duo-gold",
  work:   "bg-duo-red",
};

const scoreText = (s: number) => BAND_TEXT[scoreBand(s)];
const scoreBg   = (s: number) => BAND_BG[scoreBand(s)];

function scoreLabel(s: number): string {
  if (s >= 80) return "Strong sync";
  if (s >= 55) return "Close";
  if (s >= 30) return "Needs work";
  return "Off-beat";
}

/** Headline for the results card — the thing you read from ten feet away. */
/**
 * Below this fraction of the run compared, the number is not worth stating as
 * a fact. 0.6 is the point where more than a third of the take is missing —
 * enough that the average is describing a different run from the one danced.
 */
const LOW_COVERAGE = 0.6;

function scoreHeadline(s: number): string {
  if (s >= 90) return "Locked in";
  if (s >= 80) return "Strong run";
  if (s >= 55) return "Nearly there";
  if (s >= 30) return "Keep drilling";
  return "Off the beat";
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const;

/** Stage glass — the same recipe `Panel tone="stage"` applies, for the few
 *  places that need it on a `button` rather than a wrapper. */
const GLASS = "bg-stage-glass backdrop-blur-xl border border-white/10 shadow-stage";

// ── Region colours ───────────────────────────────────────────────────────

/**
 * One class per body region, from the `cue-*` scale — the same colours the
 * overlay paints on those joints, so the breakdown and the practice screen
 * agree. Written out in full because Tailwind's scanner cannot see an
 * interpolated `bg-cue-${region}`.
 *
 * Left and right leg were previously two greens a few hue-degrees apart,
 * indistinguishable in a legend at any real distance. The right leg now takes
 * the pink, so the pair separates.
 */
const REGION_DOT: Record<RegionName, string> = {
  leftArm:  "bg-cue-hand",
  rightArm: "bg-cue-shoulder",
  leftLeg:  "bg-cue-foot",
  rightLeg: "bg-cue-arm",
  torso:    "bg-cue-hip",
  head:     "bg-cue-head",
};

const REGION_BORDER: Record<RegionName, string> = {
  leftArm:  "border-l-cue-hand",
  rightArm: "border-l-cue-shoulder",
  leftLeg:  "border-l-cue-foot",
  rightLeg: "border-l-cue-arm",
  torso:    "border-l-cue-hip",
  head:     "border-l-cue-head",
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
  /**
   * Fraction of recorded frames that produced a real comparison, 0–1.
   *
   * The honesty dial. A 78 built from 30% of the run is a different claim from
   * a 78 built from 95% of it, and the old UI printed both identically.
   */
  /** Where in the reference video this take began — see RecordingSession. */
  const refStartSecRef = useRef(0);
  const [extractProgress, setExtractProgress] = useState<number | null>(null);
  const [coverage, setCoverage] = useState(1);
  /** Whether the number is a real comparison or just "did the camera see you". */
  const [scoreKind, setScoreKind] = useState<"compared" | "visibility">("compared");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * The results card owns the screen when it lands — you have just finished
   * dancing and the score is the entire point of the tab. "Watch it back"
   * collapses it to a chip so the run underneath becomes scrubable.
   */
  /** Layout branches on orientation, never on a width breakpoint (§7). */
  const isPortrait = useIsPortrait();

  /**
   * How the two runs are compared.
   *
   * `overlay` composites the reference on top of your recording — good for
   * judging alignment, bad for judging shape, because the two bodies occupy
   * the same pixels and you cannot see either cleanly.
   *
   * `stacked` puts them side by side driven by one scrubber. This is the view
   * Richard asked for and it simply did not exist: Sync had exactly one mode.
   * Stacking is what you want when the question is "what is my arm doing"
   * rather than "am I in the right place".
   */
  const [compareMode, setCompareMode] = useState<"overlay" | "stacked">("overlay");

  const [resultsOpen, setResultsOpen] = useState(true);
  /**
   * The detail panel's sheet, in portrait only. In landscape the panel is a
   * persistent rail and this is unused.
   */
  const [detailOpen, setDetailOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // Load recording session from sessionStorage
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void loadRecordingSession().then(rec => {
      if (cancelled) return;
      if (!rec) {
        setLoadError("Session data not found. Please complete the Test step first.");
        setLoading(false);
        return;
      }
      setRecordingUrl(rec.blobUrl);
      setUserFrames(rec.poseFrames);
      refStartSecRef.current = rec.refStartSec ?? 0;
      if (rec.refPoseFrames.length > 0) {
        setRefFrames(rec.refPoseFrames);
        setScoringReady(true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // ── Scoring ─────────────────────────────────────────────────────
  //
  // One implementation, in lib/poseScore.ts, with tests. This used to run in
  // a Web Worker loaded from public/workers/sync-scorer.js — a byte-for-byte
  // copy of the same arithmetic in untyped, untested JavaScript, kept in sync
  // by hand. Scoring three minutes at 15fps is a few milliseconds of acos
  // calls, once, at the end of a run; a worker was never buying anything that
  // justified a second copy of the number the whole app builds up to.
  //
  // The video dimensions that used to be passed here were hardcoded guesses
  // (640x480 for the webcam, 1920x1080 for the reference) feeding a
  // normalisation that distorted every angle it touched. Angles are
  // scale-invariant, so no dimensions are needed at all.
  useEffect(() => {
    if (userFrames.length === 0) return;

    if (scoringReady && refFrames.length > 0) {
      const result = scoreRun(userFrames, refFrames);
      setFrameScores(result.frames);
      setRegionScores(result.regions as Record<RegionName, number>);
      setCoverage(result.coverage);
      setScoreKind("compared");
    } else {
      // No reference poses, so nothing can be *compared*. What follows is the
      // average confidence MediaPipe had in seeing your body — useful as "did
      // the camera get you", useless as "how did you dance". It used to be
      // presented as the score, which meant standing still in good light
      // scored higher than dancing well in bad light.
      const BODY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      const scores = userFrames.map(frame => {
        const relevant = BODY_JOINTS.map(i => frame.kps[i]).filter(Boolean);
        const avg = relevant.length > 0
          ? relevant.reduce((s, kp) => s + (kp[2] ?? 0), 0) / relevant.length
          : 0;
        return { t: frame.t, score: Math.round(avg * 100) };
      });
      setFrameScores(scores);
      setRegionScores(null);
      setCoverage(scores.length > 0 ? 1 : 0);
      setScoreKind("visibility");
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
      /*
        ── The rescue path ──────────────────────────────────────────────────

        Runs only when the take handed over no reference poses. It was doing
        three things wrong at once, and each on its own made the resulting
        number meaningless:

        1. It sampled **20 frames across the entire video**. On a three-minute
           clip that is one reference pose every 9.5 seconds, against user
           frames 66ms apart — so every comparison was against a pose from a
           different part of the choreography.
        2. It timestamped them by **absolute video time**, while user frames
           are milliseconds from the start of the take. The take began wherever
           the user had scrubbed to, so unless that was exactly zero the two
           timelines never lined up at all. `refStartSec` exists now so they
           can be related.
        3. It took `landmarks[0]` — an arbitrary dancer, unstable between
           frames — the same defect the live capture path had.

        Sampling is now spaced to the scorer's own matching tolerance, so
        every user frame has a neighbour close enough to be admissible, and
        capped so a long take degrades into honest partial coverage rather
        than a very long freeze.
      */
      await initPoseDetection();
      if (cancelled) return;

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

      const takeSec  = userFrames.length > 0 ? userFrames[userFrames.length - 1].t / 1000 : 0;
      const startSec = refStartSecRef.current;
      if (takeSec <= 0) return;

      // Half the scorer's tolerance, so the worst-case distance to the nearest
      // sample is within it. Capped: past this a long take yields partial
      // coverage, which the results card now states plainly.
      const STEP_SEC = (MAX_MATCH_MS / 1000) * 0.8;
      const MAX_SAMPLES = 400;
      const count = Math.min(Math.ceil(takeSec / STEP_SEC), MAX_SAMPLES);

      const tracker = initialFraming?.personCenter && !initialFraming?.solo
        ? new DancerTracker()
        : null;
      if (tracker && initialFraming?.personCenter) {
        tracker.lock(initialFraming.personCenter);
        tracker.acknowledgeReacquire({ bestGuess: true });
      }

      const extracted: PoseFrame[] = [];
      setExtractProgress(0);

      for (let i = 0; i < count; i++) {
        if (cancelled) return;
        const takeOffsetSec = (i / Math.max(1, count - 1)) * takeSec;
        const videoTime = startSec + takeOffsetSec;
        if (videoTime > vid.duration) break;

        vid.currentTime = videoTime;
        await new Promise<void>(resolve => {
          const done = () => { vid.removeEventListener("seeked", done); resolve(); };
          vid.addEventListener("seeked", done);
        });
        if (cancelled) return;

        let kps: ReturnType<typeof detectPose> = null;
        if (tracker) {
          const all = detectAllPosesFromFrame(vid);
          if (all && all.length > 0) {
            kps = tracker.step(all, vid.videoWidth, vid.videoHeight).kps;
          }
        } else {
          kps = detectPose(vid);
        }

        if (kps) {
          extracted.push({
            // The take's timeline, not the video's — this is the whole fix.
            t: Math.round(takeOffsetSec * 1000),
            kps: kps.map(k => [
              Math.round(k.x * 10) / 10,
              Math.round(k.y * 10) / 10,
              Math.round((k.score ?? 0) * 1000) / 1000,
            ]),
          });
        }
        setExtractProgress((i + 1) / count);
      }

      setExtractProgress(null);
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
    // compareMode matters: the canvas unmounts in stacked mode, so without it
    // this effect keeps a handle on a dead node and scroll-zoom stays broken
    // after switching back to overlay.
  }, [recordingUrl, compareMode]);

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

  /*
    ── The celebration moment ──────────────────────────────────────────────

    This was one spring and a static number, and then silence. It is the payoff
    for the entire session — you have just finished dancing and this is the
    reason the tab exists — so it is the one place in the app where 500ms+ is
    correct. Everywhere else, motion that slow would be lag; here it is rare,
    it is earned, and rushing it throws away the only moment the app gets to
    react to what you did.

    The order is not arbitrary. The number counts up first and alone, because
    it is the headline and everything else on the card is subordinate to it.
    Then the region bars fill **worst first** — that is the part you act on, so
    it should arrive in the order you should read it. Then the character, then
    confetti, then the buttons last, because a button that appears before you
    have read the result invites a tap that skips the result.

    Sound lands on the *number*, not on the card opening: the cue has to
    coincide with the thing it is celebrating or it reads as a UI blip.
  */
  const REVEAL = { number: 140, bars: 900, mascot: 1180, buttons: 1360 } as const;
  const [revealPhase, setRevealPhase] = useState(0);
  const [shownScore,  setShownScore]  = useState(0);
  /**
   * Which score has already been celebrated. Survives the card being collapsed
   * to a chip and reopened — "Watch it back" then reopening should not replay
   * confetti and a fanfare, because the celebration is for finishing the run,
   * not for opening a panel. A second look shows the finished state at once.
   */
  const celebratedRef = useRef<number | null>(null);

  useEffect(() => {
    if (overallScore === null || !resultsOpen) return;

    // Already seen: show the landed state immediately. This is also the
    // safety net for contract §4 — the phases must never be the only thing
    // making the buttons visible, so any path that skips the sequence lands
    // on "everything shown" rather than on a blank card.
    if (celebratedRef.current === overallScore) {
      setRevealPhase(4);
      setShownScore(overallScore);
      return;
    }
    celebratedRef.current = overallScore;

    setRevealPhase(0);
    setShownScore(0);

    const timers = [
      setTimeout(() => setRevealPhase(1), REVEAL.number),
      setTimeout(() => setRevealPhase(2), REVEAL.bars),
      setTimeout(() => setRevealPhase(3), REVEAL.mascot),
      setTimeout(() => setRevealPhase(4), REVEAL.buttons),
    ];

    // Count the number up rather than printing it. A score that appears fully
    // formed is information; a score that climbs is a result.
    let raf = 0;
    const startAt = performance.now() + REVEAL.number;
    const RUN = REVEAL.bars - REVEAL.number;
    function step(now: number) {
      const t = Math.min(Math.max((now - startAt) / RUN, 0), 1);
      // ease-out cubic: fast, then settling — the shape of a number landing.
      setShownScore(Math.round((1 - Math.pow(1 - t, 3)) * overallScore!));
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        sfx(overallScore! >= 80 ? "success" : "almost");
        haptic("success");
      }
    }
    raf = requestAnimationFrame(step);

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      // If the sequence is interrupted, land on the finished state rather than
      // leaving the card frozen part-way through with its buttons invisible.
      setRevealPhase(4);
      setShownScore(overallScore);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallScore, resultsOpen]);

  useEffect(() => {
    registerDuckTarget(userVideoRef.current);
    return () => registerDuckTarget(null);
  }, []);

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
      <div className="flex h-full items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  if (loadError || !recordingUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-6">
        <Panel tone="stage" radius="2xl" className="max-w-sm px-6 py-8 text-center">
          <p className="text-hud-lg font-extrabold text-duo-red">Nothing to score</p>
          <p className="mt-2 text-hud font-bold leading-relaxed text-stage-text/70">
            {loadError ?? "Recording not found."}
          </p>
        </Panel>
      </div>
    );
  }

  /** Is there anything to drill into at all? */
  const hasDetail = feedbackItems.length > 0 || regionScores !== null;

  /**
   * The drill-down, rendered identically in both layouts — a rail in
   * landscape, a sheet in portrait. One definition so the two cannot drift
   * the way the live count did.
   */
  const detailPanel = (
          <Panel tone="stage" radius="2xl" className="p-3.5">

            {/* Worst segment jump — the single most useful button here, so it
                leads rather than sitting under two lists. */}
            {feedbackItems.length > 0 && (() => {
              const worst = feedbackItems.reduce((a, b) => a.score < b.score ? a : b);
              return (
                <Pressable
                  block
                  variant="stage"
                  size="sm"
                  className="mb-3"
                  onClick={() => {
                    if (!isFinite(worst.t)) return;
                    if (userVideoRef.current) userVideoRef.current.currentTime = worst.t;
                    if (proVideoRef.current)  proVideoRef.current.currentTime  = worst.t;
                    setCurrentTime(worst.t);
                    setResultsOpen(false);
                  }}
                >
                  <svg className="h-4 w-4 text-duo-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  Weakest bar · {fmt(worst.t)}
                </Pressable>
              );
            })()}

            {/* Region scores */}
            {regionScores && (
              <div className="mb-4">
                <h3 className="text-hud font-extrabold uppercase tracking-widest text-stage-text/60">Body parts</h3>
                <div className="mt-2 flex flex-col gap-2">
                  {REGION_ORDER.filter(r => regionScores[r] >= 0).map(r => (
                    <RegionBar key={r} region={r} score={regionScores[r]} />
                  ))}
                </div>
              </div>
            )}

            {/* Fixes section */}
            {regionScores && overallScore !== null && (
              <div className="mb-4">
                <h3 className="mb-2 text-hud font-extrabold uppercase tracking-widest text-stage-text/60">Fixes</h3>
                {overallScore >= 80 ? (
                  <div className="rounded-xl border border-duo-green/30 bg-duo-green/15 p-3">
                    <p className="text-hud font-extrabold text-duo-green">Great run — strong performance.</p>
                    {(() => {
                      const worst = REGION_ORDER
                        .filter(r => regionScores[r] >= 0)
                        .reduce<RegionName | null>((a, b) => a === null || regionScores[b] < regionScores[a] ? b : a, null);
                      return worst && regionScores[worst] < 90 ? (
                        <p className="mt-1 text-hud font-bold text-stage-text/70">
                          Keep polishing your {REGION_LABELS[worst].toLowerCase()}.
                        </p>
                      ) : null;
                    })()}
                  </div>
                ) : feedbackTips.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {feedbackTips.map(({ region, tip }) => (
                      <div
                        key={region}
                        className={`rounded-xl border-l-4 bg-white/[0.06] p-3 ${REGION_BORDER[region]}`}
                      >
                        <span className="mb-1.5 inline-flex items-center gap-1.5 text-hud font-extrabold uppercase tracking-widest text-stage-text/70">
                          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${REGION_DOT[region]}`} />
                          {REGION_LABELS[region]}
                        </span>
                        <p className="text-hud font-medium leading-relaxed text-stage-text/75">{tip}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-hud font-bold text-stage-text/60">No specific fixes — keep it up.</p>
                )}
              </div>
            )}

            <h3 className="text-hud font-extrabold uppercase tracking-widest text-stage-text/60">Timeline</h3>
            <p className="mt-1 text-hud font-medium text-stage-text/50">Tap a bar to jump there.</p>
            <div className="mt-2 flex flex-col gap-1">
              {feedbackItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!isFinite(item.t)) return;
                    if (userVideoRef.current) userVideoRef.current.currentTime = item.t;
                    if (proVideoRef.current)  proVideoRef.current.currentTime  = item.t;
                    setCurrentTime(item.t);
                    setResultsOpen(false);
                  }}
                  className="touch-target flex min-h-[36px] items-center gap-2 rounded-xl px-2 text-left transition-ui hover:bg-white/10"
                >
                  <span className="w-10 shrink-0 font-mono text-hud font-bold tabular-nums text-stage-text/70">
                    {fmt(item.t)}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span
                      className={`block h-full rounded-full ${scoreBg(item.score)}`}
                      style={{ width: `${item.score}%` }}
                    />
                  </span>
                  <span className={`w-16 shrink-0 text-right text-hud font-bold ${scoreText(item.score)}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
  );

  // ─────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">

      {/* ── Video area (fills entire container) ────────────────── */}
      {/* Stacked splits on orientation, exactly as TraceTab's side-by-side
          does: rows when the viewport is taller than it is wide, columns when
          it is wider. YOU leads in both — you are the body being judged. */}
      <div className={
        compareMode === "stacked"
          ? `absolute inset-0 grid ${isPortrait ? "grid-rows-2" : "grid-cols-2"}`
          : "absolute inset-0"
      }>

        {/* YOU — your recording. */}
        <div className={compareMode === "stacked" ? "relative overflow-hidden bg-black" : "contents"}>
          <video
            ref={userVideoRef}
            src={recordingUrl}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            /* object-contain, not object-cover. Cover *crops* the recording to
               fill, and combined with the scaleX(-1) mirror it silently cut the
               dancer's hands and feet out of the comparison. On a review screen
               you are judging shapes against a reference, not filling a frame —
               seeing the whole body beats seeing it edge-to-edge. */
            className="absolute inset-0 h-full w-full object-contain"
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
          {compareMode === "stacked" && (
            <div className="absolute left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur" style={{ top: TOP_STACK }}>
              <div className="h-1.5 w-1.5 rounded-full bg-identity-you" />
              <span className="hud-text text-hud font-extrabold tracking-widest text-white">YOU</span>
            </div>
          )}
        </div>

        {/* Reference overlay canvas — overlay mode only. */}
        {compareMode === "overlay" && (
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
        )}

        {/* REFERENCE. In overlay mode this element is still mounted and still
            playing — it is the canvas's source and it carries the audio — so it
            is sized to nothing rather than display:none, which would stop both. */}
        <div className={compareMode === "stacked" ? "relative overflow-hidden bg-black" : "contents"}>
          <video
            ref={proVideoRef}
            src={videoUrl}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            className={compareMode === "stacked" ? "absolute inset-0 h-full w-full object-contain" : ""}
            style={compareMode === "stacked"
              ? undefined
              : { position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          />
          {compareMode === "stacked" && (
            <div className="absolute left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur" style={{ top: isPortrait ? "0.75rem" : TOP_STACK }}>
              <div className="h-1.5 w-1.5 rounded-full bg-identity-reference" />
              <span className="hud-text text-hud font-extrabold tracking-widest text-white">REFERENCE</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Top-left status / collapsed score ───────────────────── */}
      {/* top-14 was a fourth independent guess at the offset: 56px sits under a
          59px Dynamic Island inset, and collides with PracticeView's header at
          any inset. TOP_STACK is the one value that clears it. */}
      <div className="absolute left-3 z-20 flex items-center gap-2" style={{ top: TOP_STACK }}>
        {overallScore !== null && !resultsOpen ? (
          /* Collapsed results — still the score, still legible, one tap back. */
          <button
            onClick={() => setResultsOpen(true)}
            aria-label={`Show results — ${overallScore} out of 100`}
            className={`touch-target flex min-h-[44px] items-center gap-2 rounded-full ${GLASS} px-3.5 transition-ui hover:bg-stage/80`}
          >
            <span className={`text-2xl font-black leading-none tabular-nums ${scoreText(overallScore)}`}>
              {overallScore}
            </span>
            <span className="text-hud font-extrabold uppercase tracking-widest text-stage-text/70">
              Results
            </span>
          </button>
        ) : (
          <div className={`flex items-center gap-2 rounded-full ${GLASS} px-3 py-2`}>
            <span className="h-2 w-2 rounded-full bg-duo-green" />
            <span className="text-hud font-extrabold tracking-widest text-stage-text/80">SYNC</span>
            {!scoringReady && userFrames.length > 0 && (
              <span className="flex items-center gap-1.5 text-hud font-bold text-stage-text/70">
                <span className="h-3 w-3 animate-spin motion-reduce:animate-pulse rounded-full border border-white/30 border-t-transparent" />
                {/* The rescue path re-reads the reference video frame by frame,
                    which takes real time. An unexplained spinner on a screen
                    the user is waiting on reads as a hang. */}
                {extractProgress !== null
                  ? `Reading reference… ${Math.round(extractProgress * 100)}%`
                  : "Scoring…"}
              </span>
            )}
          </div>
        )}
      </div>

      {/*
        ── The detail panel exists on phones now ──────────────────────────
        It was `hidden … md:block`, so the per-region breakdown and the
        "jump to your weakest bar" button — the most actionable controls in
        the app — did not exist on the device the app is actually used on.
        Same class of bug as the Ghost slider and the live count; contract §7
        now forbids it outright.

        Landscape keeps the persistent rail, which is what the horizontal room
        is for. Portrait gets a sheet on the same drag-to-dismiss pattern as
        the results card, opened from the top-right.
      */}
      {hasDetail && !isPortrait && (
        <div
          className="absolute right-3 bottom-56 z-10 w-72 overflow-y-auto"
          style={{ top: TOP_STACK }}
        >
          {detailPanel}
        </div>
      )}

      {hasDetail && isPortrait && !resultsOpen && (
        <div className="absolute right-3 z-20" style={{ top: TOP_STACK }}>
          <Pressable
            variant="stage"
            size="sm"
            onClick={() => setDetailOpen(true)}
            aria-expanded={detailOpen}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            Details
          </Pressable>
        </div>
      )}

      <AnimatePresence>
        {hasDetail && isPortrait && detailOpen && (
          <motion.div
            key="detail-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: SEC.EXIT }}
            onClick={() => setDetailOpen(false)}
            className="absolute inset-0 z-30 bg-black/60"
          >
            <motion.div
              key="detail-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SPRING_UI}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 520) setDetailOpen(false);
              }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-label="Run detail"
              className="absolute inset-x-0 bottom-0 max-h-[82%] cursor-grab overflow-y-auto active:cursor-grabbing"
              style={{ paddingBottom: BOTTOM_SAFE }}
            >
              <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-white/25" />
              {detailPanel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════ RESULTS — the payoff ══════════════════ */}
      {/*
        This used to be a 288px sidebar pinned to the top-left corner with the
        score set at 48px and the breakdown at 11px. You have just finished
        dancing; the score is the reason the tab exists, so it takes the screen
        and dims the video behind it (apple-design §12 — a modal task pairs its
        surface with a scrim), then collapses to a chip on "Watch it back".

        The scrim fades; the card animates scale and position only and starts at
        full opacity, so a mid-flight framer failure leaves a readable card
        rather than an invisible one (contract §4).
      */}
      <AnimatePresence>
        {overallScore !== null && resultsOpen && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 px-3 py-6"
          >
            {/* Only above 80. Confetti for every run is confetti for none, and
                it would be celebrating a score the card is telling you to
                improve. Skipped entirely under prefers-reduced-motion — it is
                the one element here carrying no information at all. */}
            <Confetti active={revealPhase >= 3 && overallScore >= 80} />
            <motion.div
              initial={{ scale: 0.94, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 8 }}
              transition={SPRING_UI}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.2, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                // Flick it away rather than hunting for the button.
                if (info.offset.y > 90 || info.velocity.y > 520) setResultsOpen(false);
              }}
              className="w-[min(440px,94vw)] cursor-grab active:cursor-grabbing"
            >
              <Panel tone="stage" radius="2xl" className="px-5 py-6">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />

                {/* The number. Everything else on this card is subordinate. */}
                <p className="text-center text-hud font-extrabold uppercase tracking-[0.2em] text-stage-text/60">
                  {scoreKind === "visibility"
                    ? "Camera check"
                    : coverage < LOW_COVERAGE
                      ? "Partial run"
                      : scoreHeadline(overallScore)}
                </p>
                <motion.div
                  className="mt-1 flex items-end justify-center gap-1"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={revealPhase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
                  transition={SPRING_POP}
                >
                  {/* aria-live so the count-up is announced once, on landing,
                      rather than sixty times as it climbs. */}
                  <span
                    className={`font-display text-[5.5rem] font-black leading-[0.85] tabular-nums ${scoreText(overallScore)}`}
                    aria-hidden="true"
                  >
                    {shownScore}
                  </span>
                  <span className="sr-only" aria-live="polite">
                    {revealPhase >= 2 ? `Score ${overallScore} out of 100` : ""}
                  </span>
                  <span className="pb-2 text-hud-lg font-extrabold text-stage-text/45">/100</span>
                </motion.div>
                <p className={`mt-2 text-center text-base font-extrabold ${scoreText(overallScore)}`}>
                  {scoreKind === "visibility" ? "How well the camera saw you" : scoreLabel(overallScore)}
                </p>

                {/*
                  Say what the number is built from when that changes what it
                  means. A 78 from 30% of the run and a 78 from 95% of it are
                  different claims, and the card used to print them
                  identically — which is most of why the scoring "feels
                  weird": it was confidently describing a run it had barely
                  seen. Silent above the threshold; a number that has to
                  explain itself every time is a number nobody trusts.
                */}
                {scoreKind === "visibility" ? (
                  <p className="mt-3 rounded-xl border border-duo-gold/40 bg-duo-gold/15 px-3 py-2.5 text-center text-hud font-bold leading-relaxed text-stage-text">
                    This is not a sync score. The reference poses were not
                    available for this take, so there was nothing to compare
                    against — this only reflects how clearly the camera saw
                    your body. Re-run the scan and dance it again for a real score.
                  </p>
                ) : coverage < LOW_COVERAGE ? (
                  <p className="mt-3 rounded-xl border border-duo-gold/40 bg-duo-gold/15 px-3 py-2.5 text-center text-hud font-bold leading-relaxed text-stage-text">
                    Only {Math.round(coverage * 100)}% of this run could be scored — the
                    camera lost your body for the rest. Step back so your whole
                    body is in frame, and add light in front of you rather than behind.
                  </p>
                ) : null}

                {/* Body parts, worst first — the part you act on. */}
                {regionScores && (() => {
                  const ranked = REGION_ORDER
                    .filter(r => regionScores[r] >= 0)
                    .sort((a, b) => regionScores[a] - regionScores[b]);
                  return ranked.length > 0 ? (
                    <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-white/[0.07] p-3">
                      {ranked.map((r, i) => (
                        <motion.div
                          key={r}
                          initial={{ opacity: 0, x: -8 }}
                          animate={revealPhase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                          transition={{ duration: SEC.ENTER, delay: staggerDelay(i, ranked.length) }}
                        >
                          <RegionBar region={r} score={regionScores[r]} />
                        </motion.div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {saveError && (
                  <p className="mt-4 rounded-xl border border-duo-red/40 bg-duo-red/20 px-3 py-2.5 text-center text-hud font-bold text-stage-text">
                    {saveError}
                  </p>
                )}

                {/*
                  The character, and the only four moments it is allowed to
                  appear (WS5). Celebrating above 80, Thinking below — the art
                  reacts to the run rather than decorating it, and a grinning
                  mascot over a 40 would read as sarcasm. It never appears on
                  the practice stage; nothing decorative belongs over a camera
                  feed you are trying to read from ten feet.
                */}
                <motion.div
                  className="pointer-events-none mt-4 flex justify-center"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={revealPhase >= 3 ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
                  transition={SPRING_POP}
                  aria-hidden="true"
                >
                  {/* tone="stage": the art is black line-work with white fills,
                      which is correct on paper and invisible on this card —
                      black strokes on #0B0B0C leave the head and body floating
                      as unattached blobs. */}
                  {overallScore >= 80
                    ? <CelebratingCharacter size="sm" tone="stage" />
                    : <ThinkingCharacter size="sm" tone="stage" />}
                </motion.div>

                <motion.div
                  className="mt-5 flex flex-col gap-2"
                  initial={{ opacity: 0, y: 6 }}
                  animate={revealPhase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={{ duration: SEC.ENTER }}
                >
                  <Pressable
                    block
                    variant="primary"
                    size="lg"
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
                  >
                    {saving ? (
                      <>
                        <span className="h-4 w-4 animate-spin motion-reduce:animate-pulse rounded-full border-2 border-white/30 border-t-white" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Save this run
                      </>
                    )}
                  </Pressable>

                  <div className="flex gap-2">
                    <Pressable block variant="stage" size="md" onClick={() => setResultsOpen(false)}>
                      Watch it back
                    </Pressable>
                    <Pressable block variant="stage" size="md" onClick={onPracticeAgain}>
                      Practise again
                    </Pressable>
                  </div>
                </motion.div>
              </Panel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom floating playback bar ───────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-2 pt-2"
        style={{ paddingBottom: BOTTOM_SAFE }}
      >
        <Panel tone="stage" radius="2xl" className="px-3 py-3 sm:px-4">

          {/* Score-per-moment strip, sitting directly above the scrubber it
              indexes. 6px tall rather than 1.5 — it is the only place the shape
              of the run is visible. */}
          {timelineBins.length > 0 && (
            <div className="mb-1.5 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden>
              {timelineBins.map((score, i) => (
                <div
                  key={i}
                  className={`flex-1 ${score !== null ? scoreBg(score) : "bg-white/15"}`}
                />
              ))}
            </div>
          )}

          {/*
            Scrub bar. Was a 8px strip whose handle was `opacity-0
            group-hover:opacity-100` — on a phone there is no hover, so the
            handle never appeared at all. Same fix as TraceTab: a 44px pointer
            area with the visible track centred inside it, and a playhead that
            is always drawn.
          */}
          <div
            className="group relative flex h-11 cursor-pointer items-center"
            onClick={handleTimelineClick}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(effectiveDuration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${fmt(currentTime)} of ${fmt(effectiveDuration)}`}
            tabIndex={0}
          >
            <div className="relative h-2 w-full rounded-full bg-white/20">
              <div
                className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-duo-green"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-stage bg-duo-green shadow-stage-sm"
                style={{ left: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Transport row — one scrolling row, never wrapping. Wrapping made
              the panel's height change as controls appeared. */}
          <div className="scrollbar-hide -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            <IconButton
              aria-label={playing ? "Pause" : "Play"}
              tone="stage-solid"
              visual="md"
              onClick={togglePlay}
            >
              {playing
                ? <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
                : <svg className="h-5 w-5 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              }
            </IconButton>

            <span className="min-w-[5.5rem] shrink-0 text-center font-mono text-hud tabular-nums text-stage-text/80">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <Segmented
              label="Playback speed"
              tone="stage"
              className="shrink-0"
              value={String(speed)}
              onChange={(v) => {
                const s = parseFloat(v);
                setSpeed(s);
                if (userVideoRef.current) userVideoRef.current.playbackRate = s;
                if (proVideoRef.current)  proVideoRef.current.playbackRate  = s;
              }}
              options={SPEEDS.map(s => ({ value: String(s), label: `${s}x` }))}
            />
          </div>

          {/* Compare mode — its own row above the scrolling one, because it
              changes what every control below it means and must not be
              scrollable off-screen. */}
          <div className="mt-2 border-t border-white/10 pt-3">
            <Segmented
              label="Comparison view"
              tone="stage"
              value={compareMode}
              onChange={v => setCompareMode(v)}
              options={[
                { value: "overlay", label: "Overlay" },
                { value: "stacked", label: "Side by side" },
              ]}
            />
          </div>

          {/* Overlay controls row */}
          <div className="scrollbar-hide -mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1 pb-1 pt-1">
            <TogglePill active={mirrored} onClick={() => setMirrored(m => !m)} accent="blue" tone="stage">
              Mirror {mirrored ? "on" : "off"}
            </TogglePill>

            {/* Opacity has no meaning when the two are side by side, and a
                control that does nothing is worse than one that is absent. */}
            {compareMode === "overlay" && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-hud font-bold text-stage-text/70">Ghost</span>
                <input type="range" min="10" max="90" value={overlayOpacity}
                  onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                  aria-label="Reference overlay opacity"
                  className="slider slider-stage w-24" />
                <span className="w-10 text-right text-hud tabular-nums text-stage-text/70">{overlayOpacity}%</span>
              </div>
            )}

            {compareMode === "overlay" && (
            <TogglePill
              active={framingExpanded}
              onClick={() => setFramingExpanded(x => !x)}
              accent="violet"
              tone="stage"
              className="ml-auto"
              icon={
                <svg className={`h-3.5 w-3.5 transition-transform duration-150 ease-out-strong motion-reduce:transition-none ${framingExpanded ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              }
            >
              Framing
            </TogglePill>
            )}
          </div>

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
                  <SyncSlider label="X offset" min={-300} max={300} step={1}
                    value={proOffsetX} onChange={v => setProOffsetX(Math.round(v))}
                    display={`${proOffsetX > 0 ? "+" : ""}${proOffsetX}px`} />
                  <SyncSlider label="Y offset" min={-300} max={300} step={1}
                    value={proOffsetY} onChange={v => setProOffsetY(Math.round(v))}
                    display={`${proOffsetY > 0 ? "+" : ""}${proOffsetY}px`} />
                  <SyncSlider label="Zoom" min={0.3} max={3.0} step={0.05}
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
        </Panel>
      </div>
    </div>
  );
}

// ── Region bar ──────────────────────────────────────────────────────────

/**
 * One body region: a colour that matches the overlay, the label, a bar, and the
 * number. The old version put the label at 10px, the number at 10px and an
 * extra "{n}% off" at 9px — three sizes below the stage's 12px floor, in a
 * 16px-wide column that truncated "Right Arm" to "Right A…".
 */
function RegionBar({ region, score }: { region: RegionName; score: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${REGION_DOT[region]}`} />
      <span className="w-20 shrink-0 text-hud font-bold text-stage-text/80">{REGION_LABELS[region]}</span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
        <span
          className={`block h-full rounded-full ${REGION_DOT[region]}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </span>
      <span className={`w-10 shrink-0 text-right text-hud font-extrabold tabular-nums ${scoreText(score)}`}>
        {score}%
      </span>
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
