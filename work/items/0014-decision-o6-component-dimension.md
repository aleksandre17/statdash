---
id: "0014"
title: "DECISION O-6: Component dimension for GDP expenditure/production (HIGHEST-MATERIAL)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC §5 O-6, §1 C6
blocks: ["0020", "0027"]
needs_data_input: true
route_to: database-architect (exact measure-code set / side-dim role)
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — Which DSD dimension carries the expenditure/production component breakdown, and the exact member set to iterate. The DSD dimensions are `account, geo, measure, sector, side`.

**Reasoned DEFAULT (build this unless told otherwise)** — The components live on the **`measure`** dimension (sub-codes under an `approach`), not a dedicated component dim. Expenditure breakdown = iterate `measure` sub-codes filtered by `approach:'EXP'`; production = `approach:'PROD'`. Correct query: "iterate `measure` where `approach=EXP/PROD`, pin geo + single-time, roll up."

**Why this is the highest-material confirm** — This is the one place the query shape cannot be finalized from config alone. C6 (0020) and E6 (0027) cannot close until the exact `measure`-code set (or the `side` dim's role) is known. Getting it wrong = the degenerate 2-bar / 1-slice charts persist.

**Possibly needs data/DB input before dependents close** — route to **database-architect** for the exact `measure`-code set per approach and whether `side` participates. Quick check: enumerate `measure` members under `approach:'EXP'` and `approach:'PROD'` in the gold layer.

**Reversibility** — Query-shape decision; two-way at the config level, but a wrong member set silently degrades — treat as needing confirmation before build.

**Blocks** — 0020 (C6 component rollup), 0027 (E6 GDP component charts).

**Owner action (~2 min)** — Confirm `measure`-sub-codes-by-`approach`, and supply/point to the exact member set (or delegate that lookup to database-architect).

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.
