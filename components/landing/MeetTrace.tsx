import Panel from "@/components/ui/Panel";
import StatTile from "@/components/ui/StatTile";
import Reveal from "./Reveal";

/**
 * "Meet Trace" — the plain statement of what the thing is.
 *
 * This section used to be four lines of 96px word-art with gradient bubbles
 * ("Skeleton ◼ Tracking", "Beat ◼ Sync") and four raw hex badges, all of it
 * hidden behind a framer `whileInView` fade. It said almost nothing a dancer
 * could act on. The claim below is one anybody can check: pose detection runs
 * in the tab, and no line of this codebase uploads a video.
 *
 * The numbers are static text, deliberately. `CountUp` starts at 0 and counts
 * up on view, so without JavaScript the page would read "0 joints tracked" —
 * wrong content is worse than no animation.
 */

const FACTS = [
  { value: "33", label: "Joints tracked",  accent: "ink" as const },
  { value: "7",  label: "Cue colours",     accent: "blue" as const },
  { value: "0",  label: "Videos uploaded", accent: "green" as const },
];

export default function MeetTrace() {
  return (
    <section className="bg-brand-cream px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-hud font-extrabold uppercase tracking-[0.2em] text-clay/60">
            Meet Trace
          </p>
          <h2 className="mt-4 max-w-3xl text-balance text-title font-extrabold leading-tight tracking-tight text-ink sm:text-display">
            A mirror that already knows the choreography.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-base font-medium leading-relaxed text-clay/80 sm:text-lg">
            A mirror shows you what you are doing. It cannot show you what you
            were supposed to be doing. Trace holds the reference clip and your
            camera in the same frame, runs pose detection on both, and marks the
            joints that disagree — on the count, while you are still standing in
            the position that caused it.
          </p>
        </Reveal>

        <Reveal delay={0.06} className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row">
            {FACTS.map(fact => (
              <StatTile key={fact.label} value={fact.value} label={fact.label} accent={fact.accent} />
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.12} className="mt-3">
          <Panel tone="paper" radius="2xl" className="p-5 sm:p-7">
            <p className="text-hud font-extrabold uppercase tracking-[0.16em] text-clay/50">
              Where the work happens
            </p>
            <p className="mt-3 text-pretty text-base font-medium leading-relaxed text-clay/80">
              MediaPipe BlazePose runs inside your browser tab, on your own
              hardware. Your clip is stored on the device in IndexedDB, and the
              only thing that ever reaches a server is your account. There is no
              upload step to wait through, no queue, and nothing to delete
              afterwards.
            </p>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}
