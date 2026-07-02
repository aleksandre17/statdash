---
id: "0031"
title: "DECISION O-8: E6 expenditure encoding — `contribution` vs `waterfall` (both alias ApexRenderer)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC.DELTA §3 O-8, §1 E6 / §E9
blocks: ["0027", "0037"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — Which registered chart-type name carries the GDP-by-expenditure bridge (`C+I+X−M=მშპ`, import as a −55 669.6 down-bar, `isTotal` red `=GDP` closing bar). The registry (`chart-renderers.tsx`) exposes BOTH `contribution` and `waterfall`, and **both already alias to `ApexRenderer`**.

**Reasoned DEFAULT (build this unless told otherwise)** — Keep **`contribution`** as the canonical bridge — it is the type in use in provisioning (prov. 1758) — and treat `waterfall` as its registered alias. Because both names already resolve to `ApexRenderer`, this is **config-wiring, NOT a new chart type** — a refine-existing change with no new code path.

**Alternative** — Rename the in-use type to `waterfall` (semantically closer to the SNA "waterfall bridge" idiom). Costs a provisioning rename + alias flip; no renderer change either way.

**One sub-confirm** — the `isTotal` closing-bar colour token (the red `=GDP` bar) — confirm the design-token name so it is not a magic colour.

**Reversibility** — Two-way door (both names live in the registry; swapping the canonical alias is a config edit at zero code cost).

**Blocks** — 0027 (E6 expenditure bridge) and 0037 (E9 SNA `hbar-diverging`, which shares the signed `isTotal` closing-balance identity). Both can proceed on the DEFAULT; only the colour token is genuinely owner-only.

**Owner action (~2 min)** — Confirm `contribution` as canonical (+ the `isTotal` colour token), or elect `waterfall`.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.
