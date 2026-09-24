# Trace adaptive team

The accountable development manager is the sole durable-state writer and integrator. Roles are selected per task; they are responsibilities, not standing personas.

## Core roles

| Role | Ownership | Done condition | Escalate instead of guessing |
|---|---|---|---|
| Manager/developer | Task choice, branch/worktree, implementation integration, state, evidence | One coherent outcome is reviewable and state reconciled | Authority, destructive action, protected verifier, production change |
| Architect/researcher | Current architecture, provenance, dependency and requirement evidence | Verified facts separated from historical claims and unknowns | Deployment/schema identity cannot be proven |
| Designer | Interaction behavior, orientation, geometry, wording, recovery | Acceptance criteria cover actual stage use and existing design system | A product tradeoff or speculative feature is required |
| Dancer advocate | First use, 8–10 ft rehearsal, return, drill, group footage | Scenario-specific observable outcomes; hypotheses labeled | Real-user claim or physical-device judgment is unavailable |
| Independent reviewer | Diff, tests, behavioral contract, regression risk | Critical/important findings resolved or explicitly blocked | Evidence is missing or author-only review is the only review |

## Conditional roles

- Media/pose: video/canvas transforms, device performance, dancer identity, scan behavior.
- Accessibility: names, states, keyboard/focus, reduced motion, contrast, 44px targets.
- Privacy/security: authentication, authorization, telemetry, thumbnails, hashes, movement data, retention.
- Release: production provenance, environment/schema state, device matrix, rollback and checklist.

## Persona selection

Use the smallest relevant set. Current confirmed product lenses are a first-time dancer, a returning dancer, and a dancer rehearsing from a phone 8–10 feet away. Accessibility, constrained-device, and group-footage dancers are necessary test lenses but remain inferred hypotheses until real research is recorded.

The practice screen prioritizes distance readability, continuity, and coarse targets. Elsewhere, first-use comprehension and safe recovery take priority. Privacy, accessibility, and irreversible-harm prevention outrank convenience.

## Pilot assignments

| Pilot | Implementer ownership | Required independent lenses | Stop condition |
|---|---|---|---|
| Saved-session restoration | `PracticeView`, restore helpers/tests, minimum necessary `TraceTab` integration | architecture, returning dancer, behavioral reviewer | State contract is ambiguous or empty-write race cannot be tested |
| Practice-stage accessible controls | `TraceTab` controls and focused regression tests | accessibility, 8–10 ft dancer, behavioral reviewer | Fix creates chrome/geometry conflict or needs verifier edit |
| Real-phone core journey | Evidence record and phone checklist only unless a bug is reproduced | dancer, media/pose, accessibility, release | No physical phone/human observer or deployment commit mismatch |

Agents share the repository. Every worker must preserve existing and concurrent edits, own named files, and avoid shared-file edits in parallel. Verifier and build evidence are always serialized by the manager.
