"use client";

import { FormEvent, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import Pressable from "@/components/ui/Pressable";
import IconButton from "@/components/ui/IconButton";
import Panel from "@/components/ui/Panel";
import Field from "@/components/ui/Field";
import LoadingState from "@/components/states/LoadingState";
import FormError from "@/components/states/FormError";

/**
 * Signup is a door, not a form.
 *
 * The invite code used to sit as the first of five inputs on one long screen,
 * which meant a wrong code was only discovered after typing a name, an email
 * and two passwords — and it arrived as one page-level red box that named no
 * field. Splitting the code onto its own step makes the gate the gate: you are
 * either let in or told immediately, and only then do you fill anything in.
 *
 * The API calls are untouched. `/api/activation/validate` still runs before the
 * Google redirect and still runs again immediately before `signUp`, so nothing
 * about activation now trusts a client-side flag.
 */

type Step = "code" | "details" | "confirm";

const TOTAL_STEPS = 2;

/** One message per field, so an error points at the thing that caused it. */
interface FieldErrors {
  code?: string;
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>("code");
  const [activationCode, setActivationCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const noAccountError = searchParams.get("error") === "no_account";

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code && typeof code === "string") setActivationCode(code.trim().toUpperCase());
  }, [searchParams]);

  /* Moving between steps swaps the whole panel, so focus has to be carried
     across by hand or it falls back to <body> and the keyboard user loses
     their place. Skipped on first paint — nobody asked for the keyboard yet. */
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (step === "code") codeRef.current?.focus();
    if (step === "details") nameRef.current?.focus();
  }, [step]);

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

  /** Step 1 — the gate. Nothing else is asked for until this passes. */
  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const code = activationCode.trim().toUpperCase();
    if (!code) {
      setFieldErrors({ code: "Please enter your invite code." });
      return;
    }
    setVerifying(true);
    const valid = await validateActivationCode();
    setVerifying(false);
    if (!valid) {
      setFieldErrors({ code: "Invalid or expired invite code. Please check and try again." });
      return;
    }
    setFieldErrors({});
    setActivationCode(code);
    setStep("details");
  }

  async function handleGoogleSignup() {
    setError("");
    setGoogleLoading(true);
    const code = activationCode.trim().toUpperCase();
    if (!code) {
      setFieldErrors((prev) => ({ ...prev, code: "Please enter your invite code." }));
      setGoogleLoading(false);
      setStep("code");
      return;
    }
    const valid = await validateActivationCode();
    if (!valid) {
      setFieldErrors((prev) => ({
        ...prev,
        code: "Invalid or expired invite code. Please check and try again.",
      }));
      setGoogleLoading(false);
      setStep("code");
      return;
    }
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

  /** Same rules as before, addressed to the field that broke them. */
  function validateDetails(): FieldErrors {
    const errs: FieldErrors = {};
    const trimmedName = name.trim();
    if (!trimmedName) errs.name = "Please enter your name.";
    else if (trimmedName.length < 2) errs.name = "Name must be at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Please enter a valid email address.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (!/[A-Z]/.test(password)) errs.password = "Password must include an uppercase letter.";
    else if (!/[0-9]/.test(password)) errs.password = "Password must include a number.";
    if (password !== confirmPassword) errs.confirm = "Passwords do not match.";
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const code = activationCode.trim().toUpperCase();
    if (!code) {
      setFieldErrors({ code: "Please enter your invite code." });
      setStep("code");
      return;
    }

    const errs = validateDetails();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setLoading(true);

    const valid = await validateActivationCode();
    if (!valid) {
      setFieldErrors({ code: "Invalid or expired invite code. Please check and try again." });
      setLoading(false);
      setStep("code");
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });

    if (signUpError) {
      /*
        Follows login's split: a failure Supabase attributes to a specific
        value is a field error, anything it will not attribute stays at page
        level rather than being guessed onto an input.
      */
      if (signUpError.message.includes("already registered")) {
        setFieldErrors({ email: "An account with this email already exists." });
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    // Resolve a session — signUp returns one directly when email confirmation is disabled.
    // If not, attempt an immediate sign-in (also works without email confirmation).
    let session = data.session;
    if (!session && data.user) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      session = signInData.session;
    }

    if (session) {
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
      setStep("confirm");
      setLoading(false);
    }
  }

  const passwordChecks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter",  met: /[A-Z]/.test(password) },
    { label: "One number",            met: /[0-9]/.test(password) },
  ];

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
        {/* The same single object as login: mark overlapped onto the plate, so
            the character and the logo read as one composition rather than two
            unrelated images stacked on cream. */}
        <Link href="/" className="mb-6 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-card">
              <img src="/character-start.svg" width="76" height="76" alt="" />
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

        {noAccountError && (
          <div
            role="status"
            className="mb-4 rounded-2xl border-2 border-duo-gold/40 bg-duo-gold/[0.14] px-4 py-3"
          >
            <p className="text-sm font-semibold text-ink">
              No account found with that sign-in. Create one below using your invite code.
            </p>
          </div>
        )}

        <Panel tone="paper" radius="2xl" className="p-6 sm:p-8">
          {step !== "confirm" && (
            <StepHeader
              current={step === "code" ? 1 : 2}
              onBack={step === "details" ? () => setStep("code") : undefined}
            />
          )}

          <AnimatePresence mode="wait" initial={false}>
            {step === "confirm" ? (
              <motion.div key="confirm" {...swap}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-duo-green/40 bg-duo-green/[0.12]">
                  <svg className="h-7 w-7 text-duo-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink">
                  Check your email
                </h1>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-clay/80">
                  We sent a confirmation link to{" "}
                  <span className="font-extrabold text-ink">{email}</span>. Click it to
                  activate your account, then log in.
                </p>
                <div className="mt-6">
                  <Pressable href="/login" variant="ink" size="lg" block>
                    Go to log in
                    <ArrowRight />
                  </Pressable>
                </div>
              </motion.div>
            ) : step === "code" ? (
              <motion.div key="code" {...swap}>
                <h1 className="text-3xl font-extrabold tracking-tight text-ink">
                  You&apos;re invited
                </h1>
                <p className="mt-1.5 text-sm font-medium text-clay/80">
                  Trace is invite-only for now. Enter your code to get in.
                </p>

                <form onSubmit={handleCodeSubmit} className="mt-6 space-y-4">
                  <Field
                    ref={codeRef}
                    label="Invite code"
                    type="text"
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    placeholder="TRACE-XXXX"
                    error={fieldErrors.code}
                  />

                  {error && <FormError message={error} />}

                  <Pressable type="submit" variant="ink" size="lg" block loading={verifying}>
                    {verifying ? (
                      "Checking code…"
                    ) : (
                      <>
                        Continue
                        <ArrowRight />
                      </>
                    )}
                  </Pressable>
                </form>
              </motion.div>
            ) : (
              <motion.div key="details" {...swap}>
                <h1 className="text-3xl font-extrabold tracking-tight text-ink">
                  You&apos;re in
                </h1>
                <p className="mt-1.5 text-sm font-medium text-clay/80">
                  Code accepted. Set up your login and start practising.
                </p>

                <div className="mt-6 space-y-4">
                  <Pressable
                    variant="quiet"
                    size="lg"
                    block
                    onClick={handleGoogleSignup}
                    loading={googleLoading}
                  >
                    {googleLoading ? (
                      "Redirecting…"
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
                      <span className="bg-white px-3 text-hud font-bold uppercase tracking-[0.18em] text-clay/50">
                        or
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <Field
                    ref={nameRef}
                    label="Name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    error={fieldErrors.name}
                  />

                  <Field
                    label="Email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    error={fieldErrors.email}
                  />

                  <div>
                    <Field
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      error={fieldErrors.password}
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

                    {/* Requirements read as met/unmet by fill *and* glyph, not
                        by colour alone — a red/green dot is invisible to a
                        third of colour-blind users. */}
                    {password.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {passwordChecks.map((check) => (
                          <li key={check.label} className="flex items-center gap-2">
                            <span
                              className={[
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                                "transition-ui duration-150 ease-out-strong",
                                check.met ? "bg-duo-green text-white" : "bg-duo-edge text-transparent",
                              ].join(" ")}
                            >
                              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            <span className={`text-xs font-semibold ${check.met ? "text-ink" : "text-clay/60"}`}>
                              {check.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Field
                    label="Confirm password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    error={
                      fieldErrors.confirm ??
                      (confirmPassword.length > 0 && password !== confirmPassword
                        ? "Passwords do not match."
                        : undefined)
                    }
                  />

                  {/*
                    Anything Supabase or the activation endpoint will not pin to
                    a single input stays here, announced rather than only
                    coloured.
                  */}
                  {error && <FormError message={error} />}

                  <Pressable type="submit" variant="ink" size="lg" block loading={loading}>
                    {loading ? (
                      "Creating account…"
                    ) : (
                      <>
                        Create Account
                        <ArrowRight />
                      </>
                    )}
                  </Pressable>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {step !== "confirm" && (
          <p className="mt-5 text-center text-sm font-medium text-clay/70">
            Already have an account?{" "}
            <Link href="/login" className="font-extrabold text-ink underline decoration-duo-green decoration-2 underline-offset-4">
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
        <div className="flex min-h-screen items-center justify-center bg-brand-cream">
          <LoadingState message="Loading…" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/**
 * How much is left. It lives outside the AnimatePresence on purpose: kept
 * mounted, the `aria-live` label actually announces the change, and the meter
 * stays put while the panel content crosses behind it.
 */
function StepHeader({ current, onBack }: { current: number; onBack?: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {onBack && (
        <IconButton
          visual="sm"
          round={false}
          aria-label="Back to invite code"
          onClick={onBack}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </IconButton>
      )}
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={[
              "h-1.5 flex-1 rounded-full transition-[background-color] duration-200 ease-out-strong",
              i < current ? "bg-ink" : "bg-duo-edge",
            ].join(" ")}
          />
        ))}
      </div>
      <span
        aria-live="polite"
        className="text-hud font-extrabold uppercase tracking-[0.18em] text-clay/60"
      >
        Step {current} of {TOTAL_STEPS}
      </span>
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

function ArrowRight() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
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
