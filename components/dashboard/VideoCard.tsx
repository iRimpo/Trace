"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSignedUrl } from "@/lib/useSignedUrl";

interface VideoCardProps {
  id: string;
  title: string;
  createdAt: string;
  videoUrl: string;
  syncScore?: number | null;
  videoSource?: "youtube" | "tiktok" | "upload";
  onDelete?: (id: string) => void;
}

export default function VideoCard({ id, title, createdAt, videoUrl, syncScore, videoSource, onDelete }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { url: resolvedUrl } = useSignedUrl(videoUrl || undefined);
  const isUpload = videoSource === "upload";

  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!showConfirm) { setShowConfirm(true); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/videos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) onDelete?.(id);
    } catch { /* ignore */ }
    setDeleting(false);
    setShowConfirm(false);
  }

  const cardContent = (
    <>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-zinc-100 to-zinc-50">
        {resolvedUrl && !thumbFailed && !isUpload && (
          <video
            ref={videoRef}
            src={resolvedUrl}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${thumbReady ? "opacity-100" : "opacity-0"}`}
            muted playsInline preload="metadata"
            onLoadedData={() => setThumbReady(true)}
            onError={() => setThumbFailed(true)}
          />
        )}

        {(!thumbReady || isUpload) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 text-zinc-300">
              {isUpload ? (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              ) : (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Play overlay — only for non-upload cards */}
        {!isUpload && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/25">
            <div className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-xl backdrop-blur transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#6366f1" className="ml-0.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        {/* Gradient bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Source / score badge */}
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
          {isUpload && (
            <span className="rounded-md bg-amber-500/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              File upload
            </span>
          )}
          <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {syncScore != null ? `${syncScore}%` : "--"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="truncate text-sm font-semibold text-zinc-900 group-hover:text-brand-primary transition-colors duration-200">
          {title}
        </h3>
        <p className="mt-1 text-xs text-zinc-400">
          {date}
          {isUpload && <span className="ml-2 text-amber-500">· Session only</span>}
        </p>
        {isUpload && (
          <p className="mt-1.5 text-[11px] text-zinc-400" title="Upload the video to YouTube and use the URL to practice again">
            Upload to YouTube to practice again
          </p>
        )}
      </div>
    </>
  );

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-lg transition-shadow duration-300"
    >
      {isUpload ? (
        <div className="block cursor-default">{cardContent}</div>
      ) : (
        <Link href={`/practice/${id}`} className="block">{cardContent}</Link>
      )}

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className={`absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold backdrop-blur-sm transition-all ${
          showConfirm
            ? "bg-red-500 text-white opacity-100"
            : "bg-black/40 text-white/70 opacity-0 hover:bg-red-500 hover:text-white group-hover:opacity-100"
        }`}
      >
        {deleting ? (
          <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {showConfirm ? "Confirm?" : "Delete"}
      </button>
    </motion.div>
  );
}
