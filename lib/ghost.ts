import { Keypoint } from "./mediapipe";

// ── Ghost overlay settings ──────────────────────────────────────────

export interface GhostSettings {
  enabled: boolean;
  opacity: number; // 0 – 0.8
  color: string;
}

const DEFAULT_SETTINGS: GhostSettings = {
  enabled: true,
  opacity: 0.4,
  color: "#10B981",
};

const STORAGE_KEY = "trace-ghost-settings";

export function loadGhostSettings(): GhostSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return DEFAULT_SETTINGS;
}

export function saveGhostSettings(settings: GhostSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* noop */
  }
}

// ── Geometry helpers ────────────────────────────────────────────────

function mid(a: Keypoint, b: Keypoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// BlazePose 33-point indices (always used with MediaPipe Tasks Vision)
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;

function torsoLength(kps: Keypoint[]): number {
  return dist(
    mid(kps[L_SHOULDER], kps[R_SHOULDER]),
    mid(kps[L_HIP], kps[R_HIP])
  );
}

// ── Body normalization ──────────────────────────────────────────────

/**
 * Scale and translate professional keypoints so their torso matches the user's
 * body, aligned at the hip center.
 */
export function normalizeKeypoints(
  pro: Keypoint[],
  user: Keypoint[]
): Keypoint[] {
  const proTorso = torsoLength(pro);
  if (proTorso < 1) return pro;

  const scale = torsoLength(user) / proTorso;
  const proHip = mid(pro[L_HIP], pro[R_HIP]);
  const userHip = mid(user[L_HIP], user[R_HIP]);

  return pro.map((kp) => ({
    ...kp,
    x: (kp.x - proHip.x) * scale + userHip.x,
    y: (kp.y - proHip.y) * scale + userHip.y,
  }));
}

// ── Mirror mapping (left ↔ right) for comparison ───────────────────

// BlazePose 33-point: swap left/right keypoints
const MIRROR_MAP: number[] = [
  0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19,
  22, 21, 24, 23, 26, 25, 28, 27, 30, 29, 32, 31,
];

/**
 * Mirror professional keypoints for comparison with the user's webcam
 * (which is displayed as a mirror image).
 */
export function mirrorForComparison(
  proNormalized: Keypoint[],
  canvasWidth: number
): Keypoint[] {
  const mirrored: Keypoint[] = new Array(proNormalized.length);
  for (let i = 0; i < proNormalized.length; i++) {
    const src = proNormalized[MIRROR_MAP[i]];
    mirrored[i] = { ...src, x: canvasWidth - src.x };
  }
  return mirrored;
}

// ── Match scoring ───────────────────────────────────────────────────

export interface MatchResult {
  score: number; // 0 – 100
  matched: boolean[]; // per-keypoint
}

/**
 * Compare user keypoints with mirrored+normalized professional keypoints.
 * Returns a score (% of joints within threshold) and per-joint match flags.
 */
export function calculateMatchScore(
  userKps: Keypoint[],
  proMirrored: Keypoint[],
  threshold = 40,
  minConfidence = 0.3
): MatchResult {
  const matched: boolean[] = [];
  let good = 0;
  let total = 0;

  for (let i = 0; i < userKps.length; i++) {
    const u = userKps[i];
    const p = proMirrored[i];
    if (
      !u ||
      !p ||
      (u.score ?? 0) < minConfidence ||
      (p.score ?? 0) < minConfidence
    ) {
      matched.push(false);
      continue;
    }
    total++;
    const d = dist(u, p);
    const ok = d <= threshold;
    matched.push(ok);
    if (ok) good++;
  }

  return {
    score: total > 0 ? Math.round((good / total) * 100) : 0,
    matched,
  };
}
