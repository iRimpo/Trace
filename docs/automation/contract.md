# Trace improvement manager contract

## Outcome

Deliver one small, evidence-backed Trace improvement at a time without weakening the cue-loop verifier, losing local work, or overstating release confidence. Automated checks and real-device evidence are separate gates.

## Authority and exclusions

The manager may inspect local, GitHub, and Vercel state; create local `codex/` branches and worktrees; run local checks; implement bounded pilots; and update `docs/automation/`. It may not push, merge, deploy, apply migrations, mutate production data, install paid services, message people, rotate credentials, or edit protected `loop/` files. Speculative features require a proposal before implementation.

The cue floor is fixed at 50,000. Runs may use a fresh seed at that floor, but must not raise it merely to manufacture progress. Any verifier change requires a separate concrete proposal and independent review.

## Sources of truth

1. Current code and fresh command output at the recorded commit.
2. `loop/program.md` and `loop/verify.sh` for the protected verifier contract.
3. Approved specs and plans, checked against current code.
4. Historical handoffs and audits only after re-verification.
5. Inferred dancer personas are hypotheses, not research findings.

## Run lifecycle

Only the accountable manager writes `state.json`, `backlog.json`, `decisions.md`, or shared run records.

1. Reconstruct state from Git, `state.json`, backlog, decisions, and run records.
2. Detect an active or interrupted run before selecting work.
3. Select one eligible item whose dependencies are satisfied and blocker fingerprint changed, if previously blocked.
4. Create a unique `codex/` branch and isolated worktree from the recorded local source commit.
5. Record one user outcome, acceptance criteria, owner, reviewers, command budget, and stopping conditions.
6. Implement one coherent change with tests-first evidence when code changes.
7. Obtain independent code and behavioral review; add privacy, accessibility, media/pose, or release review when the item needs it.
8. Run relevant checks serially, record what actually executed, and reconcile all tracked changes.
9. Update durable state and stop after one implementation item.

## Duplicate and interrupted-run protection

`state.json.activeRun` is the logical lock. A run record must include a unique ID, branch, worktree, base commit, owner, start time, heartbeat, and status. Never overwrite a non-terminal run.

Before recovering an apparently stale run, verify all of: the recorded process is absent, the worktree and branch status, the latest commit, and the last evidence record. Mark it `interrupted` with those observations, preserve its worktree, and either resume the same run ID or create a new run linked by `recoveryOf`. A matching task/commit with an active or reviewable run is a duplicate and must not be re-dispatched.

## Verification contract

- Record command, working directory, commit, dirty state, start/end time, exit status, and whether the check executed or was skipped.
- Use `npm run build:check`, never plain `npm run build` while a dev server may be active.
- Serialize `build:check` because the worktree shares `.next-check` within that worktree.
- Serialize `loop/verify.sh` globally. It overwrites shared `/tmp/loop-*.log` and mutates `loop/ratchet.json` plus possibly `loop/design-budgets.json` on a pass.
- A non-`FULL` verifier line can report `build=1` even though build was skipped. Credit build only when `FULL=1`, the explicit build gate ran, and the command exited successfully.
- Compare protected and ratchet files before and after verifier execution. Validate resulting JSON.
- Do not claim MVP or phone readiness from unit, property, or build checks.

## Budgets and stopping conditions

- One implementation item per run.
- At most four concurrent agents including the manager.
- Target 45 minutes, then write a checkpoint rather than silently expanding scope.
- At most two unsuccessful repair/review rounds; then block the item with evidence.
- Do not revisit an unchanged blocker.
- Stop for missing authority, destructive action, protected-verifier changes, production mutation, unverifiable security assumptions, or a required human/device step.

Prompt limits guide behavior; they are not enforceable CPU or wall-clock quotas. The run record must say which limits were policy-only and which were actually enforced by tooling.

## Product guardrails

- Pose inference stays on device; do not introduce server-side video storage.
- Full reference video stays local and repeat practice remains offline-capable.
- Scanning never blocks basic playback/practice.
- Layout responds to orientation, and canvas/video transforms stay aligned.
- Every interactive target is at least 44×44 CSS pixels and has an accessible name.
- Experimental cues remain optional and explicitly experimental.
- Cloud-data claims must be narrow: current code may transmit thumbnails, hashes, movement coordinates/bounds, and analytics even though full reference video is local.

## Notification and recovery behavior

Scheduled runs remain quiet when nothing eligible changed. Notify only for a meaningful completion, a new actionable failure, or required user action. On tool or test failure, preserve artifacts, classify the failure, use no more than two repair rounds, checkpoint, and release logical ownership only after state reconciliation.
