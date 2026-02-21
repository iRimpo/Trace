"use client";

import { motion } from "framer-motion";
import { FaLayerGroup, FaRulerCombined, FaSyncAlt, FaChartBar } from "react-icons/fa";

const features = [
  {
    icon: FaLayerGroup,
    color: "text-brand-primary",
    bg: "bg-brand-primary/8",
    border: "border-brand-primary/15",
    title: "Skeleton Overlay",
    description:
      "AI pose estimation maps 33 key points and renders the reference dancer's skeleton directly on your webcam feed for instant visual comparison.",
  },
  {
    icon: FaRulerCombined,
    color: "text-brand-accent",
    bg: "bg-brand-accent/8",
    border: "border-brand-accent/15",
    title: "Angle Analysis",
    description:
      "Measures joint angles across every frame and flags exactly where you deviate — hip tilt, arm extension, knee bend and more.",
  },
  {
    icon: FaSyncAlt,
    color: "text-violet-500",
    bg: "bg-violet-500/8",
    border: "border-violet-500/15",
    title: "Timing Sync",
    description:
      "Automatic beat-alignment means your movement and the reference are always compared at the correct musical moment, not just frame number.",
  },
  {
    icon: FaChartBar,
    color: "text-emerald-500",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/15",
    title: "Progress Tracking",
    description:
      "Log every session, watch your accuracy score climb, and surface recurring weak spots so you can drill the parts that actually matter.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  hidden:  { opacity: 0, scale: 0.93, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.075, 0.82, 0.165, 1] as [number, number, number, number] },
  },
};

export default function Features() {
  return (
    <section id="features" className="bg-brand-bg px-8 py-24 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs font-bold tracking-widest text-brand-primary uppercase">
            Features
          </span>
          <h2 className="mt-3 font-hero font-bold text-4xl lg:text-5xl text-brand-dark tracking-tight">
            Everything you need to level up
          </h2>
          <p className="mt-4 text-brand-dark/45 text-lg max-w-xl mx-auto">
            Precision tools built for serious dancers who want more than just vibes from their practice.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid gap-5 sm:grid-cols-2"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={cardVariants}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`group rounded-3xl border ${f.border} bg-white p-8 transition-shadow duration-300 hover:shadow-xl hover:shadow-brand-primary/8`}
            >
              {/* Icon */}
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.bg} border ${f.border} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <f.icon className={`text-lg ${f.color}`} />
              </div>

              <h3 className="font-hero font-bold text-xl tracking-tight text-brand-dark">
                {f.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-dark/45">
                {f.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
