"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { SongAttempt } from "@/app/api/progress/route";

function scoreColor(s: number): string {
  if (s >= 80) return "#10B981";
  if (s >= 55) return "#EAB308";
  if (s >= 30) return "#F97316";
  return "#EF4444";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomDot(props: { cx?: number; cy?: number; payload?: { score: number } }) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload) return null;
  return <circle cx={cx} cy={cy} r={5} fill={scoreColor(payload.score)} stroke="white" strokeWidth={2} />;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { score: number; date: string } }> }) {
  if (!active || !payload?.length) return null;
  const { score, date } = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#1a0f00]/10 bg-white px-3 py-2 shadow-lg">
      <p className="text-base font-black tabular-nums" style={{ color: scoreColor(score) }}>{score}%</p>
      <p className="text-[11px] text-[#5c3d1a]/50">{fmtDate(date)}</p>
    </div>
  );
}

export default function ProgressGraph({ attempts }: { attempts: SongAttempt[] }) {
  if (attempts.length === 0) return null;

  // Single attempt — show a big score ring instead of a flat line
  if (attempts.length === 1) {
    const s = attempts[0].score;
    const color = scoreColor(s);
    const r = 38, circ = 2 * Math.PI * r;
    const dash = (s / 100) * circ;
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="54" textAnchor="middle" dominantBaseline="middle"
            fontSize="20" fontWeight="900" fill={color}>{s}%</text>
        </svg>
        <p className="text-[11px] text-[#5c3d1a]/40">{fmtDate(attempts[0].date)} · Practice again to see progress</p>
      </div>
    );
  }

  const data = attempts.map((a, i) => ({ ...a, index: i + 1 }));
  const avg = Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length);

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 10, fill: "#5c3d1a", opacity: 0.45 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 10, fill: "#5c3d1a", opacity: 0.45 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(0,0,0,0.08)", strokeWidth: 1 }} />
          <ReferenceLine y={avg} stroke="rgba(0,0,0,0.1)" strokeDasharray="4 3" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 8, stroke: "white", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
