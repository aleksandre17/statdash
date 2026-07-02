---
id: "0014"
title: "DECISION O-6: Component dimension for GDP expenditure/production (HIGHEST-MATERIAL)"
status: resolved
class: DECISION
priority: P0
owner: database-architect
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

---
**RESOLVED (database-architect, 2026-07-02) — grounded in the LIVE SSOT `DATA/canonical/GDP_ANNUAL.xlsx` (NOT the retired `ops/seed-data` bundle).**

The reasoned default is directionally right (filter by approach) but the MECHANISM is corrected by the canonical data:

1. **`approach` is a REAL fact dimension**, not `measure` metadata. GDP_ANNUAL DSD dims = `time, approach, measure, geo` (STRUCTURE sheet; V34 pre-registers this 4-dim DSD). CL_APPROACH codes: `PROD, EXP, INC, _Z` (each with genuine `name_en`).
2. **Component classification is a declarative attribute** — the DATA sheet carries `contribution_role` per (approach, measure) row: `add` | `subtract` | `total`. The render MUST read this, not hardcode signs or which code is the total.

**Correct query for the component/bridge/donut charts:** pin `approach` ∈ {EXP|PROD|INC}, pin `geo=GE`, pin single `time`, iterate `measure` members present for that approach, classify by `contribution_role` (`add`/`subtract` = component bars/slices; `total` = the identity sum reference — exclude from the component series or render as the total bar).

**Exact measure-code sets (canonical kebab-case codes):**
- **EXP** (C+I+X−M identity, verified 2023: 80 882.8 = GDP total): `final-consumption-expenditure` (add), `gross-capital-formation` (add), `exports-of-goods-and-services` (add), `imports-of-goods-and-services` (**subtract**); `gross-domestic-product-at-current-prices` (**total**).
- **PROD** (5 components, no separate total row): `agriculture-forestry-and-fishing`, `manufacturing`, `construction`, `services`, `net-taxes` (all add).
- **INC** (4 components + total): `compensation-of-emploees`, `gross-operating-surplus`, `gross-mixed-income`, `net-taxes_2` (all add); `gross-domestic-product-at-current-prices` (total).

**`side` does NOT participate** in GDP — `side` (U/R) is an ACCOUNTS_SEQUENCE dimension only.

**Root cause of the 2-bar/1-slice degeneracy (DATA angle):** the render was not pinning `approach` + not using `contribution_role`, so measures collapsed. No data/seed defect — the canonical SSOT is correct and richly structured. **Route to render (0020 C6, 0027 E6): implement the approach-pinned, contribution_role-classified query shape.** No database-architect data change.
