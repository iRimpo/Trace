# program.md — the cue-invariant improvement loop

Human-written. The agent reads this at the start of every cycle and does not edit it.

## Goal

Find and fix real violations of the cue system's documented invariants, and raise the
number of adversarial inputs those invariants survive. The floor only rises.

## Allowed

- `lib/**` — the implementation. This is your work area.
- `experiments.md` — your memory. Append one entry per cycle.

## Forbidden

- `loop/**` — the program, the verifier, the properties, the ratchet. Never edit, move,
  rename, delete or regenerate any of it, by any tool, including shell redirection.
- `vitest.config.ts` — removing the property suite from a run is not progress.
- `supabase/migrations/**` — migrations are destructive against production and are a
  human's call. `008_scan_cache_v3.sql` is deliberately unapplied.
- Do not add runtime dependencies. The project's infra budget is $0/month and all
  inference is on-device. A devDependency is acceptable only if a cycle genuinely
  requires it, and you must say so in `experiments.md`.

## The verifier

```bash
loop/verify.sh
```

Five gates, all must pass:

| Gate | What it checks |
|---|---|
| integrity | `loop/` and `vitest.config.ts` are unmodified and committed |
| tsc | `npx tsc --noEmit` is clean |
| unit | the project's 79 example tests pass |
| props | every property in `loop/properties/` holds at the current ratchet floor |
| build | `FULL=1` only — `npm run build:check` succeeds |

The last line of output is machine-readable:

```
LOOP_RESULT verdict=pass runs=400 seed=46417027 integrity=1 tsc=1 unit=1 props=1 build=1
```

## The metric

`runsFloor` in `loop/ratchet.json` — how many generated inputs the invariants have
survived. A property that holds for 300 inputs is a weaker claim than the same property
holding for 50,000. Each cycle runs at a **higher** `LOOP_RUNS` with a **fresh**
`LOOP_SEED`, so every cycle explores input no previous cycle reached.

`verify.sh` raises the floor only on a pass. It never lowers it.

## Cycle protocol

One change per cycle. Multiple changes make it impossible to know what worked.

1. Read `experiments.md`. Do not repeat a failed experiment unless you can state
   specifically why the outcome would differ now.
2. Pick this cycle's `LOOP_RUNS` — roughly double the current floor, or hold the floor
   and change only the seed if you are hunting a specific class of input.
3. State a one-sentence hypothesis before touching anything.
4. Run `LOOP_RUNS=<n> loop/verify.sh`.
5. **If a property fails:** the shrunk counterexample is the finding. Diagnose the root
   cause in `lib/`, fix the cause and not the symptom, and re-run at the same seed to
   confirm, then at a fresh seed. Record the counterexample verbatim.
6. **If everything passes:** the floor rises. Record the new floor and move to a higher
   `LOOP_RUNS`.
7. Append to `experiments.md`: cycle number, hypothesis, change, `LOOP_RESULT` line,
   and the lesson in one sentence.

## Done when

`runsFloor` reaches 50000 with no property failure, and `FULL=1 loop/verify.sh` passes.

## Stop early if

- Three consecutive cycles produce no floor increase and no finding.
- A fix would require editing anything under Forbidden. Stop and report instead — a
  property that looks wrong is a finding about the property, and that is a human's call.
- A counterexample only violates a property because the property encodes an assumption
  the code never promised. Stop and report; do not weaken the code to match a bad test.
- Total wall-clock exceeds 2 hours.

## Never

- Never edit the verifier to make a cycle pass.
- Never widen a tolerance, lower a threshold, or delete an assertion to get green.
- Never commit to `main`. `main` auto-deploys to production. Work on a branch.
- Never claim a pass you have not run. Paste the `LOOP_RESULT` line.
