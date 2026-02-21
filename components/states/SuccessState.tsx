"use client";

import { motion } from "framer-motion";
import { FaCheckCircle } from "react-icons/fa";

interface Props {
  message: string;
}

export function SuccessState({ message }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ease: "backOut" }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10 border border-brand-primary/20"
      >
        <FaCheckCircle className="text-brand-primary text-2xl" />
      </motion.div>
      <p className="mt-4 text-lg font-semibold text-brand-dark">{message}</p>
    </motion.div>
  );
}
