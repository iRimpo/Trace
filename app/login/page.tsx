"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaCube, FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-bg">
          <div className="h-8 w-8 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    router.push(redirect);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-brand-bg px-6 py-12 overflow-hidden">
      {/* Background blobs */}
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
          <span className="font-logo font-semibold text-2xl text-brand-dark tracking-tight">
            Trace.
          </span>
        </Link>

        {/* Card */}
        <div className="rounded-3xl border border-brand-primary/10 bg-white/80 backdrop-blur-sm p-8 shadow-2xl shadow-brand-primary/8 sm:p-10">
          <h1 className="font-hero font-bold text-2xl tracking-tight text-brand-dark">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-brand-dark/40">
            Log in to continue improving your technique.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-brand-dark/60">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-dark placeholder-brand-dark/25 outline-none transition-all duration-200 focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-brand-dark/60">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand-primary/60 hover:text-brand-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/50 px-4 py-3 pr-12 text-sm text-brand-dark placeholder-brand-dark/25 outline-none transition-all duration-200 focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-dark/60 transition-colors"
                >
                  {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3"
              >
                <p className="text-sm text-brand-accent">{error}</p>
              </motion.div>
            )}

            {/* Submit — pill button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20 disabled:opacity-50"
            >
              <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[20]" />
              <span className="relative z-10 w-full rounded-full py-3 text-sm font-noname font-semibold text-white transition-colors duration-[900ms] group-hover:text-white flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Logging in...
                  </>
                ) : (
                  <>Log In <FaArrowRight className="text-xs" /></>
                )}
              </span>
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p className="mt-6 text-center text-sm text-brand-dark/40">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
