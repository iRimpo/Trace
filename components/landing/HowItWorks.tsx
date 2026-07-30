import { CUE_PALETTE } from "@/lib/cuePalette";
import Panel from "@/components/ui/Panel";
import Pressable from "@/components/ui/Pressable";
import Reveal from "./Reveal";

/**
 * Three steps, in the order a dancer actually does them.
 *
 * The previous version was a headline ("Where Every Move Tells a Story") over a
 * fan of five tilted cards that overlapped each other on desktop and collapsed
 * into an unrelated 2-column grid on mobile — two layouts, neither of which
 * explained the sequence. Steps are ordinal, so they get a numbered column that
 * reads the same on both.
 */

const STEPS = [
  {
    n: "01",
    title: "Add the clip you're learning",
    body:
      "Pick the video off your phone. It goes into the browser's own storage on this device — there is no upload and no waiting.",
    color: CUE_PALETTE.shoulder,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V4m0 0L7.5 8.5M12 4l4.5 4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Prop the phone and dance",
    body:
      "The reference dancer is drawn over your camera feed. Drag and pinch to line them up with your body, then run it. Everything on screen is sized to be read from across the room.",
    color: CUE_PALETTE.hip,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <rect x="6" y="2.5" width="12" height="19" rx="3" />
        <path strokeLinecap="round" d="M10.5 5.5h3" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "See which joint was late",
    body:
      "Trace detects the tempo, lays an eight-count over the clip, and lights up the body region that missed it. One cue per count, so there is exactly one thing to fix.",
    color: CUE_PALETTE.foot,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8.5" />
        <path strokeLinecap="round" d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 bg-brand-cream px-4 py-16 sm:px-6 sm:py-24 lg:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/60">
            How it works
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-title font-extrabold leading-tight tracking-tight text-ink sm:text-display">
            Three steps, then you are dancing.
          </h2>
        </Reveal>

        <ol className="mt-10 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step.n}>
              <Reveal delay={i * 0.06}>
                <Panel tone="paper" radius="2xl" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-7">
                  <div className="flex shrink-0 items-center gap-4">
                    {/* The tile carries the region colour the overlay would use
                        for this step, so the legend in the hero and the steps
                        here are the same vocabulary. */}
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-duo-edge"
                      style={{ color: step.color }}
                    >
                      {step.icon}
                    </span>
                    <span className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/50 tabular-nums sm:hidden">
                      Step {step.n}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="hidden text-hud font-extrabold uppercase tracking-[0.2em] text-clay/50 tabular-nums sm:block">
                      Step {step.n}
                    </p>
                    <h3 className="mt-0 text-xl font-extrabold tracking-tight text-ink sm:mt-1.5 sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-pretty text-base font-medium leading-relaxed text-clay/80">
                      {step.body}
                    </p>
                  </div>
                </Panel>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal delay={0.1} className="mt-8">
          <Pressable href="#features" variant="quiet" size="lg">
            See What It Tracks
          </Pressable>
        </Reveal>
      </div>
    </section>
  );
}
