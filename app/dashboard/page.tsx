"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import SongCard from "@/components/dashboard/SongCard";
import DashboardTutorial from "@/components/dashboard/DashboardTutorial";
import DeviceVideos from "@/components/dashboard/DeviceVideos";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import StatTile from "@/components/ui/StatTile";
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

/**
 * Counts up on mount rather than on scroll.
 *
 * `components/ui/CountUp` gates on `useInView`, which means a number that never
 * enters the observer's view — or an observer that never fires — is permanently
 * 0. Above the fold, that is a stat row of zeroes. This one starts on mount and
 * always lands on the real number.
 */
function AnimCount({ n, suffix = "" }: { n: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);

  useEffect(() => {
    if (n === 0 || reduce) { setV(n); return; }
    let cur = 0;
    const step = Math.max(1, Math.ceil(n / 24));
    const id = setInterval(() => {
      cur = Math.min(cur + step, n);
      setV(cur);
      if (cur >= n) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [n, reduce]);

  return <>{v}{suffix}</>;
}

/* Entrances are offset-only. Nothing here starts at `opacity: 0`, so a stalled
   animation leaves content in place rather than invisible — the failure that
   shipped a near-blank landing page once already. */
const cardVariants = {
  hidden:  { y: 10 },
  visible: { y: 0 },
};

function DashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const refreshKey = searchParams.get("t");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showTutorial, setShowTutorial] = useState(() =>
    typeof window !== "undefined" && !localStorage.getItem("trace_onboarding_v1_done")
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(false);
    fetch("/api/progress")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setProgress(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user, refreshKey, reloadKey]);

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
      {showTutorial && <DashboardTutorial onDone={() => setShowTutorial(false)} />}

      {/* ── Greeting + streak ───────────────────────────────────────────
          One card, not a stack of conditionally-rounded fragments. The old
          strip toggled `rounded-b-2xl` across three separate elements
          depending on which of them happened to be last. */}
      <motion.div
        initial={{ y: -8 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        className="mb-6"
      >
        <Panel tone="paper" radius="2xl" className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold tracking-tight text-ink">
              Hi, {displayName}
            </p>
            {streak >= 3 && (
              <p className="mt-0.5 text-xs font-semibold text-clay/70">
                {streak} days running. Keep it up.
              </p>
            )}
          </div>

          {streak > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-duo-gold px-3 py-2 shadow-chunk-gold-sm">
              <span className="text-base leading-none" aria-hidden="true">🔥</span>
              <span className="text-lg font-extrabold leading-none tabular-nums text-ink">{streak}</span>
              <span className="text-hud uppercase tracking-[0.14em] text-ink/70">
                day{streak === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </Panel>

        {stats && (
          <div className="mt-2 flex gap-2">
            <StatTile accent="ink"   label="Sessions" value={<AnimCount n={stats.total_sessions} />} />
            <StatTile accent="blue"  label="Avg"      value={<AnimCount n={Math.round(stats.avg_score)} suffix="%" />} />
            <StatTile accent="green" label="Best"     value={<AnimCount n={Math.round(stats.best_score)} suffix="%" />} />
            <StatTile accent="gold"  label="Days"     value={<AnimCount n={stats.practice_days} />} />
          </div>
        )}
      </motion.div>

      {/* ── Videos saved on this device ─────────────────────────────────── */}
      <DeviceVideos />

      {/* ── Section header ─────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Your practice</h2>
        {hasData && (
          <Pressable href="/practice" variant="primary" size="sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New session
          </Pressable>
        )}
      </div>

      {loading && <DashboardSkeleton />}

      {/* Failure, emptiness and waiting are all drawn from one vocabulary now —
          see components/states. Retry re-runs the fetch instead of reloading
          the whole document, which threw away the tutorial state and the
          IndexedDB listing along with the error. */}
      {!loading && error && (
        <ErrorState
          title="Couldn't load your progress"
          message="The connection dropped on the way. Your sessions are safe."
          onRetry={() => setReloadKey(k => k + 1)}
        />
      )}

      {!loading && !error && hasData && (
        <motion.div
          className="flex flex-col gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {songs.map((group) => (
            <motion.div
              key={group.title}
              variants={cardVariants}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              <SongCard group={group} onDelete={handleDelete} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {!loading && !error && !hasData && (
        <EmptyState
          title="Start your first session"
          body="Upload a reference dance video and Trace will overlay it on your camera so you can match every move."
          art={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/character-start.svg" width="120" height="120" alt="" className="rounded-2xl" />
          }
          action={
            <Pressable href="/practice" variant="primary" size="lg">
              Upload a video
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Pressable>
          }
        />
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
