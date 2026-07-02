---
name: canonical-gdp-annual-shape
description: Canonical GDP_ANNUAL DSD — approach is a real 4th fact dim (PROD/EXP/INC/_Z) and contribution_role (add/subtract/total) is the SSOT for component classification
metadata:
  type: project
---

Canonical `DATA/canonical/GDP_ANNUAL.xlsx` DSD (STRUCTURE sheet, pre-registered 4-dim by migration V34): dimensions = **`time, approach, measure, geo`**.

- **`approach` is a REAL fact dimension** (CL_APPROACH codes `PROD, EXP, INC, _Z`), NOT `measure` metadata. `_Z` ("Not applicable") carries the derived/total measures: `gdp-per-capita-usd`, `real-gdp-growth-rates`, and the GDP total.
- The DATA sheet carries a **`contribution_role`** attribute per (approach, measure) row: `add` | `subtract` | `total` — the declarative SSOT for classifying component-vs-total (render must read it, never hardcode signs or which code is the total).

**Component measure-code sets (kebab-case codes):**
- EXP (C+I+X−M, identity verified): `final-consumption-expenditure`(add), `gross-capital-formation`(add), `exports-of-goods-and-services`(add), `imports-of-goods-and-services`(**subtract**); `gross-domestic-product-at-current-prices`(**total**).
- PROD: `agriculture-forestry-and-fishing, manufacturing, construction, services, net-taxes` (all add; no separate total row).
- INC: `compensation-of-emploees, gross-operating-surplus, gross-mixed-income, net-taxes_2` (all add) + GDP total.

**`side` (U/R) belongs to ACCOUNTS_SEQUENCE only — it does NOT participate in GDP.**

**Why:** the "2-bar/1-slice" degenerate component charts came from the render not pinning `approach` + ignoring `contribution_role`; the correct query is approach-pinned + role-classified. The per-capita measure is unit **USD** (siblings are GEL_MN) — a render formatting trap.

**How to apply:** when reasoning about GDP component/bridge/donut/treemap queries or per-capita, use this shape. Related: [[live-ssot-canonical-vs-retired-bundle]].
