"use client";

import { motion } from "framer-motion";

const CUE = {
  hand: "#00D4FF", foot: "#34D399", head: "#FBBF24",
  elbow: "#F97316", hip: "#A78BFA", shoulder: "#60A5FA", arm: "#F472B6",
};

const FEATURES = [
  {
    title: "33 Keypoints",
    sub: "Full body coverage",
    desc: "MediaPipe BlazePose tracks every major joint — wrists, elbows, shoulders, hips, knees, ankles, and more — with per-joint confidence scoring.",
    accent: CUE.shoulder,
    icon: (
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
        <circle cx="24" cy="7"  r="5.5" fill={CUE.head} opacity="0.9"/>
        <rect x="17" y="14" width="14" height="18" rx="3.5" fill={CUE.hip} opacity="0.7"/>
        <rect x="4"  y="16" width="12" height="14" rx="3.5" fill={CUE.elbow} opacity="0.5"/>
        <rect x="32" y="16" width="12" height="14" rx="3.5" fill={CUE.elbow} opacity="0.5"/>
        <rect x="10" y="34" width="11" height="26" rx="3.5" fill={CUE.foot} opacity="0.6"/>
        <rect x="27" y="34" width="11" height="26" rx="3.5" fill={CUE.foot} opacity="0.6"/>
      </svg>
    ),
  },
  {
    title: "Auto BPM",
    sub: "Beat detection",
    desc: "Analyzes audio to lock on the exact tempo. Tap to override, or nudge beat-1 to any frame. Guidance cues fire on the beat, every time.",
    accent: CUE.arm,
    icon: (
      <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
        {[5,10,7,18,12,22,9,16,14,7,13,11].map((h,i)=>(
          <rect key={i} x={i*4+4} y={(40-h*1.5)/2} width="3.5" height={h*1.5} rx="1.75" fill={CUE.arm} opacity={0.35+i*0.04}/>
        ))}
      </svg>
    ),
  },
  {
    title: "8-Count Grid",
    sub: "Beat-synced overlay",
    desc: "Counts 1–8 displayed on screen. Downbeats, snares, and offbeats styled differently so you always know where you are in the phrase.",
    accent: CUE.hip,
    icon: (
      <div className="grid grid-cols-4 gap-1.5">
        {[1,2,3,4,5,6,7,8].map(c=>(
          <div key={c} className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
            style={{
              background: c===1||c===5 ? CUE.hip : `${CUE.hip}15`,
              color: c===1||c===5 ? "white" : CUE.hip,
            }}
          >{c}</div>
        ))}
      </div>
    ),
  },
  {
    title: "Noise Filter",
    sub: "Relative displacement",
    desc: "Body sway is subtracted before cue detection. Only intentional movement triggers guidance — no false positives from natural swaying.",
    accent: CUE.foot,
    icon: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-500 line-through">false trigger</span>
        </div>
        <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
          <path d="M2 8h36M30 3l8 5-8 5" stroke={CUE.foot} strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold self-start" style={{ background: `${CUE.foot}20`, color: CUE.foot }}>filtered ✓</span>
      </div>
    ),
  },
];

export default function Features() {
  return (
    <>
      <div className="h-7 w-full" style={{
        backgroundImage: "repeating-conic-gradient(#f8f4e0 0% 25%, #ffffff 0% 50%)",
        backgroundSize: "20px 20px",
      }} />

      <section id="features" className="bg-white py-24 px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-14 text-center"
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#1a0f00]/30">
              Features
            </p>
            <h2 className="font-calistoga text-[clamp(2.4rem,5vw,4rem)] leading-tight text-[#1a0f00]">
              Delicious Top Features<br />From Our AI
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group rounded-2xl border border-[#1a0f00]/08 bg-[#faf8f3] p-6 flex flex-col gap-4"
              >
                <div className="flex h-20 items-center justify-start">
                  {f.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-calistoga text-xl text-[#1a0f00]">{f.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider" style={{ color: f.accent }}>
                    {f.sub}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5c3d1a]/60">{f.desc}</p>
                </div>
                <div className="h-0.5 w-8 rounded-full transition-all duration-300 group-hover:w-16" style={{ background: f.accent }} />
              </motion.div>
            ))}
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-10 border-t border-[#1a0f00]/06 pt-10"
          >
            {[
              { value: "33", label: "Body keypoints" },
              { value: "60fps", label: "Real-time tracking" },
              { value: "7", label: "Cue color types" },
              { value: "8-ct", label: "Beat-synced counts" },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-0.5">
                <span className="font-calistoga text-3xl text-[#1a0f00]">{s.value}</span>
                <span className="text-xs text-[#5c3d1a]/50">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
