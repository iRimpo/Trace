import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// Diagnostic endpoint — visit /api/debug in the browser to see DB state
// Disabled in production for security.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const supabase = createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated", authError });
  }

  const results: Record<string, unknown> = { user_id: user.id, user_email: user.email };

  // 1. Check which columns exist in practice_sessions
  const { data: allSessions, error: allErr } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("user_id", user.id)
    .limit(5);
  results.all_sessions_sample = allSessions;
  results.all_sessions_error = allErr?.message ?? null;

  // 2. Check sessions with sync_score
  const { data: scoredSessions, error: scoredErr } = await supabase
    .from("practice_sessions")
    .select("id, sync_score, created_at")
    .eq("user_id", user.id)
    .not("sync_score", "is", null);
  results.scored_sessions = scoredSessions;
  results.scored_sessions_error = scoredErr?.message ?? null;

  // 3. Check user_progress view
  const { data: progress, error: progressErr } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id);
  results.user_progress = progress;
  results.user_progress_error = progressErr?.message ?? null;

  // 4. Full select with extended columns
  const { data: extSessions, error: extErr } = await supabase
    .from("practice_sessions")
    .select("id, video_id, video_title, sync_score, region_scores, practiced_at, created_at")
    .eq("user_id", user.id)
    .limit(5);
  results.extended_select_result = extSessions;
  results.extended_select_error = extErr?.message ?? null;

  return NextResponse.json(results, { status: 200 });
}
