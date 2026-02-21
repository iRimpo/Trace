"use client";

import { motion } from "framer-motion";
import { FaExclamationCircle } from "react-icons/fa";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10 border border-brand-accent/20">
        <FaExclamationCircle className="text-brand-accent text-2xl" />
      </div>
      <p className="mt-4 text-sm font-medium text-brand-dark/70">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-brand-dark px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-brand-dark/10"
        >
          Try Again
        </button>
      )}
    </motion.div>
  );
}
