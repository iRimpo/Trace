const JOINT_TRIPLETS = [
  [11, 13, 15], [12, 14, 16],
  [23, 11, 13], [24, 12, 14],
  [23, 25, 27], [24, 26, 28],
  [11, 23, 25], [12, 24, 26],
];

const REGION_TRIPLETS = {
  leftArm:  [[23, 11, 13], [11, 13, 15]],
  rightArm: [[24, 12, 14], [12, 14, 16]],
  leftLeg:  [[11, 23, 25], [23, 25, 27]],
  rightLeg: [[12, 24, 26], [24, 26, 28]],
  torso:    [[23, 11, 13], [24, 12, 14], [11, 23, 25], [12, 24, 26]],
};

const REGION_ORDER = ["torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];

function jointAngle(kps, vW, vH, p1, v, p2) {
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

function comparePoseScore(userKps, uW, uH, refKps, rW, rH) {
  let totalDiff = 0, count = 0;
  for (const [p1, v, p2] of JOINT_TRIPLETS) {
    const ua = jointAngle(userKps, uW, uH, p1, v, p2);
    const ra = jointAngle(refKps, rW, rH, p1, v, p2);
    if (ua === null || ra === null) continue;
    totalDiff += Math.abs(ua - ra);
    count++;
  }
  if (count < 2) return 50;
  const avgDiff = totalDiff / count;
  return Math.max(0, Math.min(100, Math.round((1 - avgDiff / 90) * 100)));
}

function compareRegionScores(userKps, uW, uH, refKps, rW, rH) {
  const result = {};
  for (const region of REGION_ORDER) {
    const triplets = REGION_TRIPLETS[region];
    if (!triplets || triplets.length === 0) { result[region] = -1; continue; }
    let totalDiff = 0, count = 0;
    for (const [p1, v, p2] of triplets) {
      const ua = jointAngle(userKps, uW, uH, p1, v, p2);
      const ra = jointAngle(refKps, rW, rH, p1, v, p2);
      if (ua === null || ra === null) continue;
      totalDiff += Math.abs(ua - ra);
      count++;
    }
    result[region] = count > 0 ? Math.max(0, Math.min(100, Math.round((1 - totalDiff / count / 90) * 100))) : -1;
  }
  return result;
}

self.onmessage = function (e) {
  const { userFrames, refFrames, uW, uH, rW, rH } = e.data;

  const sortedRef = [...refFrames].sort((a, b) => a.t - b.t);
  const regionAccum = {};
  for (const r of REGION_ORDER) regionAccum[r] = [];

  const scores = userFrames.map((frame) => {
    let lo = 0, hi = sortedRef.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedRef[mid].t < frame.t) lo = mid + 1; else hi = mid;
    }
    const nearest = sortedRef[lo];
    const score = comparePoseScore(frame.kps, uW, uH, nearest.kps, rW, rH);
    const regions = compareRegionScores(frame.kps, uW, uH, nearest.kps, rW, rH);
    for (const r of REGION_ORDER) {
      if (regions[r] >= 0) regionAccum[r].push(regions[r]);
    }
    return { t: frame.t, score };
  });

  const avgRegions = {};
  for (const r of REGION_ORDER) {
    const arr = regionAccum[r];
    avgRegions[r] = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : -1;
  }

  self.postMessage({ scores, regionScores: avgRegions });
};
