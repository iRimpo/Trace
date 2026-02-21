"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FaCube, FaArrowRight, FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState(false);

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
    if (!/[0-9]/.test(password)) return "Password must include a number.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message.includes("already registered")
        ? "An account with this email already exists."
        : signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
    } else {
      setConfirmEmail(true);
      setLoading(false);
    }
  }

  const passwordChecks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter",  met: /[A-Z]/.test(password) },
    { label: "One number",            met: /[0-9]/.test(password) },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-brand-bg px-6 py-12 overflow-hidden">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="blob absolute -top-40 -right-40 h-96 w-96 bg-brand-primary opacity-20" />
        <div className="blob absolute -bottom-40 -left-40 h-96 w-96 bg-brand-accent opacity-15" />
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
            {confirmEmail ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: "backOut" }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 border border-brand-primary/20">
                  <FaCheckCircle className="text-brand-primary text-2xl" />
                </div>
                <h1 className="mt-5 font-hero font-bold text-2xl tracking-tight text-brand-dark">
                  Check your email
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-brand-dark/40">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-brand-dark/70">{email}</span>.
                  Click it to activate your account, then{" "}
                  <Link href="/login" className="font-medium text-brand-primary hover:underline">
                    log in
                  </Link>
                  .
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="font-hero font-bold text-2xl tracking-tight text-brand-dark">
                  Create your account
                </h1>
                <p className="mt-2 text-sm text-brand-dark/40">
                  Start analyzing your dance technique today.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  {/* Email */}
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

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-brand-dark/60">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password" type={showPassword ? "text" : "password"} required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/50 px-4 py-3 pr-12 text-sm text-brand-dark placeholder-brand-dark/25 outline-none transition-all duration-200 focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-dark/60 transition-colors">
                        {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Strength indicators */}
                    {password.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {passwordChecks.map((check) => (
                          <div key={check.label} className="flex items-center gap-2 text-xs">
                            <motion.div
                              animate={{ scale: check.met ? [1.5, 1] : 1 }}
                              className={`h-1.5 w-1.5 rounded-full transition-colors ${check.met ? "bg-brand-primary" : "bg-brand-dark/15"}`}
                            />
                            <span className={check.met ? "text-brand-dark/60" : "text-brand-dark/25"}>
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-brand-dark/60">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword" type={showPassword ? "text" : "password"} required value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full rounded-xl border border-brand-dark/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-dark placeholder-brand-dark/25 outline-none transition-all duration-200 focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10"
                    />
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="mt-1.5 text-xs text-brand-accent">Passwords do not match</p>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3"
                    >
                      <p className="text-sm text-brand-accent">{error}</p>
                    </motion.div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit" disabled={loading}
                    className="group relative flex w-full items-center justify-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                  >
                    <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[20]" />
                    <span className="relative z-10 w-full rounded-full py-3 text-sm font-noname font-semibold text-white flex items-center justify-center gap-2 transition-colors duration-[900ms]">
                      {loading ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Creating account...
                        </>
                      ) : (
                        <>Create Account <FaArrowRight className="text-xs" /></>
                      )}
                    </span>
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!confirmEmail && (
          <p className="mt-6 text-center text-sm text-brand-dark/40">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
              Log in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
