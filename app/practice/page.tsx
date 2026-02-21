"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowLeft, FaUpload, FaLink, FaFilm, FaArrowRight, FaCheckCircle, FaExclamationCircle, FaTimes } from "react-icons/fa";
import { FaCube } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

type UploadMode  = "file" | "url";
type UploadState = "idle" | "uploading" | "success" | "error";
type VideoPlatform = "youtube" | "tiktok" | null;

const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
const TIKTOK_REGEX  = /^(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com\/@[\w.-]+\/video\/(\d+)|vm\.tiktok\.com\/([\w-]+)|tiktok\.com\/t\/([\w-]+))/;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface ParsedVideoUrl {
  platform: VideoPlatform;
  id: string | null;
  url: string | null;
}

function parseVideoUrl(url: string): ParsedVideoUrl {
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch) return { platform: "youtube", id: ytMatch[1], url: `https://www.youtube.com/watch?v=${ytMatch[1]}` };
  const ttMatch = url.match(TIKTOK_REGEX);
  if (ttMatch) return { platform: "tiktok", id: ttMatch[1] || ttMatch[2] || ttMatch[3], url: url.trim() };
  return { platform: null, id: null, url: null };
}

export default function PracticePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode]               = useState<UploadMode>("file");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState("");
  const [title, setTitle]             = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive]   = useState(false);
  const [videoUrl, setVideoUrl]       = useState("");
  const [parsedVideo, setParsedVideo] = useState<ParsedVideoUrl>({ platform: null, id: null, url: null });

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return "Invalid format. Please use MP4, MOV, or WebM.";
    if (file.size > MAX_FILE_SIZE) return `File too large (${formatFileSize(file.size)}). Maximum size is 100MB.`;
    return null;
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError("");
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  }, [validateFile, title]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    setError("");
    if (url.trim()) {
      const parsed = parseVideoUrl(url);
      setParsedVideo(parsed);
      if (!parsed.id) setError("Invalid URL. Paste a YouTube or TikTok link.");
    } else {
      setParsedVideo({ platform: null, id: null, url: null });
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (mode === "file" && !selectedFile) return;
    if (mode === "url" && !parsedVideo.id) return;
    setUploadState("uploading");
    setError("");
    setProgress(0);

    try {
      if (mode === "file" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", title || selectedFile.name);
        const interval = setInterval(() => {
          setProgress((p) => { if (p >= 90) { clearInterval(interval); return 90; } return p + Math.random() * 15; });
        }, 300);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        clearInterval(interval);
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Upload failed"); }
        const data = await res.json();
        setProgress(100);
        setUploadState("success");
        setTimeout(() => router.push(`/practice/${data.video.id}`), 1500);
      }

      if (mode === "url" && parsedVideo.id) {
        setProgress(50);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_url: parsedVideo.url, platform: parsedVideo.platform, title: title || `${parsedVideo.platform === "tiktok" ? "TikTok" : "YouTube"} Video` }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save video"); }
        const data = await res.json();
        setProgress(100);
        setUploadState("success");
        setTimeout(() => router.push(`/practice/${data.video.id}`), 1500);
      }
    } catch (err) {
      setUploadState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [mode, selectedFile, parsedVideo, title, router]);

  const resetUpload = useCallback(() => {
    setUploadState("idle");
    setProgress(0);
    setError("");
    setSelectedFile(null);
    setVideoUrl("");
    setParsedVideo({ platform: null, id: null, url: null });
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20" />
          <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-primary"
            animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const canUpload = (mode === "file" && selectedFile && !error) || (mode === "url" && parsedVideo.id && !error);

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="border-b border-brand-primary/8 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/dashboard"
            className="flex items-center gap-2 text-sm text-brand-dark/40 hover:text-brand-dark transition-colors">
            <FaArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <FaCube className="text-brand-primary" />
            <span className="font-logo font-semibold text-lg text-brand-dark">Trace.</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center">
          <span className="font-mono text-xs font-bold tracking-widest text-brand-primary uppercase">New Session</span>
          <h1 className="mt-2 font-hero font-bold text-3xl tracking-tight text-brand-dark sm:text-4xl">
            Upload your dance video
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-dark/40">
            Upload a reference video and we&apos;ll help you master every move.
          </p>
        </motion.div>

        {/* Mode tabs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 flex items-center justify-center gap-1 rounded-2xl bg-white border border-brand-primary/8 p-1.5 shadow-sm">
          {([
            { id: "file" as UploadMode, icon: FaUpload, label: "Upload File" },
            { id: "url"  as UploadMode, icon: FaLink,   label: "Paste URL"   },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setMode(id); setError(""); }}
              className={`group flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                mode === id
                  ? "bg-gradient-to-r from-brand-primary to-blue-500 text-white shadow-md shadow-brand-primary/25"
                  : "text-brand-dark/40 hover:text-brand-dark/70"
              }`}>
              <Icon className="text-xs" />
              {label}
            </button>
          ))}
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 rounded-3xl border border-brand-primary/8 bg-white p-6 shadow-sm sm:p-8">

          {/* Title input */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-semibold text-brand-dark/40 uppercase tracking-widest">
              Video Title
            </label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hip-hop basics, Salsa turn pattern"
              className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/60 px-4 py-3 text-sm text-brand-dark placeholder:text-brand-dark/25 outline-none transition-all focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10" />
          </div>

          <AnimatePresence mode="wait">
            {/* ── File Upload ── */}
            {mode === "file" && uploadState !== "uploading" && uploadState !== "success" && (
              <motion.div key="file-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!selectedFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
                      dragActive
                        ? "border-brand-primary bg-brand-primary/5"
                        : "border-brand-dark/10 hover:border-brand-primary/40 hover:bg-brand-primary/3"
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} className="hidden" />
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                      dragActive ? "bg-brand-primary/20" : "bg-brand-primary/8 group-hover:bg-brand-primary/15"
                    }`}>
                      <FaUpload className={`text-xl transition-colors ${dragActive ? "text-brand-primary" : "text-brand-primary/50 group-hover:text-brand-primary"}`} />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-brand-dark">Drag & drop your video here</p>
                    <p className="mt-1 text-xs text-brand-dark/30">or click to browse</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {["MP4", "MOV", "WebM"].map((f) => (
                        <span key={f} className="rounded-full bg-brand-primary/8 px-3 py-1 text-[10px] font-bold text-brand-primary/60">{f}</span>
                      ))}
                      <span className="text-[10px] text-brand-dark/20">Max 100MB</span>
                    </div>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-brand-primary/15 bg-brand-primary/5 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/15">
                        <FaFilm className="text-brand-primary text-lg" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-brand-dark">{selectedFile.name}</p>
                        <p className="mt-0.5 text-xs text-brand-dark/30">{formatFileSize(selectedFile.size)}</p>
                      </div>
                      <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="rounded-lg p-1.5 text-brand-dark/20 hover:bg-brand-dark/5 hover:text-brand-dark/50 transition-colors">
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── URL Paste ── */}
            {mode === "url" && uploadState !== "uploading" && uploadState !== "success" && (
              <motion.div key="url-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input type="url" value={videoUrl} onChange={handleUrlChange}
                  placeholder="Paste a YouTube or TikTok link..."
                  className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/60 px-4 py-3 text-sm text-brand-dark placeholder:text-brand-dark/25 outline-none transition-all focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10" />
                {!parsedVideo.id && !error && (
                  <div className="mt-3 flex items-center justify-center gap-6 text-[11px] font-semibold text-brand-dark/25">
                    <span>YouTube</span>
                    <span className="h-1 w-1 rounded-full bg-brand-dark/20" />
                    <span>TikTok</span>
                  </div>
                )}
                {parsedVideo.platform === "youtube" && parsedVideo.id && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 overflow-hidden rounded-2xl border border-brand-primary/15">
                    <Image src={`https://img.youtube.com/vi/${parsedVideo.id}/hqdefault.jpg`}
                      alt="Video thumbnail" width={480} height={360}
                      className="aspect-video w-full object-cover" unoptimized />
                    <div className="flex items-center gap-2 border-t border-brand-primary/10 bg-brand-primary/5 px-4 py-2.5">
                      <span className="text-xs font-semibold text-brand-primary">YouTube video detected</span>
                    </div>
                  </motion.div>
                )}
                {parsedVideo.platform === "tiktok" && parsedVideo.id && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl border border-brand-primary/15 bg-brand-primary/5 px-5 py-4">
                    <p className="text-sm font-semibold text-brand-primary">TikTok video detected</p>
                    <p className="mt-0.5 text-xs text-brand-dark/30">Video will be imported for practice</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── Uploading ── */}
            {uploadState === "uploading" && (
              <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center">
                <div className="relative mx-auto h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20" />
                  <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-primary"
                    animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute inset-2 rounded-full border-2 border-transparent border-t-brand-accent"
                    animate={{ rotate: -360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} />
                </div>
                <p className="mt-5 text-sm font-semibold text-brand-dark">Uploading your video...</p>
                <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-brand-dark/8">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-primary to-blue-500"
                    style={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.3 }} />
                </div>
                <p className="mt-2 text-xs text-brand-dark/30">{Math.round(progress)}%</p>
              </motion.div>
            )}

            {/* ── Success ── */}
            {uploadState === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: "backOut" }} className="py-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
                  <FaCheckCircle className="text-brand-primary text-3xl" />
                </div>
                <p className="mt-4 text-sm font-semibold text-brand-dark">Video uploaded successfully!</p>
                <p className="mt-1 text-xs text-brand-dark/30">Redirecting to your session...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3">
              <FaExclamationCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-accent" />
              <p className="text-xs leading-relaxed text-brand-accent">{error}</p>
            </motion.div>
          )}

          {/* Actions */}
          {uploadState !== "uploading" && uploadState !== "success" && (
            <div className="mt-6 flex items-center gap-3">
              {uploadState === "error" && (
                <button onClick={resetUpload}
                  className="rounded-xl border border-brand-dark/10 px-5 py-3 text-sm font-medium text-brand-dark/50 hover:border-brand-dark/20 hover:text-brand-dark transition-all">
                  Reset
                </button>
              )}
              <button onClick={handleUpload} disabled={!canUpload}
                className={`group relative flex flex-1 items-center justify-center overflow-hidden rounded-full p-[2px] transition-all duration-200 ${
                  canUpload ? "bg-brand-dark shadow-lg shadow-brand-primary/20" : "cursor-not-allowed bg-brand-dark/10"
                }`}>
                {canUpload && (
                  <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[20]" />
                )}
                <span className={`relative z-10 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-noname font-semibold ${
                  canUpload ? "text-white" : "text-brand-dark/25"
                }`}>
                  {uploadState === "error" ? "Retry Upload" : "Upload Video"}
                  {canUpload && <FaArrowRight className="text-xs" />}
                </span>
              </button>
            </div>
          )}
        </motion.div>

        <p className="mt-6 text-center text-xs leading-relaxed text-brand-dark/20">
          Supported: MP4, MOV, WebM · Max 100MB · Stored securely, only visible to you.
        </p>
      </main>
    </div>
  );
}
