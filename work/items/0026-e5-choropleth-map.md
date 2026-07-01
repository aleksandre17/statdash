---
id: "0026"
title: "E5: Choropleth map (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E5, §3
depends_on: ["0016", "0017", "0018"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — Georgia regions shaded by GVA (sequential ramp); occupied territories labelled/unshaded; click = region select (multi, max 10); selection highlight orthogonal to the value ramp.

**Implements** — SPEC §2 E5 + §3.

**Files / modules touched** — geograph node config; verification against C4.

**Dependencies** — 0016 (C1 — tooltip via `fmtNum`), 0017 (C2 — geograph `data.query` warms before paint), 0018 (C4 — one engine, correct join, cold-paint re-style, diagnostic).

**Acceptance criteria (incl. fitness functions)**
- [ ] DataSpec: `geograph.data = query { measure:'regional.gva', filter:{ geo:{$ne:'_T'}, measure:'GVA', sector:{$ctx:'sector'}, time:{$ctx:'time'} } }` → `aggregate by [geo,time]` → `lookup geo (label,color)`; `geoCodeMap` bridges ISO→geo code.
- [ ] `img_1` ramps ALL 10 regions by value (not flat); join keys on the geo dim code both sides; re-styles on late `rows`; all-miss diagnoses (FF-GEO-JOIN-NONEMPTY, 0018).
- [ ] tooltip value → `fmtNum(v,0)` + unit; share → `fmtNum(pct,1)%`.
- [ ] Filter reactions: region-select toggles into `region` param (multi) with `FILL_SELECTED`/`WEIGHT_SELECTED` highlight (`img_5`), value ramp persists underneath; year change recolors; locale → tooltip labels; annual-perspective element (`visibleWhen`).
- [ ] Warm before paint (FF-WARM-COVERS-RENDER, 0017) so the map does not paint flat cold.
- [ ] Empty: no rows → neutral `fillColor()`, tooltip absent — documented empty state, NOT a silent flat "success".
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Two-way door.
