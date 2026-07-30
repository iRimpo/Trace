"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import IconButton from "@/components/ui/IconButton";
import { Spinner } from "@/components/states/icons";
import { useSignedUrl } from "@/lib/useSignedUrl";

/**
 * A single saved video.
 *
 * NOTE: nothing imports this today — the dashboard renders `SongCard` and
 * `DeviceVideos`. It is redesigned rather than deleted because deleting a file
 * another agent may be about to wire up is the more expensive mistake, but if
 * it is still unreferenced at the end of the overhaul it should go.
 *
 * What was wrong: zinc borders and zinc text on a cream ground (the app has no
 * zinc), a blurred `hover:shadow-lg` where paper depth is a solid edge, a raw
 * indigo play triangle from no palette in particular, and a delete control
 * that was `opacity-0` until hover — invisible on the phone this runs on — at
 * roughly 26px square.
 */

interface VideoCardProps {
  id: string;
  title: string;
  createdAt: string;
  videoUrl: string;
  syncScore?: number | null;
  videoSource?: "youtube" | "tiktok" | "upload";
  onDelete?: (id: string) => void;
}

export default function VideoCard({
  id, title, createdAt, videoUrl, syncScore, videoSource, onDelete,
}: VideoCardProps) {
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

  async function handleDelete() {
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
      <div className="relative aspect-video bg-ink">
        {resolvedUrl && !thumbFailed && !isUpload && (
          <video
            ref={videoRef}
            src={resolvedUrl}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${thumbReady ? "opacity-100" : "opacity-0"}`}
            muted playsInline preload="metadata"
            onLoadedData={() => setThumbReady(true)}
            onError={() => setThumbFailed(true)}
          />
        )}

        {(!thumbReady || isUpload) && (
          <div className="absolute inset-0 flex items-center justify-center text-white/25">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              {isUpload ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              )}
            </svg>
          </div>
        )}

        {/* The score is the reason to look at this card, so it is a number, not
            a 10px chip: readable from the far side of the room. */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="rounded-xl bg-ink/80 px-2 py-1 text-hud tabular-nums text-white">
            {syncScore != null ? `${syncScore}%` : "No score"}
          </span>
          {isUpload && (
            <span className="rounded-xl bg-duo-gold px-2 py-1 text-hud text-ink">
              Session only
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate text-sm font-extrabold tracking-tight text-ink">{title}</h3>
        <p className="mt-1 text-hud text-clay/60">{date}</p>
        {isUpload && (
          <p className="mt-1.5 text-xs font-medium text-clay/70">
            Upload to YouTube to practise this again.
          </p>
        )}
      </div>
    </>
  );

  return (
    <Panel tone="paper" radius="2xl" className="relative overflow-hidden">
      {isUpload ? (
        <div>{cardContent}</div>
      ) : (
        <Link
          href={`/practice/${id}`}
          className="block outline-none transition-[transform] duration-[110ms] ease-out-strong active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-duo-blue motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {cardContent}
        </Link>
      )}

      {/* Two-step, and always visible — a delete you can only reach by hovering
          is a delete that does not exist on a phone. */}
      <IconButton
        aria-label={showConfirm ? `Confirm delete of ${title}` : `Delete ${title}`}
        title={showConfirm ? "Tap again to confirm" : "Delete"}
        tone="stage-solid"
        visual="sm"
        disabled={deleting}
        onClick={handleDelete}
        className={`absolute right-2 top-2 ${showConfirm ? "!border-duo-red !bg-duo-red !text-white" : ""}`}
      >
        {deleting ? (
          // `IconButton` has no `loading` prop — an icon-only control has no
          // label to sit beside a spinner — so the glyph swaps for the one
          // spinner the state vocabulary already owns.
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6m3 0v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6" />
          </svg>
        )}
      </IconButton>
    </Panel>
  );
}
