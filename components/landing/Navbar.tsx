"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Pressable from "@/components/ui/Pressable";
import IconButton from "@/components/ui/IconButton";

/**
 * The landing header, on paper.
 *
 * It used to be styled for a dark hero it no longer has: unscrolled, every link
 * was `text-white/70` on `bg-white/8` over what actually renders as cream, so
 * the nav was invisible until you scrolled 24px. Contrast now never depends on
 * scroll position — the bar is cream-on-cream with ink text at every offset,
 * and the only thing `scrolled` changes is whether the bottom rule is drawn.
 * If the scroll listener never runs, the bar is still perfectly readable.
 *
 * The composition deliberately matches `app/dashboard/layout.tsx`: mark and
 * wordmark left, actions right, 64px tall, `border-duo-edge` rule. Someone
 * arriving from the landing page and signing in should not notice the header
 * change.
 */

const LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#features", label: "Features" },
];

export default function Navbar() {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 border-b-2 bg-brand-cream/90 backdrop-blur-md",
        "transition-[border-color] duration-200 ease-out-strong",
        scrolled || mobileOpen ? "border-duo-edge" : "border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <img src="/trace_logo.svg" width="34" height="34" alt="" className="rounded-full" />
          <span className="text-hud-lg font-extrabold uppercase tracking-[0.18em] text-ink">
            Trace
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="flex h-11 items-center rounded-xl px-3 text-hud-lg font-extrabold uppercase tracking-[0.12em] text-clay/80 transition-ui duration-150 ease-out-strong hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-duo-blue"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/*
            Auth state decides which action shows, so nothing renders until it
            is known — a button that flips from "Log In" to "Dashboard" under
            the cursor is worse than one that arrives 100ms late.
          */}
          {!loading && (
            user ? (
              <Pressable href="/dashboard" variant="primary" size="sm">
                Dashboard
              </Pressable>
            ) : (
              <>
                <Pressable href="/login" variant="quiet" size="sm">
                  Log In
                </Pressable>
                <span className="hidden md:inline-flex">
                  <Pressable href="#waitlist" variant="primary" size="sm">
                    Get Started
                  </Pressable>
                </span>
              </>
            )
          )}

          <span className="md:hidden">
            <IconButton
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              active={mobileOpen}
              visual="md"
              round={false}
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </IconButton>
          </span>
        </div>
      </div>

      {/*
        The drop-down only exists while it is open, so there is no state in
        which its links are present-but-invisible. Transform and opacity only —
        the old version animated `height`, which relayouts the page every frame.
      */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            aria-label="Sections"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="border-t-2 border-duo-edge bg-brand-cream/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 pb-4 pt-3">
              {LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 items-center rounded-xl px-3 text-hud-lg font-extrabold uppercase tracking-[0.12em] text-clay transition-ui duration-150 ease-out-strong hover:bg-ink/[0.06] hover:text-ink active:bg-ink/[0.09]"
                >
                  {link.label}
                </a>
              ))}
              {!loading && !user && (
                <div className="pt-2">
                  <Pressable href="#waitlist" variant="primary" size="md" block>
                    Get Started
                  </Pressable>
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
