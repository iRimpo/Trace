import { useState, useEffect } from "react";

const urlCache = new Map<string, string>();

/**
 * Resolves a video_url to a playable URL.
 * - Storage paths (e.g. "userId/uuid.mp4") get a signed URL from the API.
 * - Full URLs (YouTube, TikTok, etc.) are returned as-is.
 * - Caches signed URLs by path to avoid duplicate fetches for the same video.
 */
export function useSignedUrl(videoUrl: string | undefined) {
  const cached = videoUrl ? urlCache.get(videoUrl) ?? null : null;
  const [url, setUrl] = useState<string | null>(cached);
  const [loading, setLoading] = useState(!!videoUrl && !cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = videoUrl;
    if (!path) {
      setLoading(false);
      return;
    }

    // If it's already a full URL or data URI, use it directly
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      setUrl(path);
      setLoading(false);
      return;
    }

    // Check cache first
    const cachedUrl = urlCache.get(path);
    if (cachedUrl) {
      setUrl(cachedUrl);
      setLoading(false);
      return;
    }

    // Otherwise it's a storage path — fetch a signed URL
    let cancelled = false;

    async function fetchSignedUrl() {
      try {
        const res = await fetch("/api/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });

        if (!res.ok) {
          throw new Error("Failed to load video");
        }

        const data = (await res.json()) as { url?: string };
        if (!cancelled) {
          const signedUrl: string | undefined = data?.url;
          if (typeof signedUrl === "string") {
            urlCache.set(path as string, signedUrl);
            setUrl(signedUrl);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load video");
          setLoading(false);
        }
      }
    }

    fetchSignedUrl();
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  return { url, loading, error };
}
