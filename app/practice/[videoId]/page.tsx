"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSignedUrl } from "@/lib/useSignedUrl";
import PracticeView from "@/components/practice/PracticeView";


interface Video {
  id: string;
  title: string;
  video_url: string;
  video_source: "youtube" | "tiktok" | "upload" | null;
}

export default function SessionPage() {
  const params = useParams();
  const videoId = params.videoId as string;
  const { user, loading: authLoading } = useAuth();

  const [video,   setVideo]   = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const { url: signedVideoUrl, loading: urlLoading, error: urlError } = useSignedUrl(video?.video_url);

  useEffect(() => {
    if (!user || !videoId) return;
    async function fetchVideo() {
      const { data, error: dbError } = await supabase
        .from("videos")
        .select("id, title, video_url, video_source")
        .eq("id", videoId)
        .eq("user_id", user!.id)
        .single();
      if (dbError || !data) setError("Video not found");
      else setVideo(data as Video);
      setLoading(false);
    }
    fetchVideo();
  }, [user, videoId]);

  if (authLoading || loading || urlLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (error || urlError || !video || !signedVideoUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-black px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
            <svg className="h-6 w-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a9 9 0 1 1-18 0V5.25" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">Video not found</h2>
          <p className="mt-1 text-sm text-white/40">This video doesn&apos;t exist or you don&apos;t have access.</p>
          <Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white/70 backdrop-blur transition-all hover:bg-white/15 hover:text-white">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Back to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <PracticeView
      videoUrl={signedVideoUrl}
      videoId={videoId}
      videoTitle={video.title}
      videoSource={video.video_source ?? "upload"}
    />
  );
}
