"use client";

import { motion } from "framer-motion";
import { FaCube } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-brand-dark border-t border-white/5 py-12">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-7xl px-6 flex flex-col items-center justify-between gap-6 md:flex-row"
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <FaCube className="text-brand-primary text-lg" />
          </motion.div>
          <span className="font-logo font-bold text-xl text-white tracking-tight">
            Trace.
          </span>
        </a>

        {/* Copyright */}
        <p className="text-sm text-white/25">
          &copy; {new Date().getFullYear()} Trace. All rights reserved.
        </p>

        {/* Links */}
        <div className="flex items-center gap-6 text-sm text-white/25">
          <a href="#" className="hover:text-white/70 transition-colors duration-200">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-white/70 transition-colors duration-200">
            Terms of Service
          </a>
        </div>
      </motion.div>
    </footer>
  );
}
