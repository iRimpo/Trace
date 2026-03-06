import { supabase } from "./supabase";
import { track } from "./posthog";

export async function saveSyncScore(
  sessionId: string,
  syncScore: number,
  regionScores?: Record<string, number>
): Promise<void> {
  const fullPayload: Record<string, unknown> = {
    sync_score: Math.round(syncScore),
    practiced_at: new Date().toISOString(),
  };
  if (regionScores) fullPayload.region_scores = regionScores;

  const { error: fullErr } = await supabase
    .from("practice_sessions")
    .update(fullPayload)
    .eq("id", sessionId);

  if (!fullErr) {
    track("sync_score_saved", { sessionId, syncScore: Math.round(syncScore) });
    return;
  }

  // Fallback: save only sync_score if schema columns are missing
  const isSchemaError =
    fullErr.message.includes("region_scores") ||
    fullErr.message.includes("practiced_at");

  if (isSchemaError) {
    const { error: minErr } = await supabase
      .from("practice_sessions")
      .update({ sync_score: Math.round(syncScore) })
      .eq("id", sessionId);

    if (!minErr) {
      track("sync_score_saved", { sessionId, syncScore: Math.round(syncScore) });
      return;
    }
    throw new Error(`Database error: ${minErr.message}`);
  }

  throw new Error(`Database error: ${fullErr.message}`);
}

/**
 * Create a minimal practice_sessions DB record (no blobs, no keypoints).
 * Returns the new session ID.
 */
export async function createPracticeSession(
  userId: string,
  videoId: string | null,
  videoSource: "youtube" | "tiktok" | "upload",
  videoTitle: string,
  traceTimeSeconds?: number,
  thumbnailUrl?: string,
): Promise<string> {
  const fullPayload: Record<string, unknown> = {
    user_id: userId,
    video_id: videoId,
    video_source: videoSource,
    video_title: videoTitle,
    song_name: videoTitle,
    trace_time: traceTimeSeconds ?? 0,
  };
  if (thumbnailUrl) fullPayload.thumbnail_url = thumbnailUrl;

  const fullRes = await supabase
    .from("practice_sessions")
    .insert(fullPayload)
    .select("id")
    .single();

  if (!fullRes.error) {
    track("practice_session_created", { videoId, videoSource });
    return (fullRes.data as { id: string }).id;
  }

  // If the error is about an unknown column or constraint, fall back to minimal payload
  const isSchemaError =
    fullRes.error.message.includes("video_source") ||
    fullRes.error.message.includes("video_title") ||
    fullRes.error.message.includes("song_name") ||
    fullRes.error.message.includes("video_id") ||
    fullRes.error.message.includes("trace_time") ||
    fullRes.error.message.includes("thumbnail_url");

  if (!isSchemaError) {
    throw new Error(`Database error: ${fullRes.error.message}`);
  }

  // Fallback: insert only columns guaranteed to exist
  const minimalPayload: Record<string, unknown> = { user_id: userId };
  if (videoId) minimalPayload.video_id = videoId;

  const { data, error } = await supabase
    .from("practice_sessions")
    .insert(minimalPayload)
    .select("id")
    .single();

  if (error) throw new Error(`Database error: ${error.message}`);
  track("practice_session_created", { videoId, videoSource });
  return (data as { id: string }).id;
}
