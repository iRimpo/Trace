"use client";

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
 */

function Bone({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-ink/[0.08] animate-pulse motion-reduce:animate-pulse ${className}`} />;
}

function SongCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-card sm:p-5">
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
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading your progress"
      className="mx-auto max-w-3xl"
    >
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-white px-5 py-4 shadow-card">
          <Bone className="h-7 w-40" />
          <Bone className="h-10 w-24 rounded-2xl" />
        </div>
        <div className="mt-2 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 shadow-card">
              <Bone className="h-7 w-12" />
              <Bone className="h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <Bone className="h-6 w-32" />
        <Bone className="h-11 w-32 rounded-2xl" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SongCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
