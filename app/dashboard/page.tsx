"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaUpload, FaVideo } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import VideoCard from "@/components/dashboard/VideoCard";

interface Video {
  id: string;
  title: string;
  created_at: string;
  video_url: string;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.5, ease: [0.075, 0.82, 0.165, 1] as [number, number, number, number] } },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function fetchVideos() {
      const { data } = await supabase
        .from("videos")
        .select("id, title, created_at, video_url")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      setVideos(data ?? []);
      setLoading(false);
    }
    fetchVideos();
  }, [user]);

  const handleDelete = useCallback((id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-hero font-bold text-3xl tracking-tight text-brand-dark">My Videos</h1>
          <p className="mt-1 text-sm text-brand-dark/40">
            {loading ? "Loading..." : `${videos.length} video${videos.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <Link
          href="/practice"
          className="group relative flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20"
        >
          <div className="absolute left-2 h-7 w-7 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[30]" />
          <span className="relative z-10 pl-10 pr-4 py-2 text-sm font-noname font-semibold text-white">
            Upload
          </span>
          <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white mr-0.5">
            <FaUpload className="text-[10px]" />
          </div>
        </Link>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="mt-16 flex items-center justify-center">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20" />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>
      )}

      {/* Video grid */}
      {!loading && videos.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {videos.map((video) => (
            <motion.div key={video.id} variants={cardVariants}>
              <VideoCard
                id={video.id}
                title={video.title}
                createdAt={video.created_at}
                videoUrl={video.video_url}
                onDelete={handleDelete}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mt-8 rounded-3xl border border-dashed border-brand-primary/20 bg-white p-12 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/8 border border-brand-primary/15">
            <FaVideo className="h-7 w-7 text-brand-primary/50" />
          </div>
          <h2 className="mt-5 font-hero font-bold text-xl text-brand-dark">No videos yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-dark/35">
            Upload a reference dance video and start your first Trace session.
          </p>
          <Link
            href="/practice"
            className="group relative mt-6 inline-flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20"
          >
            <div className="absolute left-2 h-7 w-7 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[30]" />
            <span className="relative z-10 pl-10 pr-4 py-2 text-sm font-noname font-semibold text-white">
              Upload Your First Video
            </span>
            <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white mr-0.5">
              <FaUpload className="text-[10px]" />
            </div>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
