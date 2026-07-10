/**
 * Stable identity for reference videos — the key for both the on-device
 * video store (IndexedDB) and the shared scan cache (Supabase).
 * Link-sourced videos key on the platform's video ID; uploads on a
 * content hash so the same file re-picked later hits the same cache row.
 */

export type VideoIdentity =
  | { kind: "youtube"; id: string }
  | { kind: "tiktok"; id: string }
  | { kind: "file"; sha256: string };

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function parseLinkIdentity(url: string): VideoIdentity | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    if (v && YT_ID.test(v)) return { kind: "youtube", id: v };
    const shorts = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,20})/);
    if (shorts) return { kind: "youtube", id: shorts[1] };
    const embed = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,20})/);
    if (embed) return { kind: "youtube", id: embed[1] };
    return null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return YT_ID.test(id) ? { kind: "youtube", id } : null;
  }
  if (host === "tiktok.com") {
    const m = u.pathname.match(/\/video\/(\d{5,25})/);
    return m ? { kind: "tiktok", id: m[1] } : null;
  }
  // Shortened links (vm.tiktok.com etc.) need a network resolve — unsupported.
  return null;
}

export async function fileIdentity(file: Blob): Promise<VideoIdentity> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const sha256 = [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return { kind: "file", sha256 };
}

export function identityKey(v: VideoIdentity): string {
  return v.kind === "file" ? `file:${v.sha256}` : `${v.kind}:${v.id}`;
}
