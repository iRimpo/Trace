"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Panel from "@/components/ui/Panel";
import IconButton from "@/components/ui/IconButton";
import { listVideos, getVideo, deleteVideo, getResume, type StoredVideoMeta, type ResumeState } from "@/lib/videoStore";
import { storeVideoSession } from "@/lib/sessionVideoStorage";
import { track } from "@/lib/posthog";

/** `1:04 → 1:12`, or null when there is no section worth naming. */
function sectionLabel(r: ResumeState | undefined): string | null {
  if (!r || r.loopStart == null || r.loopEnd == null) return null;
  if (r.loopEnd - r.loopStart < 0.5) return null;
  const t = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return `${t(r.loopStart)} → ${t(r.loopEnd)}`;
}

function fmtBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function PlayGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5a1 1 0 0 1 1.53-.848l11 7.5a1 1 0 0 1 0 1.696l-11 7.5A1 1 0 0 1 7 19.5v-15Z" />
    </svg>
  );
}

/**
 * Videos saved on this device — one tap back into practice, no re-upload, no
 * re-scan (the scan cache keys off the same identity).
 *
 * Two things were broken here beyond the styling. The remove button was
 * `opacity-0 … group-hover:opacity-100` on a phone, where nothing ever hovers,
 * so it did not exist on the only device this app is used on — it is now always
 * visible with its own fill. And it was an `h-4` icon in a `p-1.5` box, roughly
 * 25px, well under the touch minimum; `IconButton` makes the hit area 44px
 * without growing the visual.
 *
 * `react-icons/fa` supplied the play and trash glyphs. Two icons is not worth a
 * second icon language on the page — filled Font Awesome next to the app's own
 * stroked SVGs reads as two different products stitched together.
 */
export default function DeviceVideos() {
  const router = useRouter();
  const [videos, setVideos] = useState<StoredVideoMeta[]>([]);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  /** Section state per video, so a tile can say what it will drop you back into. */
  const [resume, setResume] = useState<Record<string, ResumeState>>({});

  useEffect(() => {
    listVideos().then(async list => {
      setVideos(list);
      // One read per tile, in parallel, after the list has already painted —
      // resume is an enhancement and must not delay the tiles themselves.
      const entries = await Promise.all(
        list.map(async m => [m.key, await getResume(m.key)] as const),
      );
      setResume(Object.fromEntries(
        entries.filter((e): e is [string, ResumeState] => e[1] !== null),
      ));
    });
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
    <section className="mb-6">
      {/* Same geometry as "Your practice" below it — `mb-3`, centred, `gap-3`.
          Two section headers three rows apart cannot have two different
          baselines and two different margins. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">On this device</h2>
        <p className="text-hud uppercase tracking-[0.18em] text-clay/60">Ready instantly</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {videos.map((meta, i) => {
          const opening = openingKey === meta.key;
          return (
            <motion.div
              key={meta.key}
              // Deliberately no `initial` opacity: the tile is content, and a
              // failed animation must not be able to hide it. Only the offset
              // animates, so the worst case is a tile that starts in place.
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i, 5) * 0.04, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-44 shrink-0"
            >
              <Panel tone="paper" radius="xl" className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => openVideo(meta)}
                  disabled={openingKey !== null}
                  aria-label={`Open ${meta.songName || meta.fileName} in practice`}
                  className="block w-full text-left outline-none transition-[transform,opacity] duration-[110ms] ease-out-strong active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-duo-blue motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-60"
                >
                  <div className="relative flex h-24 w-full items-center justify-center bg-ink">
                    {meta.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={meta.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink ${opening ? "animate-pulse motion-reduce:animate-pulse" : ""}`}>
                        <PlayGlyph />
                      </span>
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-extrabold tracking-tight text-ink">
                      {meta.songName || meta.fileName}
                    </p>
                    {/*
                      What you will get back, stated rather than implied. P3 —
                      third session on the same song, wants bars 17–24 — was
                      re-marking the same section every time because loop points
                      lived in component state and died with the tab. The tile
                      now says the section is still there, which is the whole
                      difference between a tool you drill with and one you set
                      up. Falls back to the file size when there is nothing to
                      resume, so the line never goes empty.
                    */}
                    {sectionLabel(resume[meta.key]) ? (
                      <p className="mt-0.5 flex items-center gap-1 text-hud font-bold text-duo-blue">
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7z" />
                        </svg>
                        Resume {sectionLabel(resume[meta.key])}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-hud text-clay/60">{fmtBytes(meta.bytes)}</p>
                    )}
                  </div>
                </button>
              </Panel>

              {/* Always visible, never hover-gated — this is a touch device.
                  `stage-solid` because it sits on the dark thumbnail, not on
                  paper: a paper-toned control here would be invisible. */}
              <IconButton
                aria-label={`Remove ${meta.songName || meta.fileName} from this device`}
                title="Remove from this device"
                tone="stage-solid"
                visual="sm"
                onClick={() => removeVideo(meta.key)}
                className="absolute right-1.5 top-1.5"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6m3 0v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6" />
                </svg>
              </IconButton>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
