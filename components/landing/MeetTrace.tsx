"use client";

import { motion } from "framer-motion";

function Bubble({
  children,
  className = "",
  badge,
}: {
  children: React.ReactNode;
  className?: string;
  badge?: { color: string; icon: React.ReactNode };
}) {
  return (
    <span className="relative inline-flex align-middle mx-3 shrink-0" style={{ verticalAlign: "-0.25em" }}>
      <span
        className={`inline-flex h-[60px] w-[84px] sm:h-[80px] sm:w-[110px] items-center justify-center rounded-[20px] sm:rounded-[28px] overflow-hidden shadow-lg ${className}`}
      >
        {children}
      </span>
      {badge && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full shadow-md text-white"
          style={{ background: badge.color, fontSize: 11 }}
        >
          {badge.icon}
        </span>
      )}
    </span>
  );
}

const lineVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

export default function MeetTrace() {
  return (
    <section className="bg-white py-16 px-6 lg:px-10 overflow-hidden">
      <div className="mx-auto max-w-5xl">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center text-base font-semibold text-[#1a0f00]/40 tracking-wide"
        >
          Meet Trace
        </motion.p>

        {/* Feature word lines */}
        <div className="space-y-2 text-center leading-none">

          {/* Line 1: Skeleton [bubble] Tracking */}
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={lineVariants}
            className="flex flex-wrap items-center justify-center"
          >
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Skeleton
            </span>
            <Bubble
              className="bg-gradient-to-br from-indigo-400 to-violet-600"
              badge={{ color: "#4f46e5", icon: "●" }}
            >
              {/* Joint dot pattern */}
              <svg width="70" height="50" viewBox="0 0 70 50" fill="none">
                {[[35,8],[20,20],[50,20],[15,38],[35,32],[55,38]].map(([x,y],i)=>(
                  <circle key={i} cx={x} cy={y} r="5" fill="white" opacity={0.7 + i*0.05}/>
                ))}
                <line x1="35" y1="8" x2="20" y2="20" stroke="white" strokeWidth="1.5" opacity="0.4"/>
                <line x1="35" y1="8" x2="50" y2="20" stroke="white" strokeWidth="1.5" opacity="0.4"/>
                <line x1="35" y1="32" x2="15" y2="38" stroke="white" strokeWidth="1.5" opacity="0.4"/>
                <line x1="35" y1="32" x2="55" y2="38" stroke="white" strokeWidth="1.5" opacity="0.4"/>
              </svg>
            </Bubble>
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Tracking
            </span>
          </motion.div>

          {/* Line 2: Beat [bubble] Sync */}
          <motion.div
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={lineVariants}
            className="flex flex-wrap items-center justify-center"
          >
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Beat
            </span>
            <Bubble
              className="bg-gradient-to-br from-pink-400 to-rose-600"
              badge={{ color: "#f43f5e", icon: "♪" }}
            >
              {/* Waveform */}
              <svg width="80" height="44" viewBox="0 0 80 44" fill="none">
                {[4,8,14,6,18,10,22,8,12,16,6,10].map((h,i)=>(
                  <rect
                    key={i}
                    x={i*6+4}
                    y={(44-h*1.6)/2}
                    width="4"
                    height={h*1.6}
                    rx="2"
                    fill="white"
                    opacity={0.55 + i*0.02}
                  />
                ))}
              </svg>
            </Bubble>
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Sync
            </span>
          </motion.div>

          {/* Line 3: Joint [bubble] Guidance */}
          <motion.div
            custom={2}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={lineVariants}
            className="flex flex-wrap items-center justify-center"
          >
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Joint
            </span>
            <Bubble
              className="bg-gradient-to-br from-cyan-400 to-blue-600"
              badge={{ color: "#0891b2", icon: "◆" }}
            >
              {/* Color swatches */}
              <div className="flex flex-wrap justify-center gap-1.5 p-2">
                {["#00d4ff","#34d399","#fbbf24","#f97316","#a78bfa","#60a5fa","#f472b6"].map((c,i)=>(
                  <div key={i} className="h-4 w-4 rounded-full" style={{background:c,opacity:0.9}}/>
                ))}
              </div>
            </Bubble>
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Guidance
            </span>
          </motion.div>

          {/* Line 4: Progress [bubble] */}
          <motion.div
            custom={3}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={lineVariants}
            className="flex flex-wrap items-center justify-center"
          >
            <span className="font-sans font-black text-[#1a0f00]" style={{ fontSize: "clamp(2rem,7vw,6rem)" }}>
              Progress
            </span>
            <Bubble
              className="bg-gradient-to-br from-emerald-400 to-green-600"
              badge={{ color: "#059669", icon: "↑" }}
            >
              {/* Bar chart */}
              <svg width="70" height="44" viewBox="0 0 70 44" fill="none">
                {[18,28,22,36,30,40].map((h,i)=>(
                  <rect
                    key={i}
                    x={i*10+4}
                    y={44-h}
                    width="7"
                    height={h}
                    rx="3"
                    fill="white"
                    opacity={0.5+i*0.08}
                  />
                ))}
              </svg>
            </Bubble>
          </motion.div>

        </div>

        {/* Sub-caption */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 text-center text-lg text-[#1a0f00]/40 max-w-lg mx-auto leading-relaxed"
        >
          33 keypoints tracked in real-time. Every joint color-coded.
          Beat-synced so you know exactly when and where to move.
        </motion.p>
      </div>
    </section>
  );
}
