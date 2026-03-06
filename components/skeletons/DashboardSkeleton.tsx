"use client";

import { motion } from "framer-motion";

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={`rounded-lg bg-zinc-200 ${className ?? ""}`}
      style={style}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <Shimmer className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-6 w-16" />
          <Shimmer className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-3 w-16" />
      </div>
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 12 }).map((_, i) => (
          <Shimmer
            key={i}
            className="flex-1 max-w-[24px] mx-auto rounded-full"
            style={{ height: `${30 + Math.random() * 70}%` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <Shimmer className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Shimmer className="h-4 w-3/4" />
        <Shimmer className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-300">
      <div className="mb-10">
        <Shimmer className="h-6 w-36 mb-4" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Shimmer className="h-8 w-32" />
          <Shimmer className="h-4 w-20" />
        </div>
        <Shimmer className="h-10 w-24 rounded-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
