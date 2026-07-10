"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { restoreVideoSession } from "@/lib/sessionVideoStorage";
import PracticeView from "@/components/practice/PracticeView";

export default function SessionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [blobUrl,  setBlobUrl]  = useState<string | null>(null);
  const [title,    setTitle]    = useState("");
  const [identityKey, setIdentityKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Restore re-mints the blob URL from IndexedDB when possible — a plain
    // sessionStorage blob URL is dead after any hard reload.
    restoreVideoSession().then(session => {
      if (cancelled) return;
      if (!session) {
        router.replace("/practice");
        return;
      }
      setBlobUrl(session.blobUrl);
      setTitle(session.songName || session.fileName);
      setIdentityKey(session.identityKey ?? null);
      setChecked(true);
    });
    return () => { cancelled = true; };
  }, [router]);

  if (authLoading || !checked) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-black">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <motion.img
          src="/trace_logo.svg"
          alt="Trace"
          className="h-16 w-16 rounded-full"
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
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
      identityKey={identityKey}
    />
  );
}
