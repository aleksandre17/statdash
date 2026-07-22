---
id: "0106"
title: "Pre-existing token-cohesion RED — growth up/down colors hardcoded as hex in engine (desugar.ts + GrowthResolver)"
status: backlog
class: G
priority: P2
owner: —
links:
  - work/items/0104-data-workspace-unification-and-capability-restoration.md   # surfaced during P1 fix gate
---
**Goal** — `token-cohesion.fitness.test.ts` is RED on main independent of any current work: `packages/core/src/data/desugar.ts:279/306` (growth sign→color derive rule) and its twin `GrowthResolver` (`registry/resolvers.ts:217`) hardcode `#00A896`/`#E76F51`. FF-TOKEN-ONLY correctly flags it. Lift the up/down growth colors to the semantic token tier (Tier-2), so the engine derives a token role, not a hex.

**DoD** — no hex literals in the growth color rule; both derive sites share ONE source; token-cohesion fitness green on full suite; visual parity on the portal growth charts (or a deliberate, owner-shown improvement).

**Notes** — Surfaced 2026-07-22 by the engine-specialist during the measure-drop fix gate ("full suite is not green on main independent of this fix"). Two sites are twins — fix as one seam, not two edits. Also serves the owner's "visual outdated" refresh direction (0104 §Queued).
