"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaPlay, FaTrash } from "react-icons/fa";
import { useSignedUrl } from "@/lib/useSignedUrl";

interface VideoCardProps {
  id: string;
  title: string;
  createdAt: string;
  videoUrl: string;
  onDelete?: (id: string) => void;
}

export default function VideoCard({ id, title, createdAt, videoUrl, onDelete }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { url: resolvedUrl } = useSignedUrl(videoUrl);

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

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-2xl border border-brand-primary/8 bg-white shadow-sm hover:shadow-xl hover:shadow-brand-primary/8 transition-shadow duration-300"
    >
      <Link href={`/practice/${id}`} className="block">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-brand-primary/15 via-brand-purple/10 to-brand-accent/15">
          {resolvedUrl && !thumbFailed && (
            <video
              ref={videoRef}
              src={resolvedUrl}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${thumbReady ? "opacity-100" : "opacity-0"}`}
              muted playsInline preload="metadata"
              onLoadedData={() => setThumbReady(true)}
              onError={() => setThumbFailed(true)}
            />
          )}

          {!thumbReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 text-brand-primary/20">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-brand-dark/0 transition-all duration-300 group-hover:bg-brand-dark/25">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              whileHover={{ scale: 1 }}
              className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-xl backdrop-blur transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
            >
              <FaPlay className="ml-0.5 h-4 w-4 text-brand-primary" />
            </motion.div>
          </div>

          {/* Gradient bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="truncate text-sm font-semibold text-brand-dark group-hover:text-brand-primary transition-colors duration-200">
            {title}
          </h3>
          <p className="mt-1 text-xs text-brand-dark/30">{date}</p>
        </div>
      </Link>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className={`absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold backdrop-blur-sm transition-all ${
          showConfirm
            ? "bg-brand-accent text-white opacity-100"
            : "bg-black/40 text-white/70 opacity-0 hover:bg-brand-accent hover:text-white group-hover:opacity-100"
        }`}
      >
        {deleting ? (
          <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
        ) : (
          <FaTrash className="h-2.5 w-2.5" />
        )}
        {showConfirm ? "Confirm?" : "Delete"}
      </button>
    </motion.div>
  );
}
