"use client";

import Panel from "@/components/ui/Panel";

/**
 * The loading state of *this* dashboard.
 *
 * It previously drew a different page: a `max-w-5xl` container (the dashboard
 * is `max-w-3xl`), a 2×4 grid of stat cards (the dashboard has a single row of
 * four tiles), a bar-chart placeholder for a chart that is not on this screen,
 * and six video cards in a three-column grid for a list that is a single
 * column of song cards. Loading looked like one product and loaded like
 * another, so every load ended in a layout jump.
 *
 * Shapes now match the real thing: greeting card, four tiles, three song cards.
 * Nothing here has content, so nothing here has text — a skeleton that guesses
 * at word lengths is just a second layout to keep in sync.
 *
 * `motion-reduce:animate-pulse`, not `animate-none`: opacity is not a
 * vestibular trigger, and a loading indicator that stops indicating is worse
 * than one that keeps breathing.
 *
 * Every card here is a real `Panel`, not a hand-rolled `bg-white shadow-card`.
 * A skeleton whose depth is copied rather than borrowed drifts the moment the
 * card it stands in for changes, and drifting is the one thing a skeleton must
 * not do.
 *
 * It comes in pieces as well as whole. The default export is the *page*
 * skeleton and belongs only where nothing has rendered yet — the Suspense
 * fallback. Once the page frame is up, its greeting and its section header are
 * already on screen, and dropping the whole-page skeleton underneath them drew
 * a second greeting card and a second "Your practice" rule below the real ones.
 * `StatRowSkeleton` and `SongListSkeleton` are the two parts that are actually
 * still waiting.
 */

function Bone({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-ink/[0.08] animate-pulse motion-reduce:animate-pulse ${className}`} />;
}

function SongCardSkeleton() {
  return (
    <Panel tone="paper" radius="2xl" className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Bone className="h-12 w-16 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Bone className="h-4 w-2/5" />
          <Bone className="h-3 w-1/4" />
        </div>
        <Bone className="h-8 w-16 shrink-0" />
      </div>
      <Bone className="mt-4 h-3 w-full rounded-full" />
      <Bone className="mt-4 h-11 w-full rounded-2xl" />
    </Panel>
  );
}

/** The four stat tiles, in `StatTile`'s exact geometry. */
export function StatRowSkeleton() {
  return (
    <div className="mt-2 flex gap-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Panel key={i} tone="paper" radius="xl" className="flex flex-1 flex-col items-center gap-0.5 px-2 py-3">
          <Bone className="h-7 w-12" />
          <Bone className="h-2.5 w-14" />
        </Panel>
      ))}
    </div>
  );
}

/** The song list, and the one live region that says the page is still working. */
export function SongListSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading your sessions"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <SongCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6" aria-hidden="true">
        {/* `h-8` because the greeting is a `text-3xl` h1, the same rank and the
            same scale as "Welcome back" on login. */}
        <Panel tone="paper" radius="2xl" className="flex items-center justify-between gap-3 px-5 py-4">
          <Bone className="h-8 w-44" />
          <Bone className="h-10 w-24 rounded-2xl" />
        </Panel>
        <StatRowSkeleton />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3" aria-hidden="true">
        <Bone className="h-6 w-32" />
        <Bone className="h-11 w-32 rounded-2xl" />
      </div>

      <SongListSkeleton />
    </div>
  );
}
