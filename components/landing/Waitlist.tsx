"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CUE_ORDER, CUE_PALETTE } from "@/lib/cuePalette";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import Field from "@/components/ui/Field";
import Reveal from "./Reveal";

/**
 * The one conversion on the page: invite code → signup.
 *
 * The submission itself is untouched — same POST to `/api/activation/validate`,
 * same `router.push("/signup?code=…")`, same error strings. What changed is
 * everything around it. This section used to be a near-black slab between two
 * checkerboard stripes with seven drifting dots behind a hand-rolled form; you
 * left the cream ground here and came back to it on the login page, which made
 * the two look like different products. It is paper now, like the page and like
 * `app/login/page.tsx`, and the card is the same `Panel` the login form uses.
 */
export default function Waitlist() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter your invite code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/activation/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (data.valid) {
        router.push(`/signup?code=${encodeURIComponent(trimmed)}`);
        return;
      }
      setError(data.error || "Invalid or expired invite code.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="waitlist"
      className="scroll-mt-20 bg-brand-cream px-4 py-16 sm:px-6 sm:py-24 lg:px-10"
    >
      <div className="mx-auto max-w-xl">
        <Reveal className="text-center">
          <p className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/60">
            Private beta
          </p>
          <h2 className="mt-4 text-balance text-title font-extrabold leading-tight tracking-tight text-ink sm:text-display">
            Start practising.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base font-medium leading-relaxed text-clay/80">
            Trace is invite-only while it is being rehearsed against a real
            audition deadline. Enter your code to create an account.
          </p>

          <ul className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
            {CUE_ORDER.map(region => (
              <li
                key={region}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CUE_PALETTE[region] }}
              />
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.06} className="mt-8">
          <Panel tone="paper" radius="2xl" className="p-5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <Field
                label="Invite code"
                name="invite-code"
                type="text"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={e => { setCode(e.target.value); if (error) setError(""); }}
                placeholder="Enter your invite code"
                error={error || undefined}
              />

              <Pressable type="submit" variant="primary" size="lg" block loading={loading}>
                {loading ? (
                  "Checking…"
                ) : (
                  <>
                    Continue To Sign Up
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </Pressable>
            </form>

            <p className="mt-5 text-center text-sm font-medium text-clay/70">
              Already have an account?{" "}
              <a
                href="/login"
                className="font-extrabold text-ink underline decoration-duo-green decoration-2 underline-offset-4"
              >
                Log in
              </a>
            </p>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}
