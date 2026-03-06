import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export interface SongAttempt {
  id: string;
  score: number;
  regions: Record<string, number> | null;
  date: string;
  traceTime?: number;
}

export interface SongGroup {
  title: string;
  video_id: string | null;
  attempts: SongAttempt[];
  best: number;
  latest: number;
  avg: number;
  thumbnailUrl: string | null;
}

export async function GET() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Try to fetch sessions with all extended columns ────────────
  // If any column doesn't exist (migration not yet run), fall back to
  // the baseline schema from migration 001.
  let sessions: Array<{
    id: string;
    video_id: string | null;
    song_name: string | null;
    video_title: string | null;
    sync_score: number;
    region_scores: Record<string, number> | null;
    practiced_at: string | null;
    created_at: string;
    trace_time: number;
    thumbnail_url: string | null;
  }> = [];

  const fullRes = await supabase
    .from("practice_sessions")
    .select("id, video_id, song_name, video_title, sync_score, region_scores, practiced_at, created_at, trace_time, thumbnail_url")
    .eq("user_id", user.id)
    .not("sync_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!fullRes.error) {
    sessions = (fullRes.data ?? []) as typeof sessions;
  } else {
    // Fallback to baseline schema (only migration 001 columns)
    const minRes = await supabase
      .from("practice_sessions")
      .select("id, video_id, sync_score, created_at")
      .eq("user_id", user.id)
      .not("sync_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!minRes.error && minRes.data) {
      sessions = (minRes.data as Array<{ id: string; video_id: string | null; sync_score: number; created_at: string }>).map(s => ({
        ...s,
        song_name: null,
        video_title: null,
        region_scores: null,
        practiced_at: null,
        trace_time: 0,
        thumbnail_url: null,
      }));
    }
    // If even minimal fails, sessions stays [] — not a crash
  }

  // ── 2. Compute stats from sessions (no view dependency) ───────────
  // Try user_progress view first; fall back to computing from sessions.
  let progress = { total_sessions: 0, avg_score: 0, best_score: 0, practice_days: 0 };

  const viewRes = await supabase
    .from("user_progress")
    .select("total_sessions, avg_score, best_score, practice_days")
    .eq("user_id", user.id)
    .single();

  if (!viewRes.error && viewRes.data) {
    progress = viewRes.data as typeof progress;
  } else if (sessions.length > 0) {
    // Compute from sessions directly
    const scores = sessions.map(s => s.sync_score);
    const uniqueDays = new Set(
      sessions.map(s => new Date(s.practiced_at ?? s.created_at).toISOString().slice(0, 10))
    );
    progress = {
      total_sessions: scores.length,
      avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best_score: Math.max(...scores),
      practice_days: uniqueDays.size,
    };
  }

  // ── 3. Group sessions by video title ─────────────────────────────
  // Sessions ordered newest→oldest; first session per group has the most recent thumbnail
  const groupMap = new Map<string, SongGroup>();
  for (const s of sessions) {
    const key = s.song_name ?? s.video_title ?? `Session ${s.id.slice(0, 6)}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { title: key, video_id: s.video_id, attempts: [], best: 0, latest: 0, avg: 0, thumbnailUrl: s.thumbnail_url });
    }
    groupMap.get(key)!.attempts.push({
      id: s.id,
      score: s.sync_score,
      regions: s.region_scores,
      date: s.practiced_at ?? s.created_at,
      traceTime: s.trace_time,
    });
  }

  // Sort attempts oldest → newest (for graph) and compute group stats
  const songs: SongGroup[] = [];
  for (const group of Array.from(groupMap.values())) {
    group.attempts = group.attempts.slice().reverse();
    const scores = group.attempts.map(a => a.score);
    group.best   = Math.max(...scores);
    group.latest = group.attempts[group.attempts.length - 1].score;
    group.avg    = Math.round(scores.reduce((a, x) => a + x, 0) / scores.length);
    songs.push(group);
  }

  const allDates = sessions.map(s => s.practiced_at ?? s.created_at);
  const streak = computeStreak(allDates);

  return NextResponse.json({
    stats: {
      total_sessions: progress.total_sessions,
      avg_score:      progress.avg_score,
      best_score:     progress.best_score,
      practice_days:  progress.practice_days,
      streak,
    },
    songs,
  });
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const uniqueDays = Array.from(
    new Set(dates.map(d => new Date(d).toISOString().slice(0, 10)))
  ).sort().reverse();
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev    = new Date(uniqueDays[i - 1]);
    const curr    = new Date(uniqueDays[i]);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.round(diffDays) === 1) streak++;
    else break;
  }
  return streak;
}
