"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Pressable from "@/components/ui/Pressable";
import Panel from "@/components/ui/Panel";
import Field from "@/components/ui/Field";

export default function ForgotPasswordPage() {
  const reduce = useReducedMotion();
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

  const swap = {
    initial: { opacity: 0, y: reduce ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: reduce ? 0 : -8 },
    transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-8 sm:px-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md"
      >
        {/* Same composition as login and signup — the character sits on the
            plate and the mark overlaps it, so the three auth screens open with
            one object rather than three different arrangements of two images. */}
        <Link href="/" className="mb-6 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-card">
              <img src="/character-dance.svg" width="76" height="76" alt="" />
            </div>
            <img
              src="/trace_logo.svg"
              width="36" height="36" alt=""
              className="absolute -bottom-2 -right-2 rounded-full ring-4 ring-brand-cream"
            />
          </div>
          <span className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/70">
            Trace
          </span>
        </Link>

        <Panel tone="paper" radius="2xl" className="p-6 sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="sent" {...swap}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-duo-green/40 bg-duo-green/[0.12]">
                  <svg className="h-7 w-7 text-duo-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink">
                  Check your email
                </h1>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-clay/80">
                  We sent a password reset link to{" "}
                  <span className="font-extrabold text-ink">{email}</span>. Click the link
                  to reset your password.
                </p>

                <div className="mt-6">
                  <Pressable href="/login" variant="ink" size="lg" block>
                    <ArrowLeft />
                    Back to log in
                  </Pressable>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" {...swap}>
                {/* The heading leads, matching login's scale — the old
                    `text-2xl` over `text-sm text-clay/50` was a hierarchy on
                    paper only. */}
                <h1 className="text-3xl font-extrabold tracking-tight text-ink">
                  Reset your password
                </h1>
                <p className="mt-1.5 text-sm font-medium text-clay/80">
                  Enter your email and we&apos;ll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <Field
                    label="Email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />

                  {/*
                    Supabase does not say why a reset dispatch failed, and it
                    deliberately does not confirm whether an address exists — so
                    there is nothing to attach to the email field. Page level,
                    with role="alert" so it is announced, not merely coloured.
                  */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: reduce ? 0 : -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      role="alert"
                      className="rounded-2xl border-2 border-duo-red/30 bg-duo-red/[0.07] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-duo-red">{error}</p>
                    </motion.div>
                  )}

                  <Pressable type="submit" variant="ink" size="lg" block disabled={loading}>
                    {loading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin motion-reduce:animate-pulse" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        Send Reset Link
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </Pressable>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {!sent && (
          <p className="mt-5 text-center text-sm font-medium text-clay/70">
            Remember your password?{" "}
            <Link href="/login" className="font-extrabold text-ink underline decoration-duo-green decoration-2 underline-offset-4">
              Log in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}
