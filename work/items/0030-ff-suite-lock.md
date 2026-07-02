---
id: "0030"
title: "FF: Fitness-function suite — CI lock for the render-pipeline target"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC §4 + SPEC.DELTA §5 (all fitness functions)
depends_on: ["0016", "0017", "0018", "0019", "0020", "0021", "0036", "0037"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Goal** — Lock the target as build gates. Each fitness function lands *alongside its capability* (not after); this item is the aggregate ledger + CI-gate wiring that ensures the full suite is registered, green, and blocking.

**Implements** — SPEC §4 (full fitness-function table). Evolutionary Architecture: guided change behind fitness functions.

**Files / modules touched** — fitness test files co-located with each capability; CI config / `ops/scripts/check-laws.sh`; `project.json` `law_patterns` where a grep-guard is the right form.

**Dependencies** — each FF is authored WITH its capability item (0016–0021, 0036, 0037). This item verifies the suite is complete and wired as a blocking CI gate.

**Acceptance criteria (each FF green + CI-blocking)**
- [ ] **FF-FORMAT-SSOT** (with 0016) — no `+ ' 000'` / hand-rolled abbreviation in `packages/**`; all formatters via `getFormatter`/`fmtNum`/`compact`.
- [ ] **FF-AXIS-MONOTONIC** (with 0016) — sample-scale ticks strictly monotonic.
- [ ] **FF-WARM-COVERS-RENDER** (with 0017) — per page×perspective×locale, render against a throw-on-cold store → no cold read.
- [ ] **FF-NO-EMPTY-REQS-FOR-READING-SPEC** (with 0017) — no read-issuing DataSpec type returns `[]`.
- [ ] **FF-ONE-MAP-ENGINE** (with 0018) — `panels/map/mapColorUtils` deleted; one value→fill.
- [ ] **FF-GEO-JOIN-NONEMPTY** (with 0018) — `colorByGeo` matches ≥1 feature given covering geoCodeMap; total-miss = failure.
- [ ] **FF-KPI-MEAN-AGGREGATES** (with 0019) — `mean` returns the arithmetic mean, not 0; falsy-baseline `cagr` diagnoses.
- [ ] **FF-COMPONENT-DECOMP** (with 0020) — decomposition yields ≥2 components or diagnoses.
- [ ] **FF-ROW-UNAMBIGUOUS** (with 0020) — per-capita (measure,geo,year) resolves exactly one obs; multi-match diagnoses.
- [ ] **FF-EFFECTS-DECLARATIVE** (with 0021) — `onEnter`/`onExit` `set` values are literals/`ExprVal`/`null` only; retired `applyEffects`/`Effect[]` tokens stay absent.
- [ ] **FF-DUALVIEW-ONE-DATA** (with 0036) — a section with `role:'chart'`+`role:'table'` children resolves ONE `data` at the section; neither child issues a store read; both format through C1.
- [ ] **FF-TABLE-FOOTER-MEAN** (with 0036/0019) — a table `საშუალო`/mean footer uses the C5 `mean` reduction (arithmetic mean, base-year per O-5), never CAGR.
- [ ] **FF-BRIDGE-CLOSES** (with 0027/0037) — the `contribution` bridge's signed components sum to the `isTotal` closing bar (C+I+X−M == GDP; SNA closing balances == their component sum).
- [ ] **FF-DIVERGING-TREE-ORDERED** (with 0037) — `hbar-diverging` rows ordered account→side(R,U)→seqPos→closing with group separators present; no orphan `parentId`.
- [ ] (inherited) **FF-NO-MODE-LITERAL** — no `=== 'year'`/`=== 'range'` mode literal anywhere (already green — keep green).
- [ ] Full suite registered in CI and BLOCKING; `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Do NOT batch the FFs to the end — each ships with its capability; this item is the completeness/CI-gate ledger. Two-way door (tests are additive).
