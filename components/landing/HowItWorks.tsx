"use client";

import { motion } from "framer-motion";
import { FaEye, FaVideo, FaChartLine } from "react-icons/fa";

const steps = [
  {
    num: "01",
    icon: FaEye,
    color: "from-brand-primary to-blue-500",
    glow: "shadow-brand-primary/25",
    title: "TRACE",
    description:
      "Follow the AI skeleton overlay synced to a reference dancer. See exactly where your body should be, beat by beat.",
  },
  {
    num: "02",
    icon: FaVideo,
    color: "from-brand-accent to-orange-400",
    glow: "shadow-brand-accent/25",
    title: "TEST",
    description:
      "Record yourself performing the same routine. Your webcam captures every joint and angle in real time.",
  },
  {
    num: "03",
    icon: FaChartLine,
    color: "from-violet-500 to-brand-primary",
    glow: "shadow-violet-400/25",
    title: "SYNC",
    description:
      "Get instant AI feedback with a frame-by-frame comparison. See your score improve every session.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.075, 0.82, 0.165, 1] as [number, number, number, number] },
  },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-white px-8 py-24 sm:py-32 lg:px-16">
      {/* Subtle background tint */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-bg via-white to-white" />

      <div className="relative mx-auto max-w-[1200px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="font-mono text-xs font-bold tracking-widest text-brand-primary uppercase">
            The Process
          </span>
          <h2 className="mt-3 font-hero font-bold text-4xl lg:text-5xl text-brand-dark tracking-tight">
            Three steps to move like a pro
          </h2>
          <p className="mt-4 text-brand-dark/45 text-lg max-w-xl mx-auto">
            From watching to mastering — Trace closes the gap between where you are and where you want to be.
          </p>
        </motion.div>

        {/* Steps grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-20 grid gap-8 sm:grid-cols-3"
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="group relative flex flex-col rounded-3xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-xl hover:shadow-brand-primary/8 transition-shadow duration-300"
            >
              {/* Step number watermark */}
              <span className="absolute top-6 right-7 font-hero font-bold text-6xl text-gray-50 select-none pointer-events-none">
                {step.num}
              </span>

              {/* Icon */}
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg ${step.glow} mb-6`}
              >
                <step.icon className="text-white text-xl" />
              </div>

              {/* Content */}
              <h3 className="font-hero font-bold text-2xl tracking-tight text-brand-dark">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-dark/45">
                {step.description}
              </p>

              {/* Progress bar animation on hover */}
              <div className="mt-6 h-0.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${step.color}`}
                  initial={{ width: "0%" }}
                  whileInView={{ width: `${[72, 88, 95][i]}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.15, duration: 1.2, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
