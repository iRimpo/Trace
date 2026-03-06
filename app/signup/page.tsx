"use client";

import { FormEvent, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activationCode, setActivationCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState(false);
  const noAccountError = searchParams.get("error") === "no_account";

  useEffect(() => {
    const code = searchParams.get("code");
    if (code && typeof code === "string") setActivationCode(code.trim().toUpperCase());
  }, [searchParams]);

  async function validateActivationCode(): Promise<boolean> {
    const code = activationCode.trim().toUpperCase();
    if (!code) return false;
    const res = await fetch("/api/activation/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    return data.valid === true;
  }

  async function handleGoogleSignup() {
    setError("");
    const code = activationCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter your invite code.");
      return;
    }
    const valid = await validateActivationCode();
    if (!valid) {
      setError("Invalid or expired invite code. Please check and try again.");
      return;
    }
    setGoogleLoading(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("trace_activation_code", code);
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
      return;
    }
    if (data?.url) window.location.href = data.url;
    else setGoogleLoading(false);
  }

  function validate(): string | null {
    const code = activationCode.trim().toUpperCase();
    if (!code) return "Please enter your invite code.";
    const trimmedName = name.trim();
    if (!trimmedName) return "Please enter your name.";
    if (trimmedName.length < 2) return "Name must be at least 2 characters.";
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

    const code = activationCode.trim().toUpperCase();
    const valid = await validateActivationCode();
    if (!valid) {
      setError("Invalid or expired invite code. Please check and try again.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });

    if (signUpError) {
      setError(signUpError.message.includes("already registered")
        ? "An account with this email already exists."
        : signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      const recordRes = await fetch("/api/activation/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!recordRes.ok) {
        setError("Account created but activation failed. Please contact support.");
        setLoading(false);
        return;
      }
      track("signup_completed", { source: "email", activation_code: code });
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
    <div className="flex min-h-screen items-center justify-center bg-[#f8f4e0] px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.075, 0.82, 0.165, 1] }}
        className="w-full max-w-md"
      >
        {/* Back link */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5c3d1a]/50 hover:text-[#1a0f00] transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>
        </div>

        {noAccountError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No account found with that sign-in. Create one below using your invite code.
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-[#1a0f00]/08 bg-white p-8 shadow-sm sm:p-10">
          <AnimatePresence mode="wait">
            {confirmEmail ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: "backOut" }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
                  <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="mt-5 font-calistoga text-2xl tracking-tight text-[#1a0f00]">
                  Check your email
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#5c3d1a]/50">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-[#1a0f00]">{email}</span>.
                  Click it to activate your account, then{" "}
                  <Link href="/login" className="font-semibold text-[#1a0f00] hover:text-[#1a0f00]/70">
                    log in
                  </Link>
                  .
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="font-calistoga text-2xl tracking-tight text-[#1a0f00]">
                  Create your account
                </h1>
                <p className="mt-2 text-sm text-[#5c3d1a]/50">
                  Start analyzing your dance technique today.
                </p>

                <div className="mt-8 space-y-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignup}
                    disabled={googleLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[#1a0f00]/15 bg-white py-3 text-sm font-semibold text-[#1a0f00] shadow-sm transition-colors hover:bg-[#1a0f00]/05 disabled:opacity-50"
                  >
                    {googleLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Redirecting…
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#1a0f00]/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-[#5c3d1a]/50">or sign up with email</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                  {/* Activation Code */}
                  <div>
                    <label htmlFor="activationCode" className="mb-1.5 block text-sm font-medium text-[#5c3d1a]/70">
                      Invite code
                    </label>
                    <input
                      id="activationCode"
                      type="text"
                      required
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value)}
                      placeholder="Invite code"
                      className="w-full rounded-xl border border-[#1a0f00]/12 bg-white px-4 py-3 text-sm text-[#1a0f00] placeholder-[#1a0f00]/30 outline-none transition-all duration-200 focus:border-[#080808] focus:ring-2 focus:ring-[#080808]/10"
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[#5c3d1a]/70">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-[#1a0f00]/12 bg-white px-4 py-3 text-sm text-[#1a0f00] placeholder-[#1a0f00]/30 outline-none transition-all duration-200 focus:border-[#080808] focus:ring-2 focus:ring-[#080808]/10"
                    />
                  </div>

                  {/* Email */}
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

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#5c3d1a]/70">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password" type={showPassword ? "text" : "password"} required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full rounded-xl border border-[#1a0f00]/12 bg-white px-4 py-3 pr-12 text-sm text-[#1a0f00] placeholder-[#1a0f00]/30 outline-none transition-all duration-200 focus:border-[#080808] focus:ring-2 focus:ring-[#080808]/10"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {/* Strength indicators */}
                    {password.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {passwordChecks.map((check) => (
                          <div key={check.label} className="flex items-center gap-2 text-xs">
                            <motion.div
                              animate={{ scale: check.met ? [1.5, 1] : 1 }}
                              className={`h-1.5 w-1.5 rounded-full transition-colors ${check.met ? "bg-[#34D399]" : "bg-[#1a0f00]/15"}`}
                            />
                            <span className={check.met ? "text-[#1a0f00]" : "text-[#5c3d1a]/40"}>
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-[#5c3d1a]/70">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword" type={showPassword ? "text" : "password"} required value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full rounded-xl border border-[#1a0f00]/12 bg-white px-4 py-3 text-sm text-[#1a0f00] placeholder-[#1a0f00]/30 outline-none transition-all duration-200 focus:border-[#080808] focus:ring-2 focus:ring-[#080808]/10"
                    />
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="mt-1.5 text-xs text-red-500">Passwords do not match</p>
                    )}
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
                        Creating account…
                      </>
                    ) : (
                      <>
                        Create Account
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

        {!confirmEmail && (
          <p className="mt-6 text-center text-sm text-[#5c3d1a]/50">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#1a0f00] hover:text-[#1a0f00]/70 transition-colors">
              Log in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8f4e0]">
          <div className="h-8 w-8 rounded-full border-2 border-[#1a0f00]/10 border-t-[#1a0f00] animate-spin" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
