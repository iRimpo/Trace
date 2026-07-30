"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Pressable from "@/components/ui/Pressable";
import IconButton from "@/components/ui/IconButton";
import Panel from "@/components/ui/Panel";
import Field from "@/components/ui/Field";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-cream">
          <div className="h-8 w-8 rounded-full border-2 border-ink/10 border-t-ink animate-spin motion-reduce:animate-pulse" />
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
  const errorParam = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === "not_activated" ? "Your account is not activated. Please sign up with an invite code." :
    errorParam === "no_account" ? "No account found. Sign up first with an invite code." : ""
  );

  async function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`;
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
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-8 sm:px-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md"
      >
        {/*
          One composition, not two stacked images. The character sat on the
          cream ground at 100px with the logo floating 8rem above it, so neither
          read as belonging to the other. Overlapping the mark onto the plate
          makes it a single object with a clear focal point.
        */}
        <Link href="/" className="mb-6 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-card">
              <img src="/character-wave.svg" width="76" height="76" alt="" />
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
          {/* The heading leads. `text-2xl` against `text-sm text-clay/50` body
              was a 1.7x ratio at 50% opacity — technically a hierarchy, not a
              visible one. */}
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm font-medium text-clay/80">
            Pick up where you left off.
          </p>

          <div className="mt-6 space-y-4">
            <Pressable
              variant="quiet"
              size="lg"
              block
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin motion-reduce:animate-pulse" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Redirecting…
                </>
              ) : (
                <>
                  <GoogleMark />
                  Continue with Google
                </>
              )}
            </Pressable>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t-2 border-duo-edge" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-hud font-bold uppercase tracking-widest text-clay/50">
                  or
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Field
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />

            <Field
              label="Password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              action={
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-duo-blue hover:underline"
                >
                  Forgot password?
                </Link>
              }
              trailing={
                <IconButton
                  visual="sm"
                  round={false}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </IconButton>
              }
            />

            {/*
              Sign-in failure is a page-level fact, not a field-level one —
              Supabase deliberately does not say which of the two was wrong, so
              attaching it to either field would be a guess. role="alert" so it
              is announced rather than only coloured.
            */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
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
                  <svg className="h-4 w-4 animate-spin motion-reduce:animate-pulse" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Logging in…
                </>
              ) : (
                <>
                  Log In
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </Pressable>
          </form>
        </Panel>

        <p className="mt-5 text-center text-sm font-medium text-clay/70">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-extrabold text-ink underline decoration-duo-green decoration-2 underline-offset-4">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────
   Google's mark is the one place raw colour is correct: these are their
   brand hexes and a token would be a lie about what they are. */

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Eye() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  );
}
