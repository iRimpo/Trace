"use client";

import TraceCharacter from "@/components/illustrations/TraceCharacter";
import WavingCharacter from "@/components/illustrations/WavingCharacter";
import DancingCharacter from "@/components/illustrations/DancingCharacter";
import JumpingCharacter from "@/components/illustrations/JumpingCharacter";
import ThinkingCharacter from "@/components/illustrations/ThinkingCharacter";
import CelebratingCharacter from "@/components/illustrations/CelebratingCharacter";
import RunningCharacter from "@/components/illustrations/RunningCharacter";

const characters = [
  { name: "Idle (Trace)", Component: TraceCharacter },
  { name: "Waving", Component: WavingCharacter },
  { name: "Dancing", Component: DancingCharacter },
  { name: "Jumping", Component: JumpingCharacter },
  { name: "Thinking", Component: ThinkingCharacter },
  { name: "Celebrating", Component: CelebratingCharacter },
  { name: "Running", Component: RunningCharacter },
];

export default function TestCharactersPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-8 text-center text-3xl font-bold">Character Test Page</h1>
      <p className="mb-12 text-center text-gray-500">
        Line-drawing style: oval head outline, oval body outline, curved line limbs, consistent 10px stroke
      </p>

      {/* All 7 Characters Grid */}
      <section>
        <h2 className="mb-6 text-center text-xl font-semibold">All Characters (Animated)</h2>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {characters.map(({ name, Component }) => (
            <div key={name} className="flex flex-col items-center gap-3">
              <span className="text-sm font-medium text-gray-700">{name}</span>
              <div className="flex items-center justify-center rounded-xl border bg-white p-6" style={{ minHeight: 260 }}>
                <Component size="lg" animated />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Size Comparison */}
      <section className="mt-16">
        <h2 className="mb-6 text-center text-xl font-semibold">Size Comparison (Trace Character)</h2>
        <div className="flex flex-wrap items-end justify-center gap-8">
          {(["sm", "md", "lg", "xl"] as const).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <span className="text-xs text-gray-500">{s}</span>
              <div className="rounded-xl border bg-white p-4">
                <TraceCharacter size={s} animated={false} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Static vs Animated */}
      <section className="mt-16">
        <h2 className="mb-6 text-center text-xl font-semibold">Static vs Animated</h2>
        <div className="flex flex-wrap justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-gray-500">Static</span>
            <div className="rounded-xl border bg-white p-6">
              <WavingCharacter size="lg" animated={false} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-gray-500">Animated</span>
            <div className="rounded-xl border bg-white p-6">
              <WavingCharacter size="lg" animated />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
