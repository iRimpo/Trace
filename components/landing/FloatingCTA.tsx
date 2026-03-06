"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export default function FloatingCTA() {
  const { user, loading } = useAuth();

  if (loading || user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.5, ease: "backOut" }}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2"
    >
      <Link
        href="/login"
        className="rounded-full border-2 border-[#1a0f00] bg-white px-4 py-2.5 text-sm font-bold text-[#1a0f00] shadow-xl transition-all duration-200 hover:bg-[#1a0f00] hover:text-white"
      >
        Log in
      </Link>
      <Link
        href="#waitlist"
        className="group flex items-center gap-2.5 rounded-full border-2 border-[#1a0f00] bg-[#080808] px-5 py-3 text-white shadow-xl transition-all duration-200 hover:bg-[#1a1a1a]"
      >
        <span className="text-sm font-bold">Sign up</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-bold transition-transform duration-200 group-hover:scale-110">
          +
        </div>
      </Link>
    </motion.div>
  );
}
