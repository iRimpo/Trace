"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { loadVideoSession } from "@/lib/sessionVideoStorage";
import PracticeView from "@/components/practice/PracticeView";

export default function SessionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [blobUrl,  setBlobUrl]  = useState<string | null>(null);
  const [title,    setTitle]    = useState("");

  useEffect(() => {
    const session = loadVideoSession();
    if (!session) {
      router.replace("/practice");
      return;
    }
    setBlobUrl(session.blobUrl);
    setTitle(session.songName || session.fileName);
    setChecked(true);
  }, [router]);

  if (authLoading || !checked) {
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
  if (!blobUrl) return null;

  return (
    <PracticeView
      videoUrl={blobUrl}
      videoId={null}
      videoTitle={title}
      videoSource="upload"
    />
  );
}
