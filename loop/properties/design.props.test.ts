/**
 * ════════════════════════════════════════════════════════════════════════
 *  VERIFIER — READ ONLY. The redesign agent may NOT edit this file.
 *
 *  A design rubric scored by scanning source, not by asking a model whether
 *  the UI looks good. Every rule below is a count that can only go down:
 *  loop/design-budgets.json holds the current ceiling per rule, and
 *  verify.sh tightens it after a pass. There is no way to make a cycle green
 *  by arguing.
 *
 *  Rules encode the redesign's actual goals — bold, high-contrast, glanceable
 *  on a phone propped across a room — plus the non-negotiables from
 *  emil-design-eng: no `transition: all`, no bare `ease-in`, no motion without
 *  a reduced-motion path, nothing under the 44px touch minimum.
 * ════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["components", "app"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)))
  .map(p => ({ path: relative(ROOT, p), src: readFileSync(p, "utf8") }));

const BUDGETS: Record<string, number> = JSON.parse(
  readFileSync(join(ROOT, "loop", "design-budgets.json"), "utf8"),
);

/** Count matches across every scanned file, and report where they are. */
function violations(re: RegExp): { count: number; where: string[] } {
  const where: string[] = [];
  let count = 0;
  for (const { path, src } of FILES) {
    src.split("\n").forEach((line, i) => {
      const m = line.match(re);
      if (m) { count += m.length; where.push(`${path}:${i + 1}`); }
    });
  }
  return { count, where };
}

function budgeted(rule: string, re: RegExp) {
  const { count, where } = violations(re);
  const budget = BUDGETS[rule];
  expect(budget, `no budget defined for rule "${rule}"`).toBeTypeOf("number");
  // Report the worst offenders so a cycle has somewhere to start.
  const hint = count > budget ? `\nfirst offenders:\n  ${where.slice(0, 12).join("\n  ")}` : "";
  expect(count, `${rule}: ${count} violations, budget ${budget}${hint}`)
    .toBeLessThanOrEqual(budget);
  // Surface the real number so verify.sh can tighten the ceiling.
  console.log(`DESIGN_COUNT ${rule} ${count}`);
}

describe("design system conformance", () => {
  test("no `transition: all` — name the properties that animate", () => {
    // `all` animates layout properties too, which forces paint and reflow.
    budgeted("transition_all", /transition-all|transition:\s*all/g);
  });

  test("no bare `ease-in` on UI — it delays the frame the user watches", () => {
    // ease-in-out is fine; a lone ease-in is the sluggish one.
    budgeted("ease_in", /ease-in(?!-out)(?![a-z-])/g);
  });

  test("motion has a reduced-motion path", () => {
    // Any animate-* utility in a className that never mentions motion-reduce.
    const where: string[] = [];
    let count = 0;
    for (const { path, src } of FILES) {
      src.split("\n").forEach((line, i) => {
        const anim = line.match(/\banimate-[a-z0-9-]+/g);
        if (anim && !/motion-reduce:/.test(line)) {
          count += anim.length; where.push(`${path}:${i + 1}`);
        }
      });
    }
    const budget = BUDGETS["motion_no_reduce"];
    const hint = count > budget ? `\nfirst offenders:\n  ${where.slice(0, 12).join("\n  ")}` : "";
    expect(count, `motion_no_reduce: ${count} violations, budget ${budget}${hint}`)
      .toBeLessThanOrEqual(budget);
    console.log(`DESIGN_COUNT motion_no_reduce ${count}`);
  });

  test("pressables meet the 44px touch minimum", () => {
    // h-8/h-9/h-10 (32-40px) on something clickable. Tailwind h-11 is 44px.
    //
    // `touch-target` (app/globals.css) is exempt: it expands the hit area to
    // 44px via a centred pseudo-element while leaving the visual size alone,
    // which is what this rule is actually asking for. The h-* class is only a
    // proxy for hit area, and enlarging the visual instead would make dense
    // control rows clumsy. Exempting a real fix is not the same as weakening
    // the rule — an element without either still fails.
    const where: string[] = [];
    let count = 0;
    for (const { path, src } of FILES) {
      src.split("\n").forEach((line, i) => {
        if (/\btouch-target\b/.test(line)) return;
        const m = line.match(/\bh-(?:6|7|8|9|10)\b(?=[^"'`]*(?:cursor-pointer|hover:))/g);
        if (m) { count += m.length; where.push(`${path}:${i + 1}`); }
      });
    }
    const budget = BUDGETS["small_touch_target"];
    const hint = count > budget ? `\nfirst offenders:\n  ${where.slice(0, 12).join("\n  ")}` : "";
    expect(count, `small_touch_target: ${count} violations, budget ${budget}${hint}`)
      .toBeLessThanOrEqual(budget);
    console.log(`DESIGN_COUNT small_touch_target ${count}`);
  });

  test("colour comes from tokens, not raw hex", () => {
    // Raw hex in a component means the palette cannot be changed in one edit —
    // the exact failure that put #1a0f00 in 363 places before `ink` existed.
    budgeted("raw_hex", /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g);
  });
});
