"use client";

import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FadeIn from "@/components/ui/FadeIn";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="waitlist" className="bg-brand-cream px-8 py-20 sm:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left */}
          <FadeIn blur>
            <p className="font-mono text-xs uppercase tracking-widest text-brand-dark/25">
              Early Access
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-brand-dark sm:text-5xl">
              Be the first to try Trace
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-brand-dark/40 sm:text-lg">
              We&apos;re building Ghost Mirror right now. Drop your email and
              we&apos;ll let you know the moment it&apos;s ready.
            </p>
          </FadeIn>

          {/* Right */}
          <FadeIn delay={0.2} className="flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.6, ease: [0.075, 0.82, 0.165, 1] }}
                  className="rounded-2xl border border-brand-green/50 bg-white p-10"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/20"
                  >
                    <svg
                      className="h-5 w-5 text-green-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </motion.div>
                  <p className="mt-5 text-xl font-bold text-brand-dark">
                    You&apos;re on the list!
                  </p>
                  <p className="mt-2 text-sm text-brand-dark/40">
                    We&apos;ll reach out soon. Keep dancing.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="space-y-3">
                    <motion.div
                      animate={{
                        boxShadow: focused
                          ? "0 0 0 3px rgba(177, 171, 244, 0.2)"
                          : "0 0 0 0px rgba(177, 171, 244, 0)",
                      }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl"
                    >
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        placeholder="you@email.com"
                        className="w-full rounded-xl border border-brand-dark/[0.08] bg-white px-5 py-4 text-brand-dark placeholder-brand-dark/25 outline-none transition-colors duration-300 focus:border-brand-purple/40"
                      />
                    </motion.div>
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full rounded-xl bg-brand-dark px-8 py-4 text-sm font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-brand-dark/10 disabled:opacity-50"
                    >
                      {loading ? "Joining..." : "Join the Waitlist →"}
                    </motion.button>
                  </div>
                  {error && (
                    <p className="mt-3 text-xs text-red-500">{error}</p>
                  )}
                  <p className="mt-4 text-xs text-brand-dark/25">
                    No spam, ever. Unsubscribe anytime.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
