---
id: "0015"
title: "DECISION O-7: Per-capita 2014=483 — pipeline row-selection vs seed-data error"
status: resolved
class: DECISION
priority: P0
owner: database-architect
implements: SPEC §5 O-7, §1 C6 (C6-d)
blocks: ["0020", "0028"]
needs_data_input: true
route_to: database-architect (if the gold value itself is 483)
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — Is per-capita 2014 = "483" (~10× low, wedged between 4 712 and 4 085) a **pipeline row-selection** fault or a **seed-data error** in the gold layer?

**Reasoned DEFAULT (build this unless told otherwise)** — **Pipeline row-selection.** The table uses the real field formatter (so it is not the C1 axis-formatter bug); a wrong/partial row was resolved for 2014 — same underspecification family as the component-decomposition drift. C6-d (in item 0020) fixes it: assert exactly one observation per (measure, geo, time); a multi-match diagnoses `ROW_AMBIGUOUS` rather than silently picking wrong.

**Alternative (routes out of pipeline scope)** — If the gold value itself is 483 (should be ~4 831), it is a **data-ingest fix** → **database-architect**, not a render-pipeline change.

**Quick disambiguating check** — query the gold layer for GDP-per-capita geo=GE time=2014. If it returns 483 → seed error (database-architect); if it returns ~4 831 but the renderer picks a wrong duplicate → pipeline (C6-d).

**Reversibility** — Two-way door (the C6-d resolver hardening is safe regardless; the routing only decides whether an additional data-ingest fix is also needed).

**Blocks** — 0020 (C6, the C6-d per-capita row-selection part), 0028 (E7 per-capita line — the 2014 point must not be 483).

**Owner action (~2 min)** — Run/authorize the gold-layer check, then confirm pipeline (default) or route the value to database-architect.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

---
**RESOLVED (database-architect, 2026-07-02) — SEED IS CORRECT → RENDER/PIPELINE FAULT.**

Gold-layer check against the LIVE SSOT `DATA/canonical/GDP_ANNUAL.xlsx`: `measure=gdp-per-capita-usd`, `geo=GE`, `approach=_Z`, `time=2014` → **`obs_value = 4829.88`** (≈4 830). The full series is monotone-plausible (2013=4711.77, 2014=**4829.88**, 2015=4085.14). There is exactly **ONE** row for (per-capita, GE, 2014) — no duplicate/ambiguity (per-capita lives solely under `approach=_Z`).

**Therefore the gold value is NOT 483 — the seed is correct.** "483" is a **render/pipeline fault**, not a data-ingest error. Note 483 ≈ 4829.88 / 10 and the per-capita measure's unit is **USD** (all sibling GDP measures are GEL_MN) — this smells like a unit/decimals or digit-drop FORMATTING fault at the render boundary, NOT row-ambiguity (there is no ambiguous row to disambiguate). **Route to render (0020 C6-d row-selection hardening still safe/desirable, and 0028 E7 per-capita line): ensure the correct single row is selected AND formatted with the per-capita measure's own unit/decimals.** No database-architect data change.
