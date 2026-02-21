import { useState, useEffect } from "react";

/**
 * Resolves a video_url to a playable URL.
 * - Storage paths (e.g. "userId/uuid.mp4") get a signed URL from the API.
 * - Full URLs (YouTube, TikTok, etc.) are returned as-is.
 */
export function useSignedUrl(videoUrl: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setLoading(false);
      return;
    }

    // If it's already a full URL, use it directly
    if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
      setUrl(videoUrl);
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
          body: JSON.stringify({ path: videoUrl }),
        });

        if (!res.ok) {
          throw new Error("Failed to load video");
        }

        const data = await res.json();
        if (!cancelled) {
          setUrl(data.url);
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
