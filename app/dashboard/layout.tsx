"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaCube, FaUpload, FaSignOutAlt, FaBars, FaTimes } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-brand-dark/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : undefined }}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-brand-primary/8 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-brand-primary/8 px-5">
          <Link href="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <FaCube className="text-brand-primary text-lg" />
            <span className="font-logo font-semibold text-xl text-brand-dark tracking-tight">Trace.</span>
          </Link>
          <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary tracking-widest">
            BETA
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/practice"
            onClick={() => setSidebarOpen(false)}
            className="group flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-primary to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/20 transition-all hover:shadow-xl hover:shadow-brand-primary/30"
          >
            <FaUpload className="text-sm opacity-80" />
            Upload Video
          </Link>
        </div>

        {/* User section */}
        <div className="border-t border-brand-primary/8 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-blue-500 text-sm font-bold text-white shadow-md shadow-brand-primary/20">
              {userInitial}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-brand-dark">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-brand-dark/30 transition-colors hover:bg-brand-dark/[0.03] hover:text-brand-dark/60"
          >
            <FaSignOutAlt className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-brand-primary/8 bg-white px-5 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-brand-dark/40 hover:text-brand-dark transition-colors"
          >
            {sidebarOpen ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <FaCube className="text-brand-primary" />
            <span className="font-logo font-semibold text-lg text-brand-dark">Trace.</span>
          </Link>
        </header>

        <main className="flex-1 p-6 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
