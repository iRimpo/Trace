"use client";

// THROWAWAY. Unauthenticated preview of the redesign primitives so they can be
// screenshotted without a login. Delete after capture.

import Pressable from "@/components/ui/Pressable";
import StatTile from "@/components/ui/StatTile";

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-brand-cream p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">

        <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-card">
          <p className="text-2xl font-bold tracking-tight text-ink">Hi, Richard</p>
          <div className="flex items-center gap-1.5 rounded-2xl bg-duo-gold px-3 py-1.5 shadow-chunk-gold-sm">
            <span className="text-base leading-none">🔥</span>
            <span className="text-sm font-extrabold tabular-nums text-ink">7</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink/70">day streak</span>
          </div>
        </div>

        <div className="flex gap-2">
          <StatTile accent="ink"   label="Sessions" value={12} />
          <StatTile accent="blue"  label="Avg"      value="78%" />
          <StatTile accent="green" label="Best"     value="94%" />
          <StatTile accent="gold"  label="Days"     value={9} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Pressable variant="primary"   size="lg">Upload Video →</Pressable>
          <Pressable variant="secondary" size="md">New Session</Pressable>
          <Pressable variant="quiet"     size="md">Skip</Pressable>
          <Pressable variant="danger"    size="md">Delete</Pressable>
          <Pressable variant="primary"   size="md" disabled>Disabled</Pressable>
        </div>

        <p className="text-sm text-clay/60">
          Press any button — the chunk collapses and the face lands where the
          chunk was, so there is no net layout shift.
        </p>
      </div>
    </div>
  );
}
