---
id: "0027"
title: "E6: GDP component quartet — expenditure `contribution`/waterfall BRIDGE / production donut / income treemap / capital donut-% (config-wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E6, §3; SPEC.DELTA §1 (img_6/img_9), §5 FF-BRIDGE-CLOSES
depends_on: ["0016", "0017", "0020", "0014", "0031", "0034", "0036"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Goal** — Decompose GDP across the component dimension at a single year (img_6/img_9): expenditure as a **`contribution`/waterfall BRIDGE** (`C+I+X−M=მშპ`; import as a −55 669.6 down-bar; `isTotal` red `=GDP` closing bar — prov. 1758), production **donut** (center total 104 598), income-formation **treemap** (prov. 2109), capital-formation **donut %** (35.3/29.1/19.3/3.1/2.6) — with no degenerate 2-bar / 1-slice output, and a C7 table view that round-trips the bridge's +/−/= semantics (img_9).

**CORRECTION (was "expenditure bar")** — Expenditure is a **contribution/waterfall bridge**, NOT a plain bar; treemap and donut-% are first-class encodings, not "donut". **Important for the DoD:** the `contribution` chart type ALREADY exists in the registry (`chart-renderers.tsx`, aliases to `ApexRenderer`; `treemap`→`TreemapChart`, `donut`→`DonutChart` also exist). So E6 is **config-wiring, NOT a new chart type** — a refine-existing change with no new code path.

**Implements** — SPEC §2 E6 + §3; SPEC.DELTA §1 (img_6 annual quartet, img_9 table view).

**Files / modules touched** — GDP component-panel config (expenditure bridge / production donut / income treemap / capital donut-%) + their C7 table-view children. No new renderer.

**Dependencies** — 0016 (C1), 0017 (C2), 0020 (C6 rollup + pinning + degenerate guard), 0014 (O-6 — exact component `measure`-code set; HIGHEST-MATERIAL, may need database-architect), 0031 (O-8 — `contribution` vs `waterfall` canonical name + `isTotal` colour token), 0034 (O-11 — data-driven signs, treemap must not double-count `=GDP`), 0036 (C7 — the table view). Cannot fully close until O-6 resolves.

**Acceptance criteria (incl. fitness functions)**
- [ ] Expenditure renders as the `contribution`/waterfall **bridge** (per O-8/0031): signed component bars + `isTotal` `=GDP` closing bar (import = −55 669.6 down-bar); NOT 2 year-bars.
- [ ] Production **donut** (center total), income **treemap**, capital **donut-%** render as their real encodings — not collapsed to ~4 slices / a single dominant wedge.
- [ ] DataSpec: `query { measure:<component set>, filter:{ geo:'GE', approach:'EXP'|'PROD', time: single year } }` → `aggregate by [componentDim, time]` → `rollup` total (where a Total wedge shows) → `lookup (label,color)` → `sort`. Pins approach + geo + single time; iterates the component dim (per O-6).
- [ ] Signs + total are **data-driven** (`isTotal`/sign field, per O-11/0034); the income treemap does NOT double-count the `=GDP` tile.
- [ ] **FF-BRIDGE-CLOSES**: the bridge's signed components sum to the `isTotal` closing bar (`C+I+X−M == GDP`) — the identity holds numerically.
- [ ] **FF-COMPONENT-DECOMP** (0020): ≥2 components resolved, or diagnoses (`COMPONENT_DECOMP_DEGENERATE`); `< 2` → empty-state, never the misleading 2-bar chart.
- [ ] C7 table view (0036) round-trips the bridge's +/−/= semantics (img_9: `import = −55 669.6`, `=GDP = 104 598.1` rows); same warmed rows, no second query.
- [ ] value → `mln_gel` or `pct`; data-labels → `fmtNum` (FF-FORMAT-SSOT, 0016).
- [ ] Filter reactions: year change re-reads at the new single year; locale → component labels; annual-only elements.
- [ ] Warm: `query`+pipe warmed per component code at the pinned year (FF-WARM-COVERS-RENDER, 0017).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Config-wiring against existing registry types (`contribution`/`waterfall`→ApexRenderer, `treemap`→TreemapChart, `donut`→DonutChart) — no new chart type, no new code path. Blocked on O-6 (0014) for the exact query. Mirror the correct sectoral donut (~3370). Two-way door at config level.
