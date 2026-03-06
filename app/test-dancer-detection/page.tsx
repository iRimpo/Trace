"use client";

import { useRef, useState } from "react";
import { initPoseDetection, detectAllPosesFromFrame } from "@/lib/mediapipe";

interface FrameResult {
  timestamp: number;
  dancersFound: number;
  centers: { x: number; y: number }[];
}

interface Cluster {
  x: number;
  y: number;
  count: number;
}

function extractCenters(
  allPoses: { x: number; y: number; score?: number }[][],
  vW: number,
  vH: number,
): { x: number; y: number }[] {
  return allPoses
    .map(kps => {
      const lh = kps[23];
      const rh = kps[24];
      const ls = kps[11];
      const rs = kps[12];
      const hipsOk = lh && rh && (lh.score ?? 0) > 0.2 && (rh.score ?? 0) > 0.2;
      const ax = hipsOk ? (lh!.x + rh!.x) / 2 : ((ls?.x ?? 0) + (rs?.x ?? 0)) / 2;
      const ay = hipsOk ? (lh!.y + rh!.y) / 2 : ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
      return { x: ax / vW, y: ay / vH };
    });
}

const SKELETON_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [0, 11], [0, 12],
];

const DANCER_COLORS = ["#FF4444", "#44FF44", "#4488FF", "#FFFF44", "#FF44FF", "#44FFFF", "#FF8844", "#88FF44"];

export default function TestDancerDetection() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scanning,     setScanning]     = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames,  setTotalFrames]  = useState(0);
  const [results,      setResults]      = useState<FrameResult[]>([]);
  const [clusters,     setClusters]     = useState<Cluster[]>([]);
  const [log,          setLog]          = useState<string[]>([]);
  const [lastCanvas,   setLastCanvas]   = useState<string | null>(null);

  function addLog(msg: string) {
    console.log(msg);
    setLog(prev => [...prev, msg]);
  }

  async function seekAndSettle(video: HTMLVideoElement, t: number) {
    if (Math.abs(video.currentTime - t) < 0.05 && video.readyState >= 2) return;
    await new Promise<void>(resolve => {
      const timeout = setTimeout(resolve, 1500);
      video.addEventListener("seeked", () => { clearTimeout(timeout); resolve(); }, { once: true });
      video.currentTime = t;
    });
    await new Promise(r => setTimeout(r, 120));
  }

  async function runTest() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setScanning(true);
    setResults([]);
    setClusters([]);
    setLog([]);
    setLastCanvas(null);

    addLog("=== Starting Dancer Detection Test ===");

    await initPoseDetection();
    addLog("✓ MediaPipe initialized");

    // Wait for metadata
    if (video.readyState < 1) {
      await new Promise<void>(resolve => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      });
    }

    const duration = video.duration;
    addLog(`Video: ${video.videoWidth}×${video.videoHeight}, duration ${duration.toFixed(1)}s`);

    const NUM_SAMPLES = 20;
    const sampleTimes = Array.from({ length: NUM_SAMPLES }, (_, i) =>
      (i + 0.5) * (duration / NUM_SAMPLES),
    );
    setTotalFrames(NUM_SAMPLES);
    addLog(`Sampling ${NUM_SAMPLES} frames spread evenly`);
    addLog("─────────────────────────────────────");

    const allResults: FrameResult[] = [];
    const ctx = canvas.getContext("2d")!;

    for (let i = 0; i < sampleTimes.length; i++) {
      const t = sampleTimes[i];
      setCurrentFrame(i + 1);

      await seekAndSettle(video, t);

      const rawPoses = detectAllPosesFromFrame(video);
      // Sort left-to-right by hip-centre X so colour/number assignments stay
      // consistent across frames regardless of MediaPipe's detection order.
      const allPoses = rawPoses
        ? [...rawPoses].sort((a, b) => {
            const ax = a[23]?.x ?? a[11]?.x ?? 0;
            const bx = b[23]?.x ?? b[11]?.x ?? 0;
            return ax - bx;
          })
        : null;
      const count    = allPoses?.length ?? 0;

      addLog(`Frame ${String(i + 1).padStart(2)} @ ${t.toFixed(2)}s → ${count} dancer${count !== 1 ? "s" : ""}`);

      const centers = allPoses && count > 0
        ? extractCenters(allPoses as { x: number; y: number; score?: number }[][], video.videoWidth, video.videoHeight)
        : [];

      allResults.push({ timestamp: t, dancersFound: count, centers });

      // Draw visualization on last detected frame that has people
      if (count > 0) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        allPoses!.forEach((pose, idx) => {
          const color = DANCER_COLORS[idx % DANCER_COLORS.length];
          ctx.strokeStyle = color;
          ctx.lineWidth   = 3;

          for (const [a, b] of SKELETON_CONNECTIONS) {
            const ka = pose[a], kb = pose[b];
            if (!ka || !kb || (ka.score ?? 0) < 0.25 || (kb.score ?? 0) < 0.25) continue;
            ctx.beginPath();
            ctx.moveTo(ka.x, ka.y);
            ctx.lineTo(kb.x, kb.y);
            ctx.stroke();
          }

          // Hip-centre dot + number
          const lh = pose[23], rh = pose[24];
          if (lh && rh) {
            const cx = (lh.x + rh.x) / 2;
            const cy = (lh.y + rh.y) / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 18, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle   = "#000";
            ctx.font        = "bold 18px sans-serif";
            ctx.textAlign   = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(idx + 1), cx, cy);
          }
        });

        setLastCanvas(canvas.toDataURL("image/jpeg", 0.8));
      }
    }

    // ── Cluster across frames (same logic as CalibrationModal) ──────────────
    addLog("─────────────────────────────────────");
    addLog("Clustering across all frames (MERGE_DIST = 0.12):");

    const MERGE_DIST = 0.12;
    const foundClusters: Cluster[] = [];

    for (const det of allResults) {
      for (const c of det.centers) {
        let best = -1, bestD = Infinity;
        for (let i = 0; i < foundClusters.length; i++) {
          const d = (foundClusters[i].x - c.x) ** 2 + (foundClusters[i].y - c.y) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0 && bestD < MERGE_DIST ** 2) {
          const cl = foundClusters[best];
          const n  = cl.count + 1;
          cl.x = (cl.x * cl.count + c.x) / n;
          cl.y = (cl.y * cl.count + c.y) / n;
          cl.count = n;
        } else {
          foundClusters.push({ ...c, count: 1 });
        }
      }
    }

    foundClusters.sort((a, b) => a.x - b.x);

    addLog(`→ ${foundClusters.length} unique dancer(s) found`);
    foundClusters.forEach((cl, i) =>
      addLog(`  Dancer ${i + 1}: center (${cl.x.toFixed(3)}, ${cl.y.toFixed(3)}), seen in ${cl.count} frame(s)`),
    );

    const maxPerFrame = Math.max(...allResults.map(r => r.dancersFound), 0);
    addLog("─────────────────────────────────────");
    addLog(`Max dancers in single frame: ${maxPerFrame}`);
    addLog(`Final unique dancers (clusters): ${foundClusters.length}`);

    if (foundClusters.length <= 1 && maxPerFrame <= 1) {
      addLog("⚠️  Only 1 dancer detected — likely pose detection issue");
      addLog("   • Check numPoses in mediapipe.ts (should be ≥ 10)");
      addLog("   • Check video resolution / lighting");
    } else if (foundClusters.length <= 1 && maxPerFrame > 1) {
      addLog("⚠️  Multiple detected per frame but clustering collapsed to 1");
      addLog("   • MERGE_DIST 0.12 may be too large for this formation");
      addLog("   • Try reducing MERGE_DIST to 0.06");
    } else {
      addLog(`✓  ${foundClusters.length} dancers found — detection working correctly`);
    }

    setResults(allResults);
    setClusters(foundClusters);
    setScanning(false);
  }

  const maxDetected = results.length > 0 ? Math.max(...results.map(r => r.dancersFound)) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Dancer Detection Debug</h1>
        <p className="text-gray-400 mb-6 text-sm">Test video: /public/test-video.MOV</p>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Source video */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Source Video</h2>
            <video
              ref={videoRef}
              src="/test-video.MOV"
              className="w-full rounded-lg bg-black"
              controls
              playsInline
              muted
            />
          </div>

          {/* Detection canvas */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Last Detection Frame
            </h2>
            {lastCanvas
              ? <img src={lastCanvas} alt="detection" className="w-full rounded-lg" />
              : <div className="aspect-video rounded-lg bg-gray-900 flex items-center justify-center text-gray-600 text-sm">
                  Run test to see detections
                </div>
            }
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runTest}
          disabled={scanning}
          className="mb-6 px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {scanning ? `Scanning… ${currentFrame} / ${totalFrames}` : "Run Detection Test"}
        </button>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Log */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Console Log</h2>
            <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-y-auto font-mono text-xs leading-relaxed">
              {log.length === 0
                ? <span className="text-gray-600">Log will appear here…</span>
                : log.map((line, i) => (
                    <div key={i} className={
                      line.startsWith("✓") ? "text-green-400" :
                      line.startsWith("⚠") ? "text-yellow-400" :
                      line.startsWith("─") ? "text-gray-600" :
                      line.startsWith("→") ? "text-blue-400" :
                      "text-gray-300"
                    }>{line}</div>
                  ))
              }
            </div>
          </div>

          {/* Per-frame results */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Per-Frame Results
              {results.length > 0 && (
                <span className="ml-2 text-white normal-case font-normal">
                  — max {maxDetected} per frame, {clusters.length} unique cluster{clusters.length !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
            <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-y-auto space-y-1">
              {results.length === 0
                ? <span className="text-gray-600 text-sm">Results will appear here…</span>
                : results.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                      r.dancersFound >= 2 ? "bg-green-900/40" :
                      r.dancersFound === 1 ? "bg-gray-800" :
                      "bg-red-900/20"
                    }`}>
                      <span className="font-mono text-gray-400">
                        Frame {String(i + 1).padStart(2)} @ {r.timestamp.toFixed(2)}s
                      </span>
                      <span className={`font-bold ${
                        r.dancersFound >= 2 ? "text-green-400" :
                        r.dancersFound === 1 ? "text-gray-300" :
                        "text-red-400"
                      }`}>
                        {r.dancersFound} dancer{r.dancersFound !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Cluster summary */}
        {clusters.length > 0 && (
          <div className="mt-6 bg-gray-900 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Unique Dancers Found — {clusters.length}
            </h2>
            <div className="flex flex-wrap gap-3">
              {clusters.map((cl, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: DANCER_COLORS[i % DANCER_COLORS.length] }} />
                  <span className="text-sm font-medium">Dancer {i + 1}</span>
                  <span className="text-xs text-gray-500">({cl.x.toFixed(2)}, {cl.y.toFixed(2)})</span>
                  <span className="text-xs text-gray-600">seen {cl.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
