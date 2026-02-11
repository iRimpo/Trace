"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  blur?: boolean;
}

export default function FadeIn({
  children,
  delay = 0,
  className = "",
  blur = false,
}: FadeInProps) {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.15,
  });

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: 24,
        filter: blur ? "blur(10px)" : "blur(0px)",
      }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : {}
      }
      transition={{
        duration: 0.8,
        delay,
        ease: [0.075, 0.82, 0.165, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
