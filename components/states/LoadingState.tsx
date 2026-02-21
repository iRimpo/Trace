"use client";

import { motion } from "framer-motion";

interface Props {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="relative h-12 w-12">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-brand-primary/20"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-transparent border-t-brand-accent"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-4 text-sm text-brand-dark/40"
      >
        {message}
      </motion.p>
    </div>
  );
}
