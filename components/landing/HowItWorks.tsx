"use client";

import { motion } from "framer-motion";

const CARDS = [
  {
    title: "Ghost Mirror",
    desc: "Reference dancer overlaid on your feed",
    accent: "#60A5FA",
    rotate: -8,
    icon: (
      <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
        <circle cx="20" cy="8" r="6" fill="#FBBF24" opacity="0.9"/>
        <rect x="13" y="16" width="14" height="20" rx="4" fill="#A78BFA" opacity="0.7"/>
        <rect x="4" y="18" width="8" height="16" rx="4" fill="#F97316" opacity="0.5"/>
        <rect x="28" y="18" width="8" height="16" rx="4" fill="#F97316" opacity="0.5"/>
        <rect x="9" y="38" width="9" height="18" rx="4" fill="#34D399" opacity="0.6"/>
        <rect x="22" y="38" width="9" height="18" rx="4" fill="#34D399" opacity="0.6"/>
      </svg>
    ),
  },
  {
    title: "Beat Sync",
    desc: "Cues fire exactly on the count",
    accent: "#f43f5e",
    rotate: 5,
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" fill="none">
        {[6,12,8,20,14,24,10,18,16,8,14,12].map((h,i)=>(
          <rect
            key={i}
            x={i*4+2}
            y={(36-h*1.2)/2}
            width="3"
            height={h*1.2}
            rx="1.5"
            fill="#f43f5e"
            opacity={0.4+i*0.04}
          />
        ))}
      </svg>
    ),
  },
  {
    title: "7 Cue Colors",
    desc: "Every body region has its own color",
    accent: "#0891b2",
    rotate: -4,
    icon: (
      <div className="flex flex-wrap gap-2 p-1">
        {["#00d4ff","#34d399","#fbbf24","#f97316","#a78bfa","#60a5fa","#f472b6"].map((c,i)=>(
          <div key={i} className="h-6 w-6 rounded-full" style={{background:c}}/>
        ))}
      </div>
    ),
  },
  {
    title: "60 FPS",
    desc: "Real-time analysis, zero lag",
    accent: "#059669",
    rotate: 7,
    icon: (
      <div className="font-calistoga text-5xl font-bold text-emerald-500 leading-none">60</div>
    ),
  },
  {
    title: "Progress",
    desc: "Every session logged automatically",
    accent: "#f59e0b",
    rotate: -6,
    icon: (
      <svg width="56" height="40" viewBox="0 0 56 40" fill="none">
        {[10,16,12,22,18,28,24,32].map((h,i)=>(
          <rect
            key={i}
            x={i*6+2}
            y={40-h}
            width="5"
            height={h}
            rx="2.5"
            fill="#f59e0b"
            opacity={0.4+i*0.07}
          />
        ))}
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <>
      {/* Checkered stripe transitioning from white to cream */}
      <div className="h-7 w-full checkered-brown" />

      {/* Story section */}
      <section id="how-it-works" className="bg-[#f8f4e0] py-16 px-4 sm:py-28 sm:px-6 lg:px-10 relative overflow-hidden">
        {/* Floating decorative joint dots */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 left-12 h-10 w-10 rounded-full bg-[#60A5FA]/20 border-2 border-[#60A5FA]/30"
          />
          <motion.div
            animate={{ y: [0, 14, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-40 right-16 h-7 w-7 rounded-full bg-[#F472B6]/20 border-2 border-[#F472B6]/30"
          />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-32 left-24 h-5 w-5 rounded-full bg-[#00D4FF]/20 border-2 border-[#00D4FF]/30"
          />
          <motion.div
            animate={{ y: [0, 16, 0], x: [0, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-24 right-20 h-8 w-8 rounded-full bg-[#34D399]/20 border-2 border-[#34D399]/30"
          />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-calistoga text-[clamp(2.8rem,6vw,5rem)] leading-[1.1] text-[#1a0f00]">
              Where Every Move<br />Tells a Story
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[#5c3d1a]/70 max-w-xl mx-auto">
              Trace overlays AI-guided cues directly on your reference video — every joint
              color-coded and beat-synced, so you always know exactly where to move
              and exactly when.
            </p>
            <a
              href="#features"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full border-2 border-[#1a0f00]/20 bg-transparent px-8 text-sm font-semibold text-[#1a0f00] transition-all duration-200 hover:bg-[#1a0f00] hover:text-[#f8f4e0]"
            >
              See the features
            </a>
          </motion.div>
        </div>
      </section>

      {/* Tilted card gallery — scrollable on mobile, overlapping on desktop */}
      <section className="bg-[#f8f4e0] pb-16 sm:pb-28 overflow-hidden">
        {/* Mobile: horizontal scroll */}
        <div className="relative md:hidden">
          {/* Fade-right indicator */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-12 z-10 bg-gradient-to-l from-[#f8f4e0] to-transparent" />
        <div className="flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="w-44 flex-shrink-0 snap-center"
            >
              <div
                className="rounded-2xl border-2 bg-white p-4 shadow-lg flex flex-col gap-3"
                style={{ borderColor: `${card.accent}35` }}
              >
                <div className="flex h-14 items-center justify-center">{card.icon}</div>
                <div>
                  <p className="font-calistoga text-base text-[#1a0f00] leading-tight">{card.title}</p>
                  <p className="mt-1 text-[11px] text-[#5c3d1a]/60 leading-snug">{card.desc}</p>
                </div>
                <div className="h-2 w-2 rounded-full" style={{ background: card.accent }} />
              </div>
            </motion.div>
          ))}
        </div>
        </div>

        {/* Desktop: overlapping tilted cards */}
        <div
          className="relative mx-auto hidden items-center justify-center md:flex"
          style={{ height: 320, maxWidth: 900 }}
        >
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40, rotate: card.rotate }}
              whileInView={{ opacity: 1, y: 0, rotate: card.rotate }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -12, rotate: 0, scale: 1.05, zIndex: 20, transition: { duration: 0.25 } }}
              className="absolute cursor-default"
              style={{
                left: `${8 + i * 17}%`,
                zIndex: i + 1,
              }}
            >
              <div
                className="w-44 rounded-2xl border-2 bg-white p-5 shadow-xl flex flex-col gap-3"
                style={{ borderColor: `${card.accent}35` }}
              >
                <div className="flex h-16 items-center justify-center">{card.icon}</div>
                <div>
                  <p className="font-calistoga text-lg text-[#1a0f00] leading-tight">{card.title}</p>
                  <p className="mt-1 text-xs text-[#5c3d1a]/60 leading-snug">{card.desc}</p>
                </div>
                <div className="h-2 w-2 rounded-full" style={{ background: card.accent }} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
