---
id: "0023"
title: "E2: Region table with inline proportion bars (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E2, §3
depends_on: ["0016", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — One row per region (value + share% with inline proportion bar), sorted desc, footer sum — the correct, already-well-formed pattern that is the reference for C6.

**Implements** — SPEC §2 E2 + §3 (year, range, region-select, locale contracts).

**Files / modules touched** — regional table config; no engine change expected (this is the reference-correct spec — verify it stays green after C1).

**Dependencies** — 0016 (C1 — table + any sibling chart axis now AGREE), 0017 (C2 — `query` case warmed: per-year pin when `time` set, unbounded req when range).

**Acceptance criteria (incl. fitness functions)**
- [ ] DataSpec: `query { measure:'regional.gva', filter:{ geo:{$ne:'_T'}, measure:'GVA', sector:{$ctx:'sector'}, time:{$ctx:'time'} } }` → `aggregate by [geo,time]` → `lookup geo (label,color)` → `sort value desc`; encoding `pct:{sumOf:'value'}`.
- [ ] value → `mln_gel` (honest full `42 982.6`); pct → `pct` (`53.1%`); table AGREES with any sibling chart axis (FF-FORMAT-SSOT, 0016).
- [ ] Row color dot from `lookup` on the `geo` codelist; footer = `sum`.
- [ ] Filter reactions: year change re-reads + re-ranks; range shows window terminal/aggregate; region-select filters rows, footer sum = selection total (drives the `img_5` KPI); locale re-resolves labels + headers.
- [ ] Warm covered (FF-WARM-COVERS-RENDER, 0017); empty → header-only table, footer sum = 0.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — This is the C6 reference pattern; verify it is untouched/correct. Two-way door.
