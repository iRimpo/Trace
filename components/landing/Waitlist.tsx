"use client";

import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowRight, FaCheckCircle, FaLock } from "react-icons/fa";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
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
    <section id="waitlist" className="relative overflow-hidden bg-brand-dark px-8 py-24 sm:py-32 lg:px-16">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="blob absolute -top-20 left-1/4 h-[500px] w-[500px] bg-brand-primary opacity-20"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, -25, 0], y: [0, 25, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="blob absolute -bottom-20 right-1/4 h-[400px] w-[400px] bg-brand-accent opacity-15"
        />
      </div>

      {/* Grid dots */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-10" />

      <div className="relative mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="font-mono text-xs font-bold tracking-widest text-brand-primary/80 uppercase">
            Early Access
          </span>
          <h2 className="mt-3 font-hero font-bold text-4xl lg:text-5xl text-white tracking-tight">
            Ready to actually improve?
          </h2>
          <p className="mt-4 text-white/40 text-lg">
            Join the waitlist. First access goes to the most eager dancers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-10"
        >
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "backOut" }}
                className="rounded-3xl border border-brand-primary/30 bg-brand-primary/10 p-12"
              >
                <FaCheckCircle className="mx-auto text-4xl text-brand-primary mb-4" />
                <p className="text-xl font-bold text-white">You&apos;re on the list!</p>
                <p className="mt-2 text-sm text-white/40">
                  We&apos;ll reach out soon. Keep dancing.
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-white placeholder-white/25 outline-none backdrop-blur-sm transition-all duration-200 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20"
                  />
                  {/* Pill submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex items-center overflow-hidden rounded-full bg-white p-[2px] shadow-lg disabled:opacity-50"
                  >
                    <div className="absolute left-2 h-8 w-8 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[25]" />
                    <span className="relative z-10 pl-12 pr-4 py-2.5 text-sm font-noname font-semibold text-brand-dark transition-colors duration-[900ms] group-hover:text-white whitespace-nowrap">
                      {loading ? "Joining..." : "Join Waitlist"}
                    </span>
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white mr-0.5">
                      <FaArrowRight className="text-xs" />
                    </div>
                  </button>
                </div>

                {error && (
                  <p className="mt-3 text-xs text-brand-accent">{error}</p>
                )}

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/25">
                  <FaLock className="text-[10px]" />
                  No spam, ever. Unsubscribe anytime.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
