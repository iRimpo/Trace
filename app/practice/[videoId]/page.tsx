"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowLeft, FaCube, FaDesktop, FaCheckCircle, FaArrowRight } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSignedUrl } from "@/lib/useSignedUrl";
import TabNavigation, { TabId } from "@/components/practice/TabNavigation";
import TraceTab from "@/components/practice/TraceTab";

interface Video {
  id: string;
  title: string;
  video_url: string;
}

export default function SessionPage() {
  const params = useParams();
  const videoId = params.videoId as string;
  const { user, loading: authLoading } = useAuth();

  const [video, setVideo]   = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const [currentTab, setCurrentTab]     = useState<TabId>("trace");
  const [completedTabs, setCompletedTabs] = useState<TabId[]>([]);

  const { url: signedVideoUrl, loading: urlLoading, error: urlError } = useSignedUrl(video?.video_url);

  useEffect(() => {
    if (!user || !videoId) return;
    async function fetchVideo() {
      const { data, error: dbError } = await supabase
        .from("videos")
        .select("id, title, video_url")
        .eq("id", videoId)
        .eq("user_id", user!.id)
        .single();
      if (dbError || !data) setError("Video not found");
      else setVideo(data);
      setLoading(false);
    }
    fetchVideo();
  }, [user, videoId]);

  const handleTraceComplete = useCallback(() => {
    setCompletedTabs((prev) => prev.includes("trace") ? prev : [...prev, "trace"]);
    setCurrentTab("test");
  }, []);

  const handleTestComplete = useCallback(() => {
    setCompletedTabs((prev) => prev.includes("test") ? prev : [...prev, "test"]);
    setCurrentTab("sync");
  }, []);

  // Loading
  if (authLoading || loading || urlLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-transparent border-t-brand-accent"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Error
  if (error || urlError || !video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent/10 border border-brand-accent/20">
            <FaDesktop className="text-brand-accent text-xl" />
          </div>
          <h2 className="mt-5 font-hero font-bold text-xl text-brand-dark">Video not found</h2>
          <p className="mt-2 text-sm text-brand-dark/40">
            This video doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Link
            href="/dashboard"
            className="group relative mt-6 inline-flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg"
          >
            <div className="absolute left-2 h-7 w-7 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[25]" />
            <span className="relative z-10 pl-10 pr-4 py-2 text-sm font-noname font-semibold text-white">
              Back to Dashboard
            </span>
            <div className="relative z-10 mr-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
              <FaArrowRight className="text-[10px]" />
            </div>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="border-b border-brand-primary/8 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-brand-dark/40 hover:text-brand-dark transition-colors"
            >
              <FaArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-brand-dark/15">/</span>
            <span className="truncate text-sm font-semibold text-brand-dark max-w-[200px]">
              {video.title}
            </span>
          </div>
          <Link href="/" className="flex items-center gap-1.5">
            <FaCube className="text-brand-primary text-sm" />
            <span className="font-logo font-semibold text-lg text-brand-dark">Trace.</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <TabNavigation
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          completedTabs={completedTabs}
        />

        <div className="mt-6">
          {currentTab === "trace" && signedVideoUrl && (
            <TraceTab videoUrl={signedVideoUrl} onComplete={handleTraceComplete} />
          )}

          {currentTab === "test" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl border border-brand-primary/10 bg-white p-10 text-center sm:p-14"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/8 border border-brand-primary/15">
                <FaDesktop className="text-brand-primary text-xl" />
              </div>
              <h2 className="mt-5 font-hero font-bold text-xl text-brand-dark">Test Mode</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-dark/35">
                Record yourself dancing without the reference overlay. Coming soon.
              </p>
              <button
                onClick={handleTestComplete}
                className="group relative mt-6 inline-flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20"
              >
                <div className="absolute left-2 h-7 w-7 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[25]" />
                <span className="relative z-10 pl-10 pr-4 py-2 text-sm font-noname font-semibold text-white">
                  Skip to Sync
                </span>
                <div className="relative z-10 mr-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
                  <FaArrowRight className="text-[10px]" />
                </div>
              </button>
            </motion.div>
          )}

          {currentTab === "sync" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl border border-brand-primary/10 bg-white p-10 text-center sm:p-14"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/8 border border-emerald-500/15">
                <FaCheckCircle className="text-emerald-500 text-xl" />
              </div>
              <h2 className="mt-5 font-hero font-bold text-xl text-brand-dark">Sync Review</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-dark/35">
                Side-by-side comparison of your recording with the original. Coming soon.
              </p>
              <Link
                href="/dashboard"
                className="group relative mt-6 inline-flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20"
              >
                <div className="absolute left-2 h-7 w-7 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[25]" />
                <span className="relative z-10 pl-10 pr-4 py-2 text-sm font-noname font-semibold text-white">
                  Back to My Videos
                </span>
                <div className="relative z-10 mr-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
                  <FaArrowRight className="text-[10px]" />
                </div>
              </Link>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
