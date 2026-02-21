"use client";

import { motion } from "framer-motion";
import { FaCube, FaArrowRight } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, loading } = useAuth();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.075, 0.82, 0.165, 1] }}
      className="absolute left-0 top-0 z-50 w-full px-6 py-5 lg:px-12"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <FaCube className="text-brand-primary text-xl" />
          </motion.div>
          <span className="font-logo font-semibold text-2xl text-brand-dark tracking-tight">
            Trace.
          </span>
        </a>

        {/* Nav links */}
        <div className="hidden items-center gap-8 md:flex">
          {[
            { label: "How it works", href: "#how-it-works" },
            { label: "Features",     href: "#features"     },
            { label: "Waitlist",     href: "#waitlist"     },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm text-brand-dark/50 hover:text-brand-dark transition-colors duration-200"
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        {!loading && (
          <a
            href={user ? "/dashboard" : "#waitlist"}
            className="group relative flex items-center overflow-hidden rounded-full bg-brand-dark p-[2px] shadow-lg shadow-brand-primary/20"
          >
            {/* Ink-flood circle */}
            <div className="absolute left-2 h-7 w-7 rounded-full bg-brand-primary transition-transform duration-[1200ms] ease-out group-hover:scale-[35]" />
            <span className="relative z-10 pl-10 pr-4 py-2 text-sm font-noname font-semibold text-white transition-colors duration-[900ms] group-hover:text-white">
              {user ? "Dashboard" : "Join Waitlist"}
            </span>
            <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white mr-0.5">
              <FaArrowRight className="text-[10px]" />
            </div>
          </a>
        )}
      </div>
    </motion.nav>
  );
}
