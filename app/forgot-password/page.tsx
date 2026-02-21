"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FaCube, FaArrowRight, FaEnvelope } from "react-icons/fa";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/login` }
    );

    if (resetError) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-brand-bg px-6 py-12 overflow-hidden">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="blob absolute -top-40 -left-40 h-96 w-96 bg-brand-primary opacity-20" />
        <div className="blob absolute -bottom-40 -right-40 h-96 w-96 bg-brand-accent opacity-15" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.075, 0.82, 0.165, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <FaCube className="text-brand-primary text-xl" />
          <span className="font-logo font-semibold text-2xl text-brand-dark tracking-tight">Trace.</span>
        </Link>

        {/* Card */}
        <div className="rounded-3xl border border-brand-primary/10 bg-white/80 backdrop-blur-sm p-8 shadow-2xl shadow-brand-primary/8 sm:p-10">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: "backOut" }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 border border-brand-primary/20">
                  <FaEnvelope className="text-brand-primary text-xl" />
                </div>
                <h1 className="mt-5 font-hero font-bold text-2xl tracking-tight text-brand-dark">
                  Check your email
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-brand-dark/40">
                  We sent a password reset link to{" "}
                  <span className="font-medium text-brand-dark/70">{email}</span>.
                  Click the link to reset your password.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  <FaArrowRight className="text-xs rotate-180" />
                  Back to login
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="font-hero font-bold text-2xl tracking-tight text-brand-dark">
                  Reset your password
                </h1>
                <p className="mt-2 text-sm text-brand-dark/40">
                  Enter your email and we&apos;ll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-brand-dark/60">
                      Email
                    </label>
                    <input
                      id="email" type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-dark placeholder-brand-dark/25 outline-none transition-all duration-200 focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3"
                    >
                      <p className="text-sm text-brand-accent">{error}</p>
                    </motion.div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    className="group relative flex w-full items-center justify-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                  >
                    <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[20]" />
                    <span className="relative z-10 w-full rounded-full py-3 text-sm font-noname font-semibold text-white flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>Send Reset Link <FaArrowRight className="text-xs" /></>
                      )}
                    </span>
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!sent && (
          <p className="mt-6 text-center text-sm text-brand-dark/40">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
              Log in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
