"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f4e0]">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#1a0f00]/10" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1a0f00]"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayInitial =
    (user.user_metadata?.full_name ?? user.user_metadata?.name)?.trim()[0] ??
    user.email?.[0] ??
    "U";
  const userInitial = displayInitial.toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f4e0]">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-[#1a0f00]/08 bg-[#f8f4e0] px-5 sm:px-8">
        <Link href="/" className="flex items-center">
          <img src="/trace_logo.svg" width="36" height="36" alt="Trace" className="rounded-full" />
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#080808] text-xs font-bold text-white">
            {userInitial}
          </div>

          <button
            onClick={handleSignOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1a0f00]/40 transition-colors hover:bg-[#1a0f00]/08 hover:text-[#1a0f00]"
            title="Log out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
