import { Keypoint } from "./mediapipe";

// ── Ghost overlay settings ──────────────────────────────────────────

export interface GhostSettings {
  enabled: boolean;
  opacity: number; // 0 – 0.8
  color: string;              // retained for legacy / colorFeedback:false mode
  silhouetteMode?: boolean;   // default true
  colorFeedback?: boolean;    // default true
  feedbackThreshold?: number; // default 40 (px distance)
  transitionSpeed?: number;   // default 0.08 (lerp alpha)
}

const DEFAULT_SETTINGS: GhostSettings = {
  enabled: true,
  opacity: 0.4,
  color: "#EC4899",           // pink/magenta
  silhouetteMode: true,
  colorFeedback: true,
  feedbackThreshold: 40,
  transitionSpeed: 0.08,
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

// ── Ghost colors ─────────────────────────────────────────────────────

export const GHOST_COLORS = {
  target: "#EC4899", // PINK/MAGENTA — professional's target
  match:  "#10B981", // GREEN — user matches
  miss:   "#F97316", // ORANGE — user is off
  noData: "#EC4899", // pink when no user pose detected
};

// ── Body region definitions ──────────────────────────────────────────

export type RegionName =
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg"
  | "torso";

// Keypoints used for scoring each region
export const REGION_KEYPOINTS: Record<RegionName, number[]> = {
  head:     [0, 1, 2, 3, 4, 5, 6, 7, 8],
  torso:    [11, 12, 23, 24],
  leftArm:  [11, 13, 15, 17, 19, 21],
  rightArm: [12, 14, 16, 18, 20, 22],
  leftLeg:  [23, 25, 27, 29, 31],
  rightLeg: [24, 26, 28, 30, 32],
};

// [keypointA_index, keypointB_index, halfWidthPx_at_reference_scale]
export type CapsuleSegment = [number, number, number];

export const REGION_CAPSULES: Record<RegionName, CapsuleSegment[]> = {
  head:     [], // special-cased: draw ellipse
  torso:    [[11, 12, 18], [23, 24, 16], [11, 23, 14], [12, 24, 14]],
  leftArm:  [[11, 13, 10], [13, 15, 7]],
  rightArm: [[12, 14, 10], [14, 16, 7]],
  leftLeg:  [[23, 25, 12], [25, 27, 9]],
  rightLeg: [[24, 26, 12], [26, 28, 9]],
};

export const REGION_ORDER: RegionName[] = [
  "torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "head",
];

// ── Color utilities ──────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function lerpColorHex(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function regionScoreToTargetRgb(
  score: number,
  threshold = 60
): [number, number, number] {
  if (score < 0) return hexToRgb(GHOST_COLORS.noData);
  if (score >= threshold) return hexToRgb(GHOST_COLORS.match);
  return hexToRgb(GHOST_COLORS.miss);
}

// ── Geometry helpers ─────────────────────────────────────────────────

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

// ── Body normalization ───────────────────────────────────────────────

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

// ── Mirror mapping (left ↔ right) for comparison ────────────────────

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

// ── Match scoring ────────────────────────────────────────────────────

export interface MatchResult {
  score: number;    // 0 – 100
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

// ── Per-region match scoring ─────────────────────────────────────────

export interface RegionMatchResult {
  overall: MatchResult;
  regions: Record<RegionName, number>; // 0-100, or -1 if no data
}

/**
 * Like calculateMatchScore but also returns per-region scores (0-100 or -1 if
 * no keypoints above confidence threshold for that region).
 */
export function calculateRegionMatchScore(
  userKps: Keypoint[],
  proMirrored: Keypoint[],
  threshold = 40,
  minConfidence = 0.3
): RegionMatchResult {
  const overall = calculateMatchScore(
    userKps,
    proMirrored,
    threshold,
    minConfidence
  );

  const regions = {} as Record<RegionName, number>;

  for (const region of REGION_ORDER) {
    const indices = REGION_KEYPOINTS[region];
    let good = 0;
    let total = 0;
    for (const i of indices) {
      const u = userKps[i];
      const p = proMirrored[i];
      if (
        !u ||
        !p ||
        (u.score ?? 0) < minConfidence ||
        (p.score ?? 0) < minConfidence
      )
        continue;
      total++;
      if (Math.hypot(u.x - p.x, u.y - p.y) <= threshold) good++;
    }
    regions[region] = total > 0 ? Math.round((good / total) * 100) : -1;
  }

  return { overall, regions };
}
