"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const CUE_COLORS = ["#00D4FF", "#34D399", "#FBBF24", "#F97316", "#A78BFA", "#60A5FA", "#F472B6"];

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
    <>
      {/* Checkered divider white to dark */}
      <div className="h-7 w-full" style={{
        backgroundImage: "repeating-conic-gradient(#ffffff 0% 25%, #080808 0% 50%)",
        backgroundSize: "20px 20px",
      }} />

      <section
        id="waitlist"
        className="relative overflow-hidden bg-[#080808] px-4 py-16 sm:px-6 sm:py-24 lg:px-10 lg:py-32 pb-safe"
        style={{ minHeight: "auto" }}
      >
        {/* Cue-colored floating dots */}
        <div className="pointer-events-none absolute inset-0">
          {CUE_COLORS.map((c, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -20 + i * 4, 0],
                x: [0, (i % 2 ? 8 : -8), 0],
              }}
              transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
              className="absolute rounded-full"
              style={{
                width: 10 + i * 4,
                height: 10 + i * 4,
                top: `${10 + i * 12}%`,
                left: `${5 + i * 13}%`,
                backgroundColor: c,
                opacity: 0.15,
                boxShadow: `0 0 20px ${c}40`,
              }}
            />
          ))}
        </div>

        {/* Floating form card */}
        <div className="relative mx-auto max-w-sm sm:max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="mb-8 text-center font-calistoga text-[clamp(2.5rem,5vw,4rem)] leading-tight text-white">
              Ready to Actually<br />Improve?
            </h2>

            {/* Cue color dots row */}
            <div className="mb-6 flex items-center justify-center gap-2">
              {CUE_COLORS.map((c, i) => (
                <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}40` }} />
              ))}
            </div>

            {/* Card */}
            <div className="rounded-2xl bg-[#f8f4e0] p-5 shadow-2xl sm:rounded-3xl sm:p-8">
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#1a0f00]">
                    Invite code<span className="text-[#F97316]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Enter your invite code"
                    className="w-full rounded-xl border border-[#1a0f00]/15 bg-white px-4 py-3 text-sm text-[#1a0f00] placeholder-[#1a0f00]/30 outline-none transition-all focus:border-[#080808] focus:ring-2 focus:ring-[#080808]/10"
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#080808] py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? "Checking..." : "Continue to Sign up →"}
                </button>

                <p className="text-center text-xs text-[#5c3d1a]/40">
                  Private beta. Enter your invite code to create an account.
                </p>
              </motion.form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Checkered bottom divider */}
      <div className="h-7 w-full checkered-dark" />
    </>
  );
}
