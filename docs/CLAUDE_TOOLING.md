# Claude tooling for Trace

A practical index of the skills, agents and browser tools worth using on this
project, organised by what you're trying to do. Invoke a skill by typing
`/<name>`, or just describe the task — most trigger on their own.

---

## Design & visual work

Installed 2026-07-28 in `~/.claude/skills/`. The first two are the ones you'll
reach for most.

| Skill | Use it when | Notes |
|---|---|---|
| `taste` | "Make it feel like Duolingo." Give it a URL; it opens the real site, reads the DOM and screenshots it, then produces concrete tokens (hex, px, type, spacing) **plus** the reasoning behind them | The antidote to vague direction. Outputs `{domain}.md` + `.json`. Rejects words like "clean" and "modern" in favour of values |
| `emil-design-eng` | General UI polish, component design, the invisible details | Emil Kowalski's philosophy. Broadest of the set |
| `apple-design` | Gesture-driven UI, spring physics, sheets, drag/swipe, translucency, optical type | Most relevant to the practice HUD and the draggable overlay |
| `improve-animations` | "Audit the motion across the app" | Read-only. Produces a ranked plan. This is what found the countdown desync and the invisible-but-clickable controls |
| `review-animations` | Reviewing one diff's animations against a high bar | Explicit invoke only |
| `find-animation-opportunities` | "What here should animate but doesn't?" | Read-only, proposes exact values |
| `animation-vocabulary` | You can describe a motion but don't know its name | Reverse glossary. Useful for briefing |
| `prototype` | Build several genuinely different versions behind a visual picker, flip through live, promote the winner | Explicit invoke only. **Best tool for the redesign** — beats arguing about a direction in the abstract |
| `pick-ui-library` | Choosing a library for charts, toasts, drag-and-drop, virtualisation | Explicit invoke only |

Also available (built in): `dataviz` for any chart or progress visualisation —
load it *before* writing chart code, not after.

### The redesign trap to avoid

These models have a persistent default look (warm cream backgrounds, serif
display type, terracotta accents). Trace already sits in that exact style, so
asking for "cleaner" or "more modern" tends to swap one fixed look for another
rather than producing variety. Two things that actually work:

1. Give a **concrete spec** — exact hex, typeface, radii, spacing.
2. Ask for **4 distinct directions before any code**, pick one, then build.

`prototype` and `taste` exist to make both of those cheap.

---

## Debugging & correctness

| Skill / agent | Use it when |
|---|---|
| `superpowers:systematic-debugging` | Any bug, before proposing a fix. Forces reproduction before theorising |
| `superpowers:test-driven-development` | New feature or bugfix — test first |
| `superpowers:verification-before-completion` | Before claiming anything works. Evidence before assertions |
| `Explore` agent | Broad read-only sweeps: "where is X handled across the codebase" |
| `code-reviewer` agent | After writing code, before merging |
| `security-reviewer` agent | Anything touching auth, user input, API routes, secrets |
| `database-reviewer` agent | SQL, migrations, schema changes, query performance |

**Lesson from this project:** the two worst bugs so far — the scan stalling at
2% and 28 Tailwind classes emitting no CSS — were both *silent*. Nothing
errored. When something "feels slow" or "looks off", measure before optimising;
the first three hypotheses about the scan were all wrong, and only a benchmark
settled it.

---

## Database & scaling

| Skill | Use it when |
|---|---|
| `postgres-patterns` | Query optimisation, indexing, RLS, schema design (Supabase-aware) |
| `backend-patterns` | API route design, caching, server-side structure |

Trace-specific facts worth remembering:
- **No video is stored server-side.** Video lives in IndexedDB (`lib/videoStore.ts`). The `dance-videos` bucket exists but nothing writes to it.
- The binding free-tier limit is the **500MB database**, not the 1GB storage — `scan_cache.timeline` is 20–80KB of jsonb per row.
- Free projects **pause after ~7 days idle**. Worth a scheduled ping during a beta.

---

## Next.js, Vercel & deployment

| Skill | Use it when |
|---|---|
| `vercel:nextjs` | App Router, Server Components, data fetching, rendering |
| `vercel:react-best-practices` | After editing several `.tsx` components |
| `vercel:env-vars` | Env var management, `vercel env pull` |
| `vercel:deployments-cicd` | Deploys, promotions, rollbacks |
| `vercel:vercel-functions` | API routes, cron, streaming |
| `vercel:shadcn` | If you ever adopt shadcn primitives |

Trace deploys from `main` automatically. `NEXT_PUBLIC_*` vars are **baked at
build time** — changing one does nothing until you redeploy.

---

## Browser testing (no install needed)

The in-app browser tools cover most verification without any dependency:

- `preview_start` — start the dev server from `.claude/launch.json`
- `read_page` — accessibility tree; better than a screenshot for verifying text and structure
- `computer` — click, type, screenshot
- `resize_window` — **the one to use for the mobile overlap work** (375px, 390px, dark mode)
- `read_console_messages`, `read_network_requests`, `preview_logs`
- `javascript_tool` — inspection and measurement only, never for implementing changes

For real end-to-end journeys, the `e2e` skill and `e2e-runner` agent drive
Playwright (adds a dev dependency plus browser binaries).

**Gotcha learned the hard way:** running `npm run build` while the dev server is
live clobbers its `.next` chunks and produces confusing `Cannot find module
'./948.js'` errors. Stop the server, build, restart.

---

## Process

| Skill | Use it when |
|---|---|
| `superpowers:brainstorming` | Before building anything new — explores intent before implementation |
| `superpowers:writing-plans` | Turning a spec into an executable plan |
| `superpowers:requesting-code-review` | Before merging significant work |
| `/code-review ultra` | Multi-agent cloud review of the branch or a PR. User-triggered and billed |

Background agents are the efficient move for anything read-heavy — codebase
surveys, audits, multi-file analysis. Three can run in parallel; they keep
their findings out of the main conversation until they report.

---

## Model selection

| Model | Use for | Cost (per Mtok in/out) |
|---|---|---|
| **Opus 5** | Design judgment, multi-file refactors, architecture — the default here | $5 / $25 |
| **Sonnet 5** | Well-specified mechanical changes, small fixes | $3 / $15 |
| **Fable 5** | Only for genuinely hardest long-horizon reasoning | $10 / $50 |

Fable is double Opus and rarely the right call for UI work.
