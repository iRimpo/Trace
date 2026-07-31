"use client";

import { CUE_PALETTE, CUE_ORDER, CUE_LABELS } from "@/lib/cuePalette";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";

/**
 * The hero.
 *
 * Everything here is drawn from `lib/cuePalette.ts`, the same module the
 * practice overlay draws from, so the picture on the landing page cannot drift
 * from the colours the product actually paints on your body.
 *
 * No entrance animation gates any of this. The old hero staggered five words of
 * the headline, the sub-headline, both CTAs and seven chips through framer
 * `initial={{ opacity: 0 }}`, which is 15 separate ways for the fold to render
 * empty. The only motion left is one beat dot, and it is decoration on top of
 * text that is already there.
 */

const CUE = CUE_ORDER.map(region => ({
  label: CUE_LABELS[region],
  color: CUE_PALETTE[region],
}));

// A stick figure at rest, in the joint colours the overlay uses.
const JOINTS = [
  { x: 110, y: 34,  r: 17, color: CUE_PALETTE.head,     head: true },
  { x: 78,  y: 92,  r: 7,  color: CUE_PALETTE.shoulder },
  { x: 142, y: 92,  r: 7,  color: CUE_PALETTE.shoulder },
  { x: 52,  y: 150, r: 6,  color: CUE_PALETTE.elbow },
  { x: 168, y: 150, r: 6,  color: CUE_PALETTE.elbow },
  { x: 30,  y: 202, r: 6,  color: CUE_PALETTE.hand },
  { x: 190, y: 202, r: 6,  color: CUE_PALETTE.hand },
  { x: 90,  y: 202, r: 7,  color: CUE_PALETTE.hip },
  { x: 130, y: 202, r: 7,  color: CUE_PALETTE.hip },
  { x: 80,  y: 276, r: 6,  color: CUE_PALETTE.foot },
  { x: 140, y: 276, r: 6,  color: CUE_PALETTE.foot },
  { x: 70,  y: 346, r: 6,  color: CUE_PALETTE.foot },
  { x: 150, y: 346, r: 6,  color: CUE_PALETTE.foot },
];

const BONES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6],
  [1, 7], [2, 8], [7, 8], [7, 9], [8, 10], [9, 11], [10, 12],
];

/**
 * `currentColor` throughout rather than an rgba literal, so the figure inherits
 * its ink from the class on the wrapper and adds nothing to the hex budget.
 */
function Dancer({ reference = false }: { reference?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 380"
      fill="none"
      aria-hidden="true"
      className={`h-auto w-full ${reference ? "text-ink/20" : "text-ink/30"}`}
    >
      {BONES.map(([a, b], i) => (
        <line
          key={i}
          x1={JOINTS[a].x} y1={JOINTS[a].y}
          x2={JOINTS[b].x} y2={JOINTS[b].y}
          stroke="currentColor"
          strokeWidth={reference ? 3 : 4}
          strokeLinecap="round"
        />
      ))}
      {JOINTS.map((j, i) =>
        reference ? (
          <circle key={i} cx={j.x} cy={j.y} r={j.r} fill="currentColor" />
        ) : (
          <g key={i}>
            <circle cx={j.x} cy={j.y} r={j.r + 9} fill={j.color} opacity={0.2} />
            <circle cx={j.x} cy={j.y} r={j.r} fill={j.color} />
          </g>
        ),
      )}
    </svg>
  );
}

export default function Hero() {
  return (
    <section className="bg-brand-cream px-4 pb-16 pt-24 sm:px-6 sm:pb-24 sm:pt-32 lg:px-10">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">

        {/* ── Copy ─────────────────────────────────────────────── */}
        <div>
          <p className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/70">
            On-device pose detection
          </p>

          <h1 className="mt-4 text-balance text-title font-extrabold leading-[1.05] tracking-tight text-ink sm:text-display lg:text-hero">
            See exactly where your body is off.
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-base font-medium leading-relaxed text-clay/80 sm:text-lg">
            Prop your phone across the room and dance. Trace draws the reference
            dancer over your camera, tracks 33 joints on both of you, and colours
            the parts of your body that are late or out of place.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Pressable href="#waitlist" variant="primary" size="lg">
              Get Started
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Pressable>
            <Pressable href="#how-it-works" variant="quiet" size="lg">
              How It Works
            </Pressable>
          </div>

          {/*
            The honest differentiator, stated as fact rather than as a badge.
            Nothing is uploaded because there is no upload call in the codebase.
          */}
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-hud font-extrabold uppercase tracking-[0.14em] text-clay/60">
            {["Runs in your browser", "Nothing is uploaded", "Works offline"].map(fact => (
              <li key={fact} className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-duo-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* ── The comparison, which is the whole product ───────── */}
        <Panel tone="paper" radius="2xl" className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-hud font-extrabold uppercase tracking-[0.16em] text-clay/60">
              Side by side
            </p>
            <span className="flex items-center gap-2 rounded-full border-2 border-duo-edge px-2.5 py-1">
              <span className="h-2 w-2 shrink-0 rounded-full bg-duo-green animate-pulse motion-reduce:animate-none" />
              <span className="text-hud font-extrabold tabular-nums text-clay">120 BPM</span>
            </span>
          </div>

          <div className="mt-4 flex items-end gap-2 sm:gap-4">
            <figure className="min-w-0 flex-1">
              <Dancer reference />
              <figcaption className="mt-2 text-center text-hud font-extrabold uppercase tracking-[0.16em] text-clay/50">
                Reference
              </figcaption>
            </figure>

            <div className="h-64 w-0.5 shrink-0 self-center rounded-full bg-duo-edge sm:h-80" />

            <figure className="min-w-0 flex-1">
              <Dancer />
              <figcaption className="mt-2 text-center text-hud font-extrabold uppercase tracking-[0.16em] text-ink">
                You
              </figcaption>
            </figure>
          </div>

          <div className="mt-5 border-t-2 border-duo-edge pt-4">
            <p className="text-hud font-extrabold uppercase tracking-[0.16em] text-clay/50">
              One colour per body region
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
              {CUE.map(({ label, color }) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-hud font-bold text-clay">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </section>
  );
}
