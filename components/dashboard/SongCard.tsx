"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import ProgressGraph from "./ProgressGraph";
import { BAND_FILL, BAND_LABEL, BAND_SOFT, scoreBand } from "./score";
import { useSignedUrl } from "@/lib/useSignedUrl";
import type { SongGroup } from "@/app/api/progress/route";

/**
 * The centre of the dashboard.
 *
 * A song card has to answer three questions from across a room: *what did I
 * practise*, *how did it go*, *what do I do next*. The old card answered none
 * of them at a glance — the score was a 14px number inside a 44px ring, the
 * meta line was 11px at `clay/40`, "Best" was a 10px label stacked over a 14px
 * number, and the only action was buried two taps deep behind an accordion and
 * a modal that said "Upload a new video to practice this routine" before
 * linking to the page that says exactly that.
 *
 * Now: the score is the biggest thing on the card, the change since last time
 * sits next to it as a signed number, a meter shows latest against best, and
 * "Practise again" is a full-width green pressable that is always visible and
 * goes straight to the upload page. Everything else — the trend, what to work
 * on, the per-region breakdown, delete — is behind the disclosure, because it
 * is what you read *after* you have decided to look closer.
 */

const REGION_LABELS: Record<string, string> = {
  leftArm: "Left arm", rightArm: "Right arm",
  leftLeg: "Left leg", rightLeg: "Right leg", torso: "Core",
};

const REGION_TIPS: Record<string, string> = {
  leftArm:  "Extend further on moves",
  rightArm: "Extend further on moves",
  leftLeg:  "Drive from the hip for cleaner lines",
  rightLeg: "Drive from the hip for cleaner lines",
  torso:    "Engage core for sharper hits",
};

const REGION_ORDER = Object.keys(REGION_LABELS);

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/* ── Bars ─────────────────────────────────────────────────────────────────
   Every bar prints its own number. The bar is the glance and the number is
   the fact, so nothing is only legible because a transform landed. */

function Meter({ value, className = "" }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative overflow-hidden rounded-full bg-ink/[0.07] ${className}`}>
      <motion.div
        className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${BAND_FILL[scoreBand(value)]}`}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: Math.max(value, 0) / 100 }}
        transition={{ duration: 0.44, ease: EASE_OUT }}
      />
    </div>
  );
}

function RegionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-bold text-clay">{label}</span>
      <Meter value={value} className="h-2.5 flex-1" />
      <span className="w-10 shrink-0 text-right text-sm font-extrabold tabular-nums text-ink">
        {value}%
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-hud uppercase tracking-[0.18em] text-clay/60">{children}</p>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */

interface SongCardProps {
  group: SongGroup;
  onDelete: (ids: string[]) => void;
}

export default function SongCard({ group, onDelete }: SongCardProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reduce = useReducedMotion();
  const bodyId = useId();

  const attempts = group.attempts;
  const latestRegions = attempts[attempts.length - 1]?.regions;
  const regionRows = latestRegions
    ? REGION_ORDER.filter(k => latestRegions[k] !== undefined)
    : [];

  const practiceHref = `/practice?song=${encodeURIComponent(group.title)}`;
  const sessionIds = attempts.map(a => a.id).filter(Boolean);
  const totalTraceSeconds = attempts.reduce((sum, a) => sum + (a.traceTime ?? 0), 0);
  const totalTraceMinutes = Math.round(totalTraceSeconds / 60);
  const { url: thumbnailSignedUrl, loading: thumbnailLoading } =
    useSignedUrl(group.thumbnailUrl ?? undefined);

  const band = scoreBand(group.latest);
  const previous = attempts.length > 1 ? attempts[attempts.length - 2].score : null;
  const delta = previous === null ? null : group.latest - previous;

  const needWork = latestRegions
    ? REGION_ORDER
        .filter(k => latestRegions[k] !== undefined)
        .map(k => ({ key: k, value: latestRegions[k]! }))
        .sort((a, b) => a.value - b.value)
        .filter(r => r.value < 70)
        .slice(0, 3)
    : [];

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: sessionIds }),
      });
      onDelete(sessionIds);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Panel tone="paper" radius="2xl" className="overflow-hidden">
      {/* ── Header — the disclosure ─────────────────────────────────────
          The whole strip is the target, so there is no 16px chevron to hit.
          `aria-expanded` + `aria-controls` rather than a rotating glyph alone. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 px-4 pt-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-duo-blue sm:px-5"
      >
        {/* Thumbnail */}
        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-duo-edge bg-brand-cream">
          {thumbnailSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailSignedUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-ink/25">
              {thumbnailLoading ? (
                <div className="h-4 w-8 rounded bg-ink/10 animate-pulse motion-reduce:animate-pulse" />
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold tracking-tight text-ink sm:text-lg">
            {group.title}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-clay/70">
            {attempts.length} attempt{attempts.length !== 1 ? "s" : ""} · avg {group.avg}%
            {totalTraceMinutes > 0 && ` · ${totalTraceMinutes} min`}
          </p>
        </div>

        {/* The score is the element, not a badge next to the title. */}
        <div className="shrink-0 text-right">
          <p className="text-3xl font-extrabold leading-none tabular-nums text-ink sm:text-4xl">
            {group.latest}
            <span className="text-base text-clay/50">%</span>
          </p>
          {/* `/12` is not on Tailwind's opacity scale, so `bg-duo-green/12`
              compiled to nothing and this chip had no plate at all — the
              delta read as bare text on white. `/10` is the tint `BAND_SOFT`
              already uses, so the chip now matches the band chip below it. */}
          {delta !== null && (
            <p
              className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-hud tabular-nums ${
                delta > 0 ? "bg-duo-green/10 text-ink"
                : delta < 0 ? "bg-duo-red/10 text-ink"
                : "bg-ink/[0.06] text-clay/70"
              }`}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="}
              {delta > 0 ? `+${delta}` : delta < 0 ? delta : "0"}
              <span className="sr-only"> points versus previous attempt</span>
            </p>
          )}
        </div>

        <svg
          className={`h-5 w-5 shrink-0 text-clay/40 transition-transform duration-200 ease-out-strong motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* ── Latest against best ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 sm:px-5">
        <Meter value={group.latest} className="h-3" />
        <div className="mt-1.5 flex items-center justify-between text-hud">
          <span className={`rounded-full px-1.5 py-0.5 text-ink/80 ${BAND_SOFT[band]}`}>
            {BAND_LABEL[band]}
          </span>
          <span className="tabular-nums text-clay/70">Best {group.best}%</span>
        </div>
      </div>

      {/* ── The one obvious action ──────────────────────────────────────── */}
      <div className="px-4 pb-4 pt-3.5 sm:px-5">
        <Pressable href={practiceHref} variant="primary" size="md" block>
          Practise again
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Pressable>
      </div>

      {/* ── Disclosure body ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t-2 border-duo-edge px-4 pb-5 pt-4 sm:px-5">

              {/* What to do next comes first — it is the only section that
                  tells the user what to change tomorrow. */}
              {latestRegions && (
                <div>
                  <SectionLabel>Work on next</SectionLabel>
                  {needWork.length === 0 ? (
                    <p className="mt-2 text-sm font-semibold text-ink">
                      Every region is above 70%. Try it at full speed.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {needWork.map(({ key, value }) => (
                        <li
                          key={key}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${BAND_SOFT[scoreBand(value)]}`}
                        >
                          <span className="text-lg font-extrabold tabular-nums leading-none text-ink">
                            {value}%
                          </span>
                          <span className="min-w-0 flex-1 text-xs font-medium text-clay">
                            <span className="font-extrabold text-ink">{REGION_LABELS[key]}</span>
                            {" — "}
                            {REGION_TIPS[key] ?? "Keep practising"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Trend */}
              <div>
                <SectionLabel>Progress</SectionLabel>
                <div className="mt-2">
                  <ProgressGraph attempts={attempts} />
                </div>
              </div>

              {/* Full breakdown */}
              {regionRows.length > 0 && (
                <div>
                  <SectionLabel>Latest by body part</SectionLabel>
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {regionRows.map(k => (
                      <RegionRow key={k} label={REGION_LABELS[k]} value={latestRegions![k]} />
                    ))}
                  </div>
                </div>
              )}

              {/* Destructive, last, and two-step. `danger` only appears on the
                  second press, so the resting card never shows a red button. */}
              <div className="flex flex-wrap items-center gap-2 border-t-2 border-duo-edge pt-4">
                <Pressable
                  variant={confirmDelete ? "danger" : "quiet"}
                  size="sm"
                  onClick={handleDelete}
                  loading={deleting}
                >
                  {!deleting && (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6m3 0v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6" />
                    </svg>
                  )}
                  {confirmDelete
                    ? `Delete ${sessionIds.length} session${sessionIds.length !== 1 ? "s" : ""}`
                    : "Delete"}
                </Pressable>

                {confirmDelete && !deleting && (
                  <Pressable variant="quiet" size="sm" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Pressable>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
