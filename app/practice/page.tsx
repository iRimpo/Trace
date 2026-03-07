"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowLeft, FaUpload, FaFilm, FaArrowRight, FaCheckCircle, FaExclamationCircle, FaTimes } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/posthog";
import { track as trackProduct } from "@/lib/analytics";
import { storeVideoSession } from "@/lib/sessionVideoStorage";

type UploadState = "idle" | "uploading" | "success" | "error";

const MAX_FILE_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Captures a 160×90 JPEG frame from the first available frame of the video. Returns null on any failure. */
async function captureVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.onloadeddata = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 160; canvas.height = 90;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
        const vW = video.videoWidth, vH = video.videoHeight;
        const vAspect = vW / vH, cAspect = 160 / 90;
        let sx = 0, sy = 0, sw = vW, sh = vH;
        if (vAspect > cAspect) { sw = vH * cAspect; sx = (vW - sw) / 2; }
        else { sh = vW / cAspect; sy = (vH - sh) / 2; }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 160, 90);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      } catch { URL.revokeObjectURL(url); resolve(null); }
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function PracticePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState("");
  const [songName, setSongName]       = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive]   = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Pre-fill from ?song= param (Practice Again flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pre = params.get("song");
    if (pre) setSongName(pre);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return "Invalid format. Please use MP4, MOV, or WebM.";
    if (file.size > MAX_FILE_SIZE) return `File too large (${formatFileSize(file.size)}). Maximum size is 200MB.`;
    return null;
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError("");
    setSelectedFile(file);
    captureVideoThumbnail(file).then(t => setThumbnailUrl(t));
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploadState("uploading");
    setError("");
    setProgress(0);

    try {
      setProgress(50);
      const blobUrl = URL.createObjectURL(selectedFile);
      storeVideoSession({ blobUrl, fileName: selectedFile.name, songName: songName.trim(), thumbnailUrl: thumbnailUrl ?? undefined, createdAt: Date.now() });
      setProgress(100);
      setUploadState("success");
      track("video_uploaded", { mode: "file" });
      trackProduct("video_uploaded", { source: "upload", mode: "file" });
      setTimeout(() => router.push("/practice/session"), 1000);
    } catch (err) {
      setUploadState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [selectedFile, songName, thumbnailUrl, router]);

  const resetUpload = useCallback(() => {
    setUploadState("idle");
    setProgress(0);
    setError("");
    setSelectedFile(null);
    setSongName("");
    setThumbnailUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f4e0]">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#1a0f00]/10" />
          <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1a0f00]"
            animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const canUpload = !!selectedFile && !error && songName.trim().length >= 3;

  return (
    <div className="min-h-screen bg-[#f8f4e0]">
      {/* Header */}
      <header className="border-b border-[#1a0f00]/08 bg-[#f8f4e0]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/dashboard"
            className="flex items-center gap-2 text-sm text-[#1a0f00]/40 hover:text-[#1a0f00] transition-colors">
            <FaArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <Link href="/" className="flex items-center">
            <img src="/trace_logo.svg" width="32" height="32" alt="Trace" className="rounded-full" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center">
          <span className="font-mono text-xs font-bold tracking-widest text-[#1a0f00]/30 uppercase">New Session</span>
          <h1 className="mt-2 font-bold text-3xl tracking-tight text-[#1a0f00] sm:text-4xl">
            Upload your dance video
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5c3d1a]/50">
            Upload a reference video and we&apos;ll help you master every move.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 rounded-3xl border border-[#1a0f00]/08 bg-white p-6 shadow-sm sm:p-8">

          {/* Song or trend name (required) */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-semibold text-[#1a0f00]/40 uppercase tracking-widest">
              Song or Trend Name
            </label>
            <input type="text" value={songName} onChange={(e) => setSongName(e.target.value)}
              placeholder="e.g., APT - Rose & Bruno Mars"
              maxLength={100}
              className="w-full rounded-xl border border-[#1a0f00]/10 bg-[#f8f4e0]/60 px-4 py-3 text-sm text-[#1a0f00] placeholder:text-[#1a0f00]/25 outline-none transition-all focus:border-[#080808]/30 focus:ring-2 focus:ring-[#080808]/08" />
            <p className="mt-1 text-[11px] text-[#1a0f00]/25">Required · Used to group your practice sessions</p>
          </div>

          <AnimatePresence mode="wait">
            {/* ── File Upload ── */}
            {uploadState !== "uploading" && uploadState !== "success" && (
              <motion.div key="file-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!selectedFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 sm:p-12 ${
                      dragActive
                        ? "border-[#080808] bg-[#080808]/5"
                        : "border-[#1a0f00]/10 hover:border-[#080808]/30 hover:bg-[#080808]/3"
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} className="hidden" />
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                      dragActive ? "bg-[#080808]/15" : "bg-[#080808]/06 group-hover:bg-[#080808]/12"
                    }`}>
                      <FaUpload className={`text-xl transition-colors ${dragActive ? "text-[#080808]" : "text-[#1a0f00]/30 group-hover:text-[#080808]"}`} />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[#1a0f00]">
                      <span className="hidden sm:inline">Drag &amp; drop your video here</span>
                      <span className="sm:hidden">Tap to select a video</span>
                    </p>
                    <p className="mt-1 text-xs text-[#1a0f00]/30">
                      <span className="hidden sm:inline">or click to browse</span>
                      <span className="sm:hidden">MP4, MOV, or WebM</span>
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {["MP4", "MOV", "WebM"].map((f) => (
                        <span key={f} className="rounded-full bg-[#080808]/06 px-3 py-1 text-[10px] font-bold text-[#1a0f00]/50">{f}</span>
                      ))}
                      <span className="text-[10px] text-[#1a0f00]/20">Max 200MB</span>
                    </div>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[#080808]/12 bg-[#080808]/5 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#080808]/10">
                        <FaFilm className="text-[#1a0f00] text-lg" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-[#1a0f00]">{selectedFile.name}</p>
                        <p className="mt-0.5 text-xs text-[#1a0f00]/30">{formatFileSize(selectedFile.size)}</p>
                      </div>
                      <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="rounded-lg p-1.5 text-[#1a0f00]/20 hover:bg-[#1a0f00]/5 hover:text-[#1a0f00]/50 transition-colors">
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── Uploading ── */}
            {uploadState === "uploading" && (
              <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center">
                <div className="relative mx-auto h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-2 border-[#1a0f00]/10" />
                  <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#080808]"
                    animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute inset-2 rounded-full border-2 border-transparent border-t-[#00D4FF]"
                    animate={{ rotate: -360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} />
                </div>
                <p className="mt-5 text-sm font-semibold text-[#1a0f00]">Preparing your session...</p>
                <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-[#1a0f00]/08">
                  <motion.div className="h-full rounded-full bg-[#080808]"
                    style={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.3 }} />
                </div>
                <p className="mt-2 text-xs text-[#1a0f00]/30">{Math.round(progress)}%</p>
              </motion.div>
            )}

            {/* ── Success ── */}
            {uploadState === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: "backOut" }} className="py-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#34D399]/15">
                  <FaCheckCircle className="text-[#34D399] text-3xl" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#1a0f00]">Video ready!</p>
                <p className="mt-1 text-xs text-[#1a0f00]/30">Redirecting to your session...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <FaExclamationCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <p className="text-xs leading-relaxed text-red-500">{error}</p>
            </motion.div>
          )}

          {/* Actions */}
          {uploadState !== "uploading" && uploadState !== "success" && (
            <div className="mt-6 flex items-center gap-3">
              {uploadState === "error" && (
                <button onClick={resetUpload}
                  className="rounded-full border border-[#1a0f00]/10 px-5 py-3 text-sm font-medium text-[#1a0f00]/50 hover:border-[#1a0f00]/20 hover:text-[#1a0f00] transition-all">
                  Reset
                </button>
              )}
              <button onClick={handleUpload} disabled={!canUpload}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all duration-200 ${
                  canUpload
                    ? "bg-[#080808] text-white shadow-lg hover:bg-[#1a1a1a] active:scale-[0.98]"
                    : "cursor-not-allowed bg-[#1a0f00]/08 text-[#1a0f00]/25"
                }`}>
                {uploadState === "error" ? "Retry" : "Start Session"}
                {canUpload && <FaArrowRight className="text-xs" />}
              </button>
            </div>
          )}
        </motion.div>

        <p className="mt-6 text-center text-xs leading-relaxed text-[#1a0f00]/20">
          Supported: MP4, MOV, WebM · Max 200MB · Session-only (not stored permanently)
        </p>
      </main>
    </div>
  );
}
