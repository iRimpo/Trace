"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || mobileOpen ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
        {/* Left nav — hidden on mobile */}
        <nav className="hidden items-center gap-3 md:flex">
          <NavPill href="/" label="Home" scrolled={scrolled} />
          <NavPill href="#how-it-works" label="How it works" scrolled={scrolled} />
        </nav>

        {/* Mobile: hamburger */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg md:hidden ${
            scrolled || mobileOpen ? "text-[#1a0f00]/60" : "text-white/70"
          }`}
          aria-label="Menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>

        {/* Center logo badge */}
        <a href="/" className="absolute left-1/2 -translate-x-1/2">
          <img src="/trace_logo.svg" width="44" height="44" alt="Trace" className="rounded-full shadow-lg sm:h-[52px] sm:w-[52px]" />
        </a>

        {/* Right nav — hidden on mobile */}
        <nav className="hidden items-center gap-3 md:flex">
          <NavPill href="#features" label="Features" scrolled={scrolled} />
          {!loading && (
            <>
              {user ? (
                <NavPill href="/dashboard" label="Dashboard" filled scrolled={scrolled} />
              ) : (
                <>
                  <NavPill href="/login" label="Log in" scrolled={scrolled} />
                  <NavPill href="#waitlist" label="Sign up" filled scrolled={scrolled} />
                </>
              )}
            </>
          )}
        </nav>

        {/* Mobile: auth buttons always visible */}
        <div className="flex items-center gap-2 md:hidden">
          {!loading && (
            user ? (
              <a href="/dashboard" className="inline-flex h-8 items-center rounded-full bg-[#080808] px-4 text-xs font-semibold text-white">
                Dashboard
              </a>
            ) : (
              <>
                <a href="/login" className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium ${scrolled || mobileOpen ? "text-[#1a0f00]/60" : "text-white/70"}`}>
                  Log in
                </a>
                <a href="#waitlist" className="inline-flex h-8 items-center rounded-full bg-[#080808] px-4 text-xs font-semibold text-white">
                  Sign up
                </a>
              </>
            )
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-[#1a0f00]/08 bg-white/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 pb-4 pt-2">
              {[
                { href: "/", label: "Home" },
                { href: "#how-it-works", label: "How it works" },
                { href: "#features", label: "Features" },
              ].map((item, i) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.05 }}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1a0f00]/70 transition-colors hover:bg-[#1a0f00]/05 active:bg-[#1a0f00]/08"
                >
                  {item.label}
                </motion.a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavPill({
  href,
  label,
  filled = false,
  scrolled = false,
}: {
  href: string;
  label: string;
  filled?: boolean;
  scrolled?: boolean;
}) {
  if (filled) {
    return (
      <a
        href={href}
        className="inline-flex h-10 items-center rounded-full border border-[#080808] bg-[#080808] px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-[#1a1a1a] hover:border-[#1a1a1a]"
      >
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      className={`inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium transition-all duration-200 ${
        scrolled
          ? "border-[#1a0f00]/15 bg-white text-[#1a0f00] hover:bg-[#1a0f00] hover:text-white hover:border-[#1a0f00]"
          : "border-white/15 bg-white/8 text-white/70 hover:bg-white/15 hover:text-white backdrop-blur-sm"
      }`}
    >
      {label}
    </a>
  );
}
