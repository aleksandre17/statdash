---
id: "0022"
title: "E1: KPI strip — per-perspective 4-card set (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E1, §3 filter-interaction contracts
depends_on: ["0016", "0017", "0019", "0021"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — The 4-card KPI strip renders the correct per-perspective set, each number formatted through the SSOT, each read warmed, reacting correctly to year-range / region / locale / mode.

**Implements** — SPEC §2 E1 + §3 (year-range, single-year, region-select, locale, mode-toggle contracts).

**Files / modules touched** — geostat KPI config (GDP + regional pages); no engine change expected once C1/C2/C5/C3 land (config kit edits + verification).

**Dependencies** — 0016 (C1 format), 0017 (C2 warm), 0019 (C5 `mean` for avg-real-growth), 0021 (C3 mode-toggle onEnter/onExit — if O-3 deferred, mode toggle stays presentational, documented).

**Acceptance criteria (incl. fitness functions)**
- [ ] Annual GDP set (`img_2`): GDP current (mln_gel) · Real growth (`point` on real-gdp-growth-rates, sign_pct) · Per capita (usd) · Deflator (sign_pct); each `when: perspective-is year`.
- [ ] Dynamics GDP set (`img_3`/`img_4`): GDP avg nominal growth (`cagr` on level, ~10.9%) · **Average real growth (`mean`, ~+5%, NOT 0.0)** · Per capita @ toYear (usd) · Deflator avg (~11.1%); each `when: perspective-is range`.
- [ ] Regional annual (`img_1`) and regional dynamics (`img.png`) sets per the matrix.
- [ ] Every number via `getFormatter(format)`; locale from `ctx.locale`; never a local abbreviation (FF-FORMAT-SSOT, 0016).
- [ ] Filter reactions: year-range re-reads both bounds + every year in `[from,to]` for `mean`; region-select re-aggregates over selection (`img_5` "total of current selection = 9 686"); locale re-resolves labels/units; mode swaps `kpiVisible` set AND warm set identically.
- [ ] Warm===render for every card set (FF-WARM-COVERS-RENDER, 0017); `extractKpiRequirements` yields correct per-type reads.
- [ ] Missing obs → zero/empty state, never a fabricated number; preliminary → "P" badge; falsy CAGR baseline diagnoses (C5-c), does not silently show 0.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Mostly config + verification once capabilities land. Two-way door.
