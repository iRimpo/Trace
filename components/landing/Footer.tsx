import Link from "next/link";
import { CUE_ORDER, CUE_PALETTE } from "@/lib/cuePalette";

/**
 * Deliberately not a client component.
 *
 * The only reason the old footer had `"use client"` was a framer fade that
 * animated its opacity from 0 — a whole footer that existed only if JavaScript
 * finished. Without that it is static markup, so the year is computed on the
 * server and there is no hydration mismatch to guard against either.
 *
 * The mark matches `app/dashboard/layout.tsx` and `app/login/page.tsx`: the
 * real logo file and the same uppercase, letterspaced wordmark, rather than a
 * third hand-drawn hexagon that appeared nowhere else in the app.
 */
export default function Footer() {
  return (
    <footer className="border-t-2 border-duo-edge bg-brand-cream px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/trace_logo.svg" width="32" height="32" alt="" className="rounded-full" />
          <span className="text-hud-lg font-extrabold uppercase tracking-[0.18em] text-ink">
            Trace
          </span>
        </Link>

        <ul className="flex items-center gap-2" aria-hidden="true">
          {CUE_ORDER.map(region => (
            <li
              key={region}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CUE_PALETTE[region] }}
            />
          ))}
        </ul>

        <div className="flex flex-col items-center gap-3 md:flex-row md:gap-6">
          <nav className="flex items-center gap-1" aria-label="Legal">
            {["Privacy Policy", "Terms of Service"].map(label => (
              <a
                key={label}
                href="#"
                className="flex h-11 items-center rounded-xl px-3 text-hud font-bold uppercase tracking-[0.12em] text-clay/70 transition-ui duration-150 ease-out-strong hover:bg-ink/[0.06] hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <p className="text-hud font-bold uppercase tracking-[0.12em] text-clay/50">
            &copy; {new Date().getFullYear()} Trace
          </p>
        </div>
      </div>
    </footer>
  );
}
