"use client";

import { motion } from "framer-motion";

const TESTIMONIALS = [
  {
    quote:
      "I was stuck on the same 8-count for weeks. Trace showed me my left elbow was a full beat late — fixed it in one session.",
    name: "Mia T.",
    handle: "@mia.moves",
    role: "Hip-hop dancer, 3 yrs",
    avatar: "MT",
    accent: "#6366f1",
  },
  {
    quote:
      "The beat-synced cues are insane. I don't have to pause the video anymore — I just dance and the guidance tells me exactly where I'm off.",
    name: "Jordan K.",
    handle: "@jkdances",
    role: "Popping & locking",
    avatar: "JK",
    accent: "#00d4ff",
  },
  {
    quote:
      "I've tried filming myself, mirroring, slowing down clips. Nothing clicked until Trace. The joint colors make it immediately obvious.",
    name: "Aisha R.",
    handle: "@aisha.rhythm",
    role: "Contemporary & afro",
    avatar: "AR",
    accent: "#34d399",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-[#080810] py-24 px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-14 text-center"
        >
          <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest text-white/40">
            Testimonials
          </span>
          <h2 className="mt-5 font-hero text-4xl font-bold tracking-tight text-white lg:text-5xl">
            Dancers who leveled up
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group relative rounded-2xl border border-white/[0.06] bg-[#0d0d1a] p-6 overflow-hidden"
            >
              {/* Hover glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${t.accent}10 0%, transparent 65%)`,
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `linear-gradient(90deg, transparent, ${t.accent}40, transparent)`,
                }}
              />

              {/* Quote marks */}
              <div
                className="mb-4 font-hero text-4xl font-bold leading-none select-none"
                style={{ color: `${t.accent}40` }}
              >
                &ldquo;
              </div>

              <p className="text-sm leading-relaxed text-white/60">{t.quote}</p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: `${t.accent}25`, border: `1px solid ${t.accent}30` }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white">{t.name}</span>
                    <span className="text-xs text-white/25">{t.handle}</span>
                  </div>
                  <span className="text-[11px] text-white/25">{t.role}</span>
                </div>
              </div>

              {/* Star rating */}
              <div className="mt-4 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, si) => (
                  <svg key={si} width="12" height="12" viewBox="0 0 12 12" fill={t.accent} opacity={0.8}>
                    <path d="M6 1l1.236 3.8H11L8.118 6.9l1.236 3.8L6 8.6l-3.354 2.1L3.882 6.9 1 4.8h3.764L6 1z" />
                  </svg>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
