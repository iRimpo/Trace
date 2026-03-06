"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="flex min-h-screen items-center justify-center bg-[#f8f4e0] px-4 py-8 sm:px-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.075, 0.82, 0.165, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center">
          <img src="/trace_logo.svg" width="64" height="64" alt="Trace" className="rounded-full" />
        </Link>

        {/* Illustration */}
        <div className="flex justify-center mb-6">
          <img src="/ChatGPT-Image-Feb-15_-2026_-06_45_31-PM_3_.svg" width="100" height="100" alt="" className="rounded-2xl" />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1a0f00]/08 bg-white p-5 shadow-sm sm:p-8 md:p-10">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: "backOut" }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
                  <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h1 className="mt-5 font-calistoga text-2xl tracking-tight text-[#1a0f00]">
                  Check your email
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#5c3d1a]/50">
                  We sent a password reset link to{" "}
                  <span className="font-medium text-[#1a0f00]">{email}</span>.
                  Click the link to reset your password.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a0f00] hover:text-[#1a0f00]/70 transition-colors"
                >
                  <svg className="h-3.5 w-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  Back to login
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="font-calistoga text-2xl tracking-tight text-[#1a0f00]">
                  Reset your password
                </h1>
                <p className="mt-2 text-sm text-[#5c3d1a]/50">
                  Enter your email and we&apos;ll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#5c3d1a]/70">
                      Email
                    </label>
                    <input
                      id="email" type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full rounded-xl border border-[#1a0f00]/12 bg-white px-4 py-3 text-sm text-[#1a0f00] placeholder-[#1a0f00]/30 outline-none transition-all duration-200 focus:border-[#080808] focus:ring-2 focus:ring-[#080808]/10"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                    >
                      <p className="text-sm text-red-500">{error}</p>
                    </motion.div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit" disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#080808] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a1a1a] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        Send Reset Link
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!sent && (
          <p className="mt-6 text-center text-sm text-[#5c3d1a]/50">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-[#1a0f00] hover:text-[#1a0f00]/70 transition-colors">
              Log in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
