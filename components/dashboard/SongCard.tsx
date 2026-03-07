"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import ProgressGraph from "./ProgressGraph";
import { useSignedUrl } from "@/lib/useSignedUrl";
import type { SongGroup } from "@/app/api/progress/route";

const REGION_LABELS: Record<string, string> = {
  leftArm: "Left Arm", rightArm: "Right Arm",
  leftLeg: "Left Leg", rightLeg: "Right Leg", torso: "Core",
};

const PART_COLORS: Record<string, string> = {
  torso: "#A78BFA", leftArm: "#F97316", rightArm: "#00D4FF",
  leftLeg: "#F472B6", rightLeg: "#34D399",
};

const REGION_TIPS: Record<string, string> = {
  leftArm: "Extend further on moves",
  rightArm: "Extend further on moves",
  leftLeg: "Drive from the hip for cleaner lines",
  rightLeg: "Drive from the hip for cleaner lines",
  torso: "Engage core for sharper hits",
};

function scoreColor(s: number): string {
  if (s >= 80) return "#10B981";
  if (s >= 55) return "#EAB308";
  if (s >= 30) return "#F97316";
  return "#EF4444";
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 text-xs text-[#5c3d1a]/60">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#1a0f00]/08">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 text-right text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

interface SongCardProps {
  group: SongGroup;
  onDelete: (ids: string[]) => void;
}

export default function SongCard({ group, onDelete }: SongCardProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);

  const latestRegions = group.attempts[group.attempts.length - 1]?.regions;
  const allRegionKeys = Object.keys(REGION_LABELS);
  const regionRows = latestRegions
    ? allRegionKeys.filter(k => latestRegions[k] !== undefined)
    : [];

  const practiceHref = `/practice?song=${encodeURIComponent(group.title)}`;
  const borderColor = scoreColor(group.latest);
  const sessionIds = group.attempts.map(a => a.id).filter(Boolean);
  const totalTraceSeconds = group.attempts.reduce((sum, a) => sum + (a.traceTime ?? 0), 0);
  const totalTraceMinutes = Math.round(totalTraceSeconds / 60);
  const { url: thumbnailSignedUrl, loading: thumbnailLoading } = useSignedUrl(group.thumbnailUrl ?? undefined);

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
    <div
      className="rounded-2xl border border-[#1a0f00]/08 bg-white overflow-hidden shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[#1a0f00]/[0.02] transition-colors"
      >
        {/* Thumbnail or placeholder */}
        <div className="relative h-11 w-[52px] shrink-0 overflow-hidden rounded-lg bg-[#1a0f00]/06">
          {thumbnailSignedUrl ? (
            <img
              src={thumbnailSignedUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : thumbnailLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-4 animate-pulse rounded bg-[#1a0f00]/15" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#1a0f00]/25">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          )}
        </div>
        {/* Score ring */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black tabular-nums"
          style={{ borderColor, color: borderColor }}
        >
          {group.latest}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#1a0f00]">{group.title}</p>
          <p className="text-[11px] text-[#5c3d1a]/40">
            {group.attempts.length} attempt{group.attempts.length !== 1 ? "s" : ""} · Avg {group.avg}%
            {totalTraceMinutes > 0 && ` · ${totalTraceMinutes} min in Trace`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-medium text-[#5c3d1a]/40">Best</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: scoreColor(group.best) }}>{group.best}%</p>
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-[#5c3d1a]/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* ── Expanded body ───────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1a0f00]/06 px-5 pb-5 pt-4">

              {/* Graph */}
              <div className="mb-5 rounded-xl bg-[#f8f4e0]/60 px-3 py-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#5c3d1a]/40">Progress</p>
                <ProgressGraph attempts={group.attempts} />
              </div>

              {/* Body part bars */}
              {regionRows.length > 0 && (
                <div className="mb-5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#5c3d1a]/40">Body Parts (latest)</p>
                  <div className="flex flex-col gap-2.5">
                    {regionRows.map(k => (
                      <ScoreBar
                        key={k}
                        label={REGION_LABELS[k]}
                        value={latestRegions![k]}
                        color={PART_COLORS[k] ?? scoreColor(latestRegions![k])}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Focus areas (need more activation) */}
              {latestRegions && (() => {
                const sorted = allRegionKeys
                  .filter(k => latestRegions[k] !== undefined)
                  .map(k => ({ key: k, value: latestRegions[k]! }))
                  .sort((a, b) => a.value - b.value);
                const needWork = sorted.filter(r => r.value < 70).slice(0, 3);
                if (needWork.length === 0) {
                  return (
                    <div className="mb-5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5c3d1a]/40">Focus areas</p>
                      <p className="mt-1 text-xs text-[#5c3d1a]/60">All regions 70%+</p>
                    </div>
                  );
                }
                return (
                  <div className="mb-5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#5c3d1a]/40">Focus areas</p>
                    <ul className="flex flex-col gap-1.5">
                      {needWork.map(({ key, value }) => (
                        <li key={key} className="text-xs text-[#5c3d1a]/80">
                          <span className="font-medium">{REGION_LABELS[key]}</span>
                          <span className="tabular-nums" style={{ color: scoreColor(value) }}> {value}%</span>
                          {" — "}
                          <span className="text-[#5c3d1a]/70">{REGION_TIPS[key] ?? "Keep practicing"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Attempt history */}
              {group.attempts.length > 1 && (
                <div className="mb-5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#5c3d1a]/40">History</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {group.attempts.map((a, i) => {
                      const color = scoreColor(a.score);
                      const isLatest = i === group.attempts.length - 1;
                      return (
                        <div
                          key={i}
                          className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 ${isLatest ? "bg-[#080808]" : "bg-[#f8f4e0]"}`}
                        >
                          <span className={`text-sm font-black tabular-nums ${isLatest ? "text-white" : ""}`}
                            style={isLatest ? {} : { color }}>
                            {a.score}%
                          </span>
                          <span className={`text-[10px] ${isLatest ? "text-white/50" : "text-[#5c3d1a]/40"}`}>
                            {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {isLatest && <span className="text-[9px] font-bold text-white/40">LATEST</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowPracticeModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#080808] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1a1a1a] transition-colors"
                >
                  Practice Again →
                </button>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    confirmDelete
                      ? "bg-red-500 text-white"
                      : "border border-[#1a0f00]/10 text-[#1a0f00]/40 hover:border-red-300 hover:text-red-500"
                  }`}
                >
                  {deleting ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  )}
                  {confirmDelete ? "Confirm Delete" : "Delete"}
                </button>
              </div>

              {confirmDelete && !deleting && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="mt-2 text-[11px] text-[#5c3d1a]/40 underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Practice Again modal */}
      <AnimatePresence>
        {showPracticeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setShowPracticeModal(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ ease: "backOut", duration: 0.25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-[#1a0f00]/10 bg-white p-5 shadow-xl"
            >
              <h3 className="font-semibold text-[#1a0f00]">Practice {group.title} again</h3>
              <p className="mt-2 text-sm text-[#5c3d1a]/70">Upload a new video to practice this routine.</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPracticeModal(false)}
                  className="flex-1 rounded-full border border-[#1a0f00]/15 px-4 py-2 text-xs font-semibold text-[#5c3d1a]/70 hover:bg-[#1a0f00]/05"
                >
                  Cancel
                </button>
                <Link
                  href={practiceHref}
                  className="flex-1 rounded-full bg-[#080808] px-4 py-2 text-center text-xs font-semibold text-white hover:bg-[#1a1a1a]"
                >
                  Upload video
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
