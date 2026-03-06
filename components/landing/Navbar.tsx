"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        {/* Left nav */}
        <nav className="flex items-center gap-3">
          <NavPill href="/" label="Home" scrolled={scrolled} />
          <NavPill href="#how-it-works" label="How it works" scrolled={scrolled} />
        </nav>

        {/* Center logo badge */}
        <a href="/" className="absolute left-1/2 -translate-x-1/2">
          <img src="/trace_logo.svg" width="52" height="52" alt="Trace" className="rounded-full shadow-lg" />
        </a>

        {/* Right nav */}
        <nav className="flex items-center gap-3">
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
      </div>
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
