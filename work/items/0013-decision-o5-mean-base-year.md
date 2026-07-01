---
id: "0013"
title: "DECISION O-5: mean KPI — include base year or exclude (N vs N-1)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC §5 O-5, §1 C5
blocks: ["0019", "0022"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — Whether the `mean` reduction over the real-growth series includes the base year (2010 datum = 0, the year with no prior).

**Reasoned DEFAULT (build this unless told otherwise)** — **Include all N years** in the mean: `Σ v(t) / N` over the inclusive `[from,to]`. Matches "average annual growth over 2010–2025".

**Alternative** — **Exclude the base year** (`N-1`, average of actual year-on-year growth) → a higher figure (~+5.5%).

**Note** — This is a published-statistic definition call; confirm which the NSO intends. Geometric mean is a third option, but the label says "average" and CAGR already covers geometric growth of *levels* — do not conflate.

**Reversibility** — Two-way door (semantics flag on the `mean` discriminant; both computable from the same read-set).

**Blocks** — 0019 (C5 mean KPI), 0022 (E1 dynamics avg-real-growth card — must read ~+5%, not 0.0%).

**Owner action (~2 min)** — Confirm include-all-N, or select exclude-base (N-1).

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.
