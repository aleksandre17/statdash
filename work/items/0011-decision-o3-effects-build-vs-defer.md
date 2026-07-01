---
id: "0011"
title: "DECISION O-3: Effects — build now vs defer (D-EFFECTS)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC §5 O-3, §1 C3
blocks: ["0021", "0022"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — Build the reactive `onEnter`/`onExit` effects capability now (C3), or defer it behind a named door (`D-EFFECTS`).

**Reasoned DEFAULT (build this unless told otherwise)** — **Build now** as a small, bounded capability, because (a) it closes the P5 gap at the seam (visibility + reactivity become peer perspective capabilities), (b) it gives dependent-selector / cross-filter cascades a reusable base, and (c) the geostat config genuinely wants the `range→clear year, pin sector:'_T'` rule for correctness.

**Alternative** — Defer as `D-EFFECTS`: costs nothing to open later, since the seam (perspectiveState transition) is already observed by `useFilterState`. No user-visible break in the screenshots; the stale-param cases are edge.

**Reversibility** — Two-way door either way (the seam already exists; deferral is free, building is bounded).

**Blocks** — 0021 (C3 effects recovery). Also gates the "mode-toggle fires onEnter/onExit" reaction in 0022 (E1 KPI strip) — if deferred, E1's mode toggle stays presentational (documented, not a bug).

**Owner action (~2 min)** — Confirm build-now, OR mark `D-EFFECTS` and 0021 drops out of this wave.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.
