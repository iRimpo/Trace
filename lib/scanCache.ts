import { supabase } from "./supabase";
import { SCAN_VERSION } from "./cueScript";
import type { MovementEvent } from "./movementEventDetector";
import { identityKey, type VideoIdentity } from "./videoIdentity";

/**
 * Supabase-backed cache of scan output, keyed by video identity + practice
 * segment + scan version. Link-sourced scans are shared across users (a public
 * video's choreography is not private data); uploads are RLS-scoped to their
 * owner. Writes are best-effort: a failed put never breaks practice — it just
 * means one more scan next time.
 *
 * v3 stores raw events rather than a composed timeline. Composition depends on
 * the BPM, which is often unknown or wrong at scan time; keeping the cache
 * BPM-free means correcting the tempo later recomposes instantly instead of
 * forcing a rescan. The `timeline` jsonb column is reused as-is to avoid a
 * schema change.
 */

export interface ScanCacheKey {
  identity: VideoIdentity;
  segmentStart: number;
  segmentEnd: number;
}

export interface ScanPayload {
  events: MovementEvent[];
  videoHeight: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function cacheRowKey(k: ScanCacheKey): {
  video_identity: string;
  segment_start: number;
  segment_end: number;
  scan_version: number;
} {
  return {
    video_identity: identityKey(k.identity),
    segment_start: round1(k.segmentStart),
    segment_end: round1(k.segmentEnd),
    scan_version: SCAN_VERSION,
  };
}

export async function getCachedScan(k: ScanCacheKey): Promise<ScanPayload | null> {
  try {
    const key = cacheRowKey(k);
    const { data, error } = await supabase
      .from("scan_cache")
      .select("timeline")
      .eq("video_identity", key.video_identity)
      .eq("segment_start", key.segment_start)
      .eq("segment_end", key.segment_end)
      .eq("scan_version", key.scan_version)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const payload = (data as { timeline: ScanPayload }).timeline;
    // A pre-v3 row's jsonb has `entries`, not `events`. Treat it as a miss —
    // returning it would render nothing, whereas a miss costs one rescan.
    return Array.isArray(payload?.events) ? payload : null;
  } catch {
    return null; // offline / RLS miss — just rescan
  }
}

export async function putCachedScan(
  k: ScanCacheKey,
  payload: ScanPayload,
  isUpload: boolean,
): Promise<void> {
  try {
    let ownerId: string | null = null;
    if (isUpload) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return; // private row needs an owner — skip
      ownerId = data.user.id;
    }
    await supabase.from("scan_cache").insert({
      ...cacheRowKey(k),
      timeline: payload,
      is_upload: isUpload,
      owner_id: ownerId,
    });
  } catch {
    // Best-effort — cache misses are always recoverable by rescanning.
  }
}
