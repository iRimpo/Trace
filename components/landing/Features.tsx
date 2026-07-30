import { CUE_PALETTE, CUE_ORDER, CUE_LABELS } from "@/lib/cuePalette";
import Panel from "@/components/ui/Panel";
import Reveal from "./Reveal";

/**
 * What the app actually does, four claims deep.
 *
 * The old copy here was "Delicious Top Features From Our AI" over cards that
 * hardcoded `#f43f5e`, `#0891b2`, `#f59e0b` and a `bg-[#faf8f3]` card fill —
 * six raw hexes and a ground that was neither cream nor white. Cards are
 * `Panel tone="paper"` now, and every colour in them comes from the cue palette
 * the practice overlay draws with, so this page cannot claim a colour scheme
 * the product does not have.
 *
 * Each card states something checkable. "AI-powered" is not a feature; "runs
 * BlazePose in the tab and never posts the frames anywhere" is.
 */

const FEATURES = [
  {
    title: "33 keypoints, per-joint confidence",
    body:
      "MediaPipe BlazePose tracks wrists, elbows, shoulders, hips, knees and ankles, and reports how sure it is about each one. Low-confidence joints are ignored rather than guessed at.",
    color: CUE_PALETTE.shoulder,
    icon: (
      <svg width="44" height="60" viewBox="0 0 44 60" fill="none" aria-hidden="true">
        <circle cx="22" cy="7" r="6" fill={CUE_PALETTE.head} />
        <rect x="15" y="16" width="14" height="19" rx="4" fill={CUE_PALETTE.hip} />
        <rect x="2"  y="18" width="10" height="15" rx="4" fill={CUE_PALETTE.elbow} />
        <rect x="32" y="18" width="10" height="15" rx="4" fill={CUE_PALETTE.elbow} />
        <rect x="9"  y="38" width="10" height="20" rx="4" fill={CUE_PALETTE.foot} />
        <rect x="25" y="38" width="10" height="20" rx="4" fill={CUE_PALETTE.foot} />
      </svg>
    ),
  },
  {
    title: "Tempo found for you, or tapped in",
    body:
      "Trace reads the tempo off the clip's audio. When a file will not decode — Safari is strict about AAC — four taps set it by hand, and it says which of the seven failure reasons it hit.",
    color: CUE_PALETTE.armBoth,
    icon: (
      <svg width="60" height="40" viewBox="0 0 60 40" fill="none" aria-hidden="true">
        {[5, 10, 7, 18, 12, 22, 9, 16, 14, 7, 13, 11].map((h, i) => (
          <rect
            key={i}
            x={i * 4.6 + 3}
            y={(40 - h * 1.5) / 2}
            width="3.4"
            height={h * 1.5}
            rx="1.7"
            fill={CUE_PALETTE.armBoth}
            opacity={0.4 + i * 0.05}
          />
        ))}
      </svg>
    ),
  },
  {
    title: "An eight-count you can read at ten feet",
    body:
      "Counts 1–8 sit on the screen while you dance, with downbeats weighted differently from offbeats, so you always know where you are in the phrase without stopping to look.",
    color: CUE_PALETTE.hip,
    icon: (
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(c => {
          const down = c === 1 || c === 5;
          return (
            <span
              key={c}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-hud font-extrabold tabular-nums ${down ? "text-white" : "text-clay"}`}
              style={down ? { backgroundColor: CUE_PALETTE.hip } : undefined}
            >
              {c}
            </span>
          );
        })}
      </div>
    ),
  },
  {
    title: "Sway subtracted before anything fires",
    body:
      "Standing still is not standing perfectly still. Body drift is removed before cues are detected, so a cue means you moved a limb, not that you shifted your weight.",
    color: CUE_PALETTE.foot,
    icon: (
      <svg width="60" height="40" viewBox="0 0 60 40" fill="none" aria-hidden="true">
        <path
          d="M2 20 Q10 6 18 20 T34 20"
          stroke={CUE_PALETTE.hand}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path d="M38 20h16m-5-5 5 5-5 5" stroke={CUE_PALETTE.foot} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-20 bg-brand-cream px-4 py-16 sm:px-6 sm:py-24 lg:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/60">
            What it tracks
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-title font-extrabold leading-tight tracking-tight text-ink sm:text-display">
            Specific enough to fix something.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 2) * 0.06}>
              <Panel tone="paper" radius="2xl" className="flex h-full flex-col gap-4 p-5 sm:p-7">
                <div className="flex h-16 items-center">{f.icon}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-balance text-xl font-extrabold leading-snug tracking-tight text-ink">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-pretty text-base font-medium leading-relaxed text-clay/80">
                    {f.body}
                  </p>
                </div>
                <span
                  className="h-1.5 w-10 shrink-0 rounded-full"
                  style={{ backgroundColor: f.color }}
                />
              </Panel>
            </Reveal>
          ))}
        </div>

        {/*
          The legend is the product's actual vocabulary, so it belongs in the
          pitch rather than only in the app. Same source module as the overlay.
        */}
        <Reveal delay={0.1} className="mt-3">
          <Panel tone="paper" radius="2xl" className="p-5 sm:p-7">
            <p className="text-hud font-extrabold uppercase tracking-[0.16em] text-clay/50">
              The seven cue colours
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
              {CUE_ORDER.map(region => (
                <li key={region} className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CUE_PALETTE[region] }}
                  />
                  <span className="text-hud-lg font-extrabold text-clay">
                    {CUE_LABELS[region]}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}
