"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import SongCard from "@/components/dashboard/SongCard";
import type { SongGroup } from "@/app/api/progress/route";

interface Stats {
  total_sessions: number;
  avg_score: number;
  best_score: number;
  practice_days: number;
  streak: number;
}

interface ProgressData {
  stats: Stats;
  songs: SongGroup[];
}

function AnimCount({ n, suffix = "" }: { n: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (n === 0) { setV(0); return; }
    let cur = 0;
    const step = Math.max(1, Math.ceil(n / 24));
    const id = setInterval(() => {
      cur = Math.min(cur + step, n);
      setV(cur);
      if (cur >= n) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [n]);
  return <>{v}{suffix}</>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function DashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const refreshKey = searchParams.get("t");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(false);
    fetch("/api/progress")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setProgress(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  if (!user) return null;

  const songs   = progress?.songs ?? [];
  const stats   = progress?.stats;
  const hasData = songs.length > 0;
  const streak  = stats?.streak ?? 0;
  const displayName =
    (user.user_metadata?.full_name ?? user.user_metadata?.name)?.trim().split(/\s+/)[0] ??
    (user.email?.[0] ?? "?").toUpperCase();

  function handleDelete(deletedIds: string[]) {
    const idSet = new Set(deletedIds);
    setProgress(prev => {
      if (!prev) return prev;
      const newSongs = prev.songs
        .map(g => ({
          ...g,
          attempts: g.attempts.filter(a => !idSet.has(a.id)),
        }))
        .filter(g => g.attempts.length > 0)
        .map(g => {
          const scores = g.attempts.map(a => a.score);
          return {
            ...g,
            best: Math.max(...scores),
            latest: g.attempts[g.attempts.length - 1].score,
            avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          };
        });
      const newStats = { ...prev.stats, total_sessions: prev.stats.total_sessions - deletedIds.length };
      return { stats: newStats, songs: newSongs };
    });
  }

  return (
    <div className="mx-auto max-w-3xl">

      {/* ── Hero strip ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 overflow-hidden rounded-2xl"
      >
        {/* State header: white to match the flow */}
        <div
          className={`flex items-center justify-between bg-white px-5 py-4 rounded-t-2xl ${!stats && !(streak >= 3) ? "rounded-b-2xl" : ""}`}
        >
          <p className="text-2xl font-bold tracking-tight text-[#1a0f00]">
            Hi, {displayName}
          </p>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1">
              <span className="text-base">🔥</span>
              <span className="text-sm font-bold text-amber-800">{streak} day streak</span>
            </div>
          )}
        </div>
        {streak >= 3 && (
          <p className={`bg-white px-5 pb-2 text-xs text-[#5c3d1a]/60 ${!stats ? "rounded-b-2xl" : ""}`}>
            Keep it up!
          </p>
        )}

        {/* Stats: keep dark */}
        {stats && (
          <div className="flex rounded-b-2xl border-t border-white/10 bg-[#080808] px-4 py-4 text-white sm:px-5">
            <div className="flex-1 text-center">
              <p className="font-bold text-lg text-white tabular-nums sm:text-xl">
                <AnimCount n={stats.total_sessions} />
              </p>
              <p className="text-[10px] text-white/50 sm:text-[11px]">Sessions</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="font-bold text-lg text-white tabular-nums sm:text-xl">
                <AnimCount n={Math.round(stats.avg_score)} suffix="%" />
              </p>
              <p className="text-[10px] text-white/50 sm:text-[11px]">Avg</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="font-bold text-lg text-white tabular-nums sm:text-xl">
                <AnimCount n={Math.round(stats.best_score)} suffix="%" />
              </p>
              <p className="text-[10px] text-white/50 sm:text-[11px]">Best</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="text-lg font-bold tabular-nums text-white sm:text-xl">
                <AnimCount n={stats.practice_days} />
              </p>
              <p className="text-[10px] text-white/50 sm:text-[11px]">Days</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Section header ──────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-lg tracking-tight text-[#1a0f00]">Your Practice</h2>
        {hasData && (
          <Link
            href="/practice"
            className="flex items-center gap-1.5 rounded-full bg-[#080808] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1a1a1a] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Session
          </Link>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && <DashboardSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-500">
          Couldn&apos;t load your progress. <button onClick={() => window.location.reload()} className="underline">Retry</button>
        </div>
      )}

      {/* ── Song cards ──────────────────────────────────────────── */}
      {!loading && !error && hasData && (
        <motion.div
          className="flex flex-col gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {songs.map((group) => (
            <motion.div key={group.title} variants={cardVariants}>
              <SongCard group={group} onDelete={handleDelete} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!loading && !error && !hasData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mt-4 rounded-3xl border border-dashed border-[#1a0f00]/12 bg-white/60 p-12 text-center"
        >
          <div className="mx-auto flex justify-center">
            <img
              src="/ChatGPT-Image-Feb-15_-2026_-06_45_31-PM_4_.svg"
              width="120" height="120" alt=""
              className="rounded-2xl"
            />
          </div>
          <h2 className="mt-5 font-bold text-xl text-[#1a0f00]">Start your first session</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#5c3d1a]/50">
            Upload a reference dance video and start your first Trace session.
          </p>
          <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Link
              href="/practice"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#080808] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a1a1a]"
            >
              Upload Video →
            </Link>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
