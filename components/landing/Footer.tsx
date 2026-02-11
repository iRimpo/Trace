"use client";

import FadeIn from "@/components/ui/FadeIn";

export default function Footer() {
  return (
    <footer className="border-t border-brand-dark/[0.06] bg-white px-8 py-10 lg:px-20">
      <FadeIn>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm font-bold tracking-tight text-brand-dark">
            Trace<span className="text-brand-purple">.</span>
          </p>
          <p className="font-mono text-[10px] text-brand-dark/25">
            &copy; {new Date().getFullYear()} Trace. All rights reserved.
          </p>
        </div>
      </FadeIn>
    </footer>
  );
}
