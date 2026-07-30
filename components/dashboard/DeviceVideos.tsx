"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaPlay, FaTrash } from "react-icons/fa";
import { listVideos, getVideo, deleteVideo, type StoredVideoMeta } from "@/lib/videoStore";
import { storeVideoSession } from "@/lib/sessionVideoStorage";
import { track } from "@/lib/posthog";

function fmtBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/**
 * Videos saved on this device — one tap back into practice, no re-upload,
 * no re-scan (the scan cache keys off the same identity).
 */
export default function DeviceVideos() {
  const router = useRouter();
  const [videos, setVideos] = useState<StoredVideoMeta[]>([]);
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  useEffect(() => {
    listVideos().then(setVideos);
  }, []);

  const openVideo = useCallback(async (meta: StoredVideoMeta) => {
    setOpeningKey(meta.key);
    const stored = await getVideo(meta.key);
    if (!stored) { setOpeningKey(null); return; }
    storeVideoSession({
      blobUrl: URL.createObjectURL(stored.blob),
      fileName: stored.fileName,
      songName: stored.songName,
      thumbnailUrl: stored.thumbnailUrl,
      createdAt: Date.now(),
      identityKey: stored.key,
    });
    track("device_video_reopened", { bytes: stored.bytes });
    router.push("/practice/session");
  }, [router]);

  const removeVideo = useCallback(async (key: string) => {
    await deleteVideo(key);
    setVideos(v => v.filter(m => m.key !== key));
  }, []);

  if (videos.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 font-bold text-lg tracking-tight text-ink">On this device</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {videos.map(meta => (
          <motion.div
            key={meta.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative w-44 flex-shrink-0 overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-sm"
          >
            <button
              onClick={() => openVideo(meta)}
              disabled={openingKey !== null}
              className="block w-full text-left"
            >
              <div className="relative flex h-24 w-full items-center justify-center bg-brand-primary">
                {meta.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <FaPlay className="text-white/30" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <FaPlay className={`text-white drop-shadow transition-opacity ${openingKey === meta.key ? "animate-pulse motion-reduce:animate-none opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-semibold text-ink">{meta.songName || meta.fileName}</p>
                <p className="mt-0.5 text-[10px] text-ink/30">{fmtBytes(meta.bytes)} · ready instantly</p>
              </div>
            </button>
            <button
              onClick={() => removeVideo(meta.key)}
              aria-label="Remove from this device"
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-[10px] text-white/70 opacity-0 backdrop-blur transition-opacity hover:text-white group-hover:opacity-100"
            >
              <FaTrash className="h-2.5 w-2.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
