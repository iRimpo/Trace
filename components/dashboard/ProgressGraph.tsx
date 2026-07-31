"use client";

import { BAND_FILL, scoreBand } from "./score";
import type { SongAttempt } from "@/app/api/progress/route";

/**
 * "Am I getting better?" — the one question this chart exists to answer.
 *
 * It used to be a full recharts `LineChart`: a 0–100 axis, dashed cartesian
 * grid, an average reference line and a hover tooltip, rendered into a 208px
 * box inside a collapsed accordion, for a series that is usually **three
 * points long**. Six data points cannot support that much chart furniture, and
 * a hover tooltip is the wrong affordance on the device this app runs on —
 * there is no hover on a phone, so the date and score were only reachable by
 * an interaction that does not exist. The axis was doing the work the reader
 * had to do anyway: subtract the first score from the last.
 *
 * So the chart now states its answer in words and numbers first — "+12 points
 * since your first attempt" — and the bars are the supporting evidence, not the
 * message. Every value is printed as text somewhere, so the block still answers
 * the question if a bar fails to paint.
 *
 * Static bars, deliberately. This is data the user is reading to make a
 * decision about what to practise next; growing it on entry would be decoration
 * on top of information, and the animation would run every time the accordion
 * opens.
 */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProgressGraph({ attempts }: { attempts: SongAttempt[] }) {
  if (attempts.length === 0) return null;

  // ── A single attempt is not a trend ──────────────────────────────────────
  // A one-point line chart is a flat line, which reads as "no progress" rather
  // than "no data yet". Say what is actually true instead.
  if (attempts.length === 1) {
    const only = attempts[0];
    return (
      <div className="flex items-center gap-4 rounded-2xl border-2 border-duo-edge px-4 py-3.5">
        <p className="text-3xl font-extrabold leading-none tabular-nums text-ink">
          {only.score}
          <span className="text-lg text-clay/50">%</span>
        </p>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">First attempt</p>
          <p className="mt-0.5 text-xs font-medium text-clay/70">
            {fmtDate(only.date)} · practise again to see a trend
          </p>
        </div>
      </div>
    );
  }

  const first  = attempts[0];
  const latest = attempts[attempts.length - 1];
  const delta  = latest.score - first.score;
  const peak   = Math.max(...attempts.map(a => a.score));

  // Long histories would squeeze the bars to slivers; the last twelve sessions
  // are the ones that answer "am I getting better *now*".
  const shown = attempts.slice(-12);

  const headline =
    delta > 0 ? `+${delta} points since your first attempt`
    : delta < 0 ? `${delta} points since your first attempt`
    : "Level with your first attempt";

  return (
    <div>
      <p className="text-sm font-extrabold tracking-tight text-ink">{headline}</p>
      <p className="mt-0.5 text-xs font-medium text-clay/70">
        {attempts.length} attempts · best {peak}% · latest {latest.score}%
      </p>

      {/*
        role="img" with a written summary: a bar chart is a picture, and the
        numbers above already carry the whole message for anyone who cannot see
        it. The bars are aria-hidden so the series is not read out bar by bar.
      */}
      <div
        role="img"
        aria-label={`Sync score across ${shown.length} attempts, from ${shown[0].score} percent on ${fmtDate(shown[0].date)} to ${latest.score} percent on ${fmtDate(latest.date)}.`}
        className="mt-3 flex h-24 items-end gap-1.5"
      >
        {shown.map((a, i) => {
          const isLatest = i === shown.length - 1;
          return (
            <div key={a.id || i} className="flex h-full flex-1 flex-col justify-end" aria-hidden="true">
              <div
                className={`w-full rounded-t-md ${BAND_FILL[scoreBand(a.score)]} ${isLatest ? "" : "opacity-45"}`}
                // A bar with 0% score still needs to exist as a mark, or the
                // series silently loses a session.
                style={{ height: `${Math.max(a.score, 4)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-hud text-clay/60">
        <span>{fmtDate(shown[0].date)}</span>
        <span className="font-extrabold text-ink">{fmtDate(latest.date)}</span>
      </div>
    </div>
  );
}
