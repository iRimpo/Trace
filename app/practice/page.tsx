"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/posthog";
import { track as trackProduct } from "@/lib/analytics";
import { storeVideoSession } from "@/lib/sessionVideoStorage";
import { fileIdentity, identityKey } from "@/lib/videoIdentity";
import { putVideo, idbAvailable } from "@/lib/videoStore";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import IconButton from "@/components/ui/IconButton";
import Field from "@/components/ui/Field";
import { LoadingState } from "@/components/states/LoadingState";
import { ErrorState } from "@/components/states/ErrorState";
import { SuccessState } from "@/components/states/SuccessState";

/**
 * The moment a session begins.
 *
 * This page is the bridge between the dashboard and the practice stage and it
 * belonged to neither: it drew its own header, its own input, its own pill
 * buttons, its own two-ring spinner and its own success mark, in `react-icons`
 * glyphs that appear nowhere else in the app. Seven Font Awesome icons were
 * carrying about 40 pixels of artwork.
 *
 * It is now unambiguously paper: `Panel` cards on cream, `Field` for the one
 * input, `Pressable` for the one commit, solid `shadow-card` edges, and the
 * same loading / error / success vocabulary as the dashboard. Single-purpose
 * and confident — one name, one file, one green button.
 *
 * The data layer is untouched: identical validation, identical content-hash
 * identity, identical IndexedDB write, identical session handoff, identical
 * PostHog events.
 */

type UploadState = "idle" | "uploading" | "success" | "error";

const MAX_FILE_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MIN_NAME = 3;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

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

/** Read a video file's duration in seconds; null on failure. */
function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  });
}

/* ── Icons ───────────────────────────────────────────────────────────────
   Inline, stroked, 2.5 weight — the same hand as the rest of the app. */

function ArrowLeft() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

function UploadGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V4.5m0 0L7.5 9M12 4.5 16.5 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 15.5v3A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  );
}

function FilmGlyph() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path strokeLinecap="round" d="M7 4.5v15M17 4.5v15M2.5 12h19" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function PracticePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const reduce = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState("");
  const [songName, setSongName]       = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive]   = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

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
    getVideoDuration(file).then(d => setVideoDuration(d));
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
      setProgress(25);
      // Content-hash identity → shared scan cache + on-device persistence
      const identity = await fileIdentity(selectedFile);
      const key = identityKey(identity);
      setProgress(55);
      if (idbAvailable()) {
        await putVideo({
          key,
          blob: selectedFile,
          fileName: selectedFile.name,
          songName: songName.trim(),
          thumbnailUrl: thumbnailUrl ?? undefined,
        });
      }
      const blobUrl = URL.createObjectURL(selectedFile);
      storeVideoSession({ blobUrl, fileName: selectedFile.name, songName: songName.trim(), thumbnailUrl: thumbnailUrl ?? undefined, createdAt: Date.now(), identityKey: key });
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
    setVideoDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setVideoDuration(null);
    setThumbnailUrl(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <LoadingState message="Checking your session…" />
      </div>
    );
  }

  if (!user) return null;

  const nameShort   = songName.trim().length < MIN_NAME;
  const nameTouched = songName.length > 0;
  const canUpload   = !!selectedFile && !error && !nameShort;
  const busy        = uploadState === "uploading" || uploadState === "success";

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Same header geometry as the dashboard shell — 64px, a 2px cream-edge
          rule, the mark on the right — so crossing between them does not feel
          like crossing between apps. */}
      <header className="border-b-2 border-duo-edge bg-brand-cream">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Pressable href="/dashboard" variant="quiet" size="sm">
            <ArrowLeft />
            Dashboard
          </Pressable>
          <Link href="/" aria-label="Trace home" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/trace_logo.svg" width="34" height="34" alt="" className="rounded-full" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          // Offset only. Nothing on this page is hidden behind an animation.
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <p className="text-hud uppercase tracking-[0.2em] text-clay/60">New session</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Upload your dance video
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-clay/80">
            Trace overlays it on your camera so you can match every move.
          </p>

          <Panel tone="paper" radius="2xl" className="mt-6 p-5 sm:p-7">
            {/* ── Name ─────────────────────────────────────────────────── */}
            <Field
              label="Song or trend name"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              placeholder="e.g. APT — Rosé and Bruno Mars"
              maxLength={100}
              disabled={busy}
              autoComplete="off"
              action={
                <span className="text-hud text-clay/60">
                  {!nameTouched
                    ? "Required"
                    : nameShort
                      ? `${MIN_NAME - songName.trim().length} more character${MIN_NAME - songName.trim().length === 1 ? "" : "s"}`
                      : "Looks good"}
                </span>
              }
            />

            <div className="mt-5">
              {/* ── Pick a file ────────────────────────────────────────── */}
              {!busy && !selectedFile && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    className="hidden"
                  />
                  {/*
                    A real <button>, not a div with onClick. The drop zone was
                    the primary control on this page and it could not be
                    reached, focused or activated from a keyboard at all.
                  */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    className={[
                      "flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center sm:py-14",
                      "transition-[border-color,background-color,transform] duration-150 ease-out-strong",
                      "active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
                      "outline-none focus-visible:ring-2 focus-visible:ring-duo-blue focus-visible:ring-offset-2",
                      dragActive
                        ? "border-duo-blue bg-duo-blue/[0.07]"
                        : "border-duo-edge bg-brand-cream/50 [@media(hover:hover)and(pointer:fine)]:hover:border-duo-blue",
                    ].join(" ")}
                  >
                    <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${dragActive ? "bg-duo-blue text-white" : "bg-ink/[0.06] text-ink/60"}`}>
                      <UploadGlyph />
                    </span>
                    <span className="mt-4 text-lg font-extrabold tracking-tight text-ink">
                      <span className="hidden sm:inline">Drop your video here</span>
                      <span className="sm:hidden">Choose a video</span>
                    </span>
                    <span className="mt-1 text-sm font-medium text-clay/70">
                      <span className="hidden sm:inline">or click to browse · </span>
                      MP4, MOV or WebM · up to 200MB
                    </span>
                  </button>
                </>
              )}

              {/* ── Chosen ─────────────────────────────────────────────── */}
              {!busy && selectedFile && (
                <div className="rounded-2xl border-2 border-duo-edge p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-duo-green/10 text-duo-green">
                      <FilmGlyph />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold tracking-tight text-ink">
                        {selectedFile.name}
                      </p>
                      <p className="mt-0.5 text-hud text-clay/60">
                        {formatFileSize(selectedFile.size)}
                        {videoDuration !== null && ` · ${Math.max(1, Math.round(videoDuration))}s`}
                      </p>
                    </div>
                    <IconButton
                      aria-label="Remove this video"
                      title="Remove"
                      visual="md"
                      round={false}
                      onClick={clearFile}
                    >
                      <CloseGlyph />
                    </IconButton>
                  </div>

                  {videoDuration !== null && videoDuration > 60 && (
                    <p className="mt-3 rounded-xl bg-duo-gold/15 px-3 py-2.5 text-xs font-medium leading-relaxed text-ink/80">
                      <span className="font-extrabold">Long video.</span> Dancers learn in
                      sections — you&apos;ll pick the exact part to learn before practising,
                      and shorter sections scan much faster.
                    </p>
                  )}
                </div>
              )}

              {/* ── Working ────────────────────────────────────────────── */}
              {uploadState === "uploading" && (
                <div className="py-6" role="status" aria-live="polite">
                  <p className="text-center text-lg font-extrabold tracking-tight text-ink">
                    Preparing your session
                  </p>
                  <p className="mt-1 text-center text-sm font-medium text-clay/70">
                    Fingerprinting the file so it opens instantly next time.
                  </p>
                  {/* Transform, not width — a width transition relayouts every
                      frame of the one moment the user is watching. */}
                  <div className="mx-auto mt-5 h-3 max-w-xs overflow-hidden rounded-full bg-ink/[0.08]">
                    <motion.div
                      className="h-full w-full origin-left rounded-full bg-duo-green"
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: Math.min(progress, 100) / 100 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                    />
                  </div>
                  <p className="mt-2 text-center text-hud tabular-nums text-clay/60">
                    {Math.round(progress)}%
                  </p>
                </div>
              )}

              {/* ── Done ───────────────────────────────────────────────── */}
              {uploadState === "success" && (
                <SuccessState
                  message="Video ready"
                  detail="Taking you into the session…"
                  className="py-4"
                />
              )}
            </div>

            {/* ── Failure ──────────────────────────────────────────────── */}
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="upload-error"
                  initial={{ y: -6 }}
                  animate={{ y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <ErrorState
                    bare
                    title="That didn't work"
                    message={error}
                    className="px-0 pb-0 pt-6"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Commit ───────────────────────────────────────────────── */}
            {!busy && (
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                {uploadState === "error" && (
                  <Pressable variant="quiet" size="lg" onClick={resetUpload}>
                    Start over
                  </Pressable>
                )}
                <Pressable
                  variant="primary"
                  size="lg"
                  block
                  onClick={handleUpload}
                  disabled={!canUpload}
                >
                  {uploadState === "error" ? "Try again" : "Start session"}
                  <ArrowRight />
                </Pressable>
              </div>
            )}

            {/* Why the button is off, said in words rather than by greying out
                and leaving the user to guess which of two fields is at fault. */}
            {!busy && !canUpload && (
              <p className="mt-2.5 text-center text-xs font-semibold text-clay/70">
                {!selectedFile && nameShort
                  ? "Name the routine and choose a video to begin."
                  : !selectedFile
                    ? "Choose a video to begin."
                    : "Name the routine to begin."}
              </p>
            )}
          </Panel>

          <p className="mt-5 text-center text-xs font-medium leading-relaxed text-clay/60">
            MP4, MOV or WebM · up to 200MB. Your video is read on this device and
            saved here so the next session opens instantly.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
