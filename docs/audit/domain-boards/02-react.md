# Board 02 — React Render / Charts / Styling / Layout / A11y / i18n (INDEX)

> Senior deep-analysis of the render layer (`platform/packages/{react,charts,styles}` + the
> shell shells in `platform/packages/plugins`). Code is ground truth; docs in
> `docs/architecture/subsystems/{02,16,21,26,27,28,29}` cross-checked and partly stale.
> Analysis only — no product code changed. Author: react-layer engineer. Date: 2026-06-27.

Scope (Law 3): `packages/react` = app-agnostic engine adapter; `packages/charts` = neutral
interpreter layer; `packages/styles` = token/resolver layer; concrete shells live in
`packages/plugins`. Arrow: `contracts ← expr ← core ← charts ← react ← plugins ← apps`.

## Card files (one concern per file)
- [§A/§B Render pipeline + SSR walkers](02-react-pipeline.md) — RX-01..07
- [§C/§D Theming + variant + nav spines](02-react-theming.md) — RX-08..11
- [§E/§F Charts + geo-map](02-react-charts-geo.md) — RX-12..17
- [§G/§H Layout + i18n](02-react-layout-i18n.md) — RX-18..20
- [§I Accessibility / WCAG 2.1 AA](02-react-a11y.md) — RX-21..24
- [§J/§K Missing nodes + performance](02-react-nodes-perf.md) — RX-25..26

Each card uses the schema: Status · Evidence (file:line) · What & why / Critical analysis /
Reference platforms / Foresight / Plan (steps, files, fitness, effort, risk, Class, priority) /
Raises-the-bar.

---

## Executive summary

The render layer is **architecturally mature and mostly DONE**: a 12-step zero-switch
`renderNode` pipeline (RX-01), a capability-transparent sync/async warm-read fast-lane
(RX-02), perspective-aware SSR walkers (RX-05/06), a 4-tier dark-mode token spine (RX-08), a
runtime-zero data-attr variant spine (RX-09), de-privileged capability-nav (RX-10), a neutral
renderer-agnostic chart seam with themed-cssVar layering (RX-12/13), container-query responsive
layout (RX-18), centralized shell-state hooks (RX-19), and a clean three-tier i18n model with
content co-located in config (RX-20). The Opus agents delivered the *architecture* well.

What they did NOT finish is concentrated in three areas, all P1:
1. **Accessibility at the shell layer is unverified** — the engine a11y discovery-gate (RX-24)
   tests engine stand-in slices, but the REAL plugin shells have zero axe gates (RX-22), the
   most-used control (perspective-bar) is keyboard-broken (RX-21), and nothing honors
   `prefers-reduced-motion` (RX-23). Green CI today ≠ accessible output. This is the largest
   integrity gap against Law 9.
2. **Performance / code-splitting** — ApexCharts (~500KB) + Leaflet (~150KB) are static
   imports (RX-26); the per-node Suspense+skeleton scaffolding to lazy-load them already
   exists and is unused.
3. **Coverage** — Sankey + scatter + heatmap chart kinds are unbuilt (RX-14); two competing
   map node implementations (RX-16); chip-select control still missing (RX-25); async parity
   for the JSON target (RX-06).

## Counts

| Status | Count | Cards |
|--------|-------|-------|
| ✅DONE | 14 | RX-01,02,03,04,05,06,07,08,09,10,12,13,15,19,20,24 (core-done) |
| 🟡PARTIAL | 7 | RX-08*, RX-11, RX-14, RX-16, RX-20*, RX-21, RX-25 |
| ⛔NOT-DONE | 3 | RX-22, RX-23, RX-26 |
| 🆕GAP | 1 | RX-17 |
| **Total** | **26** | |

(*RX-08/RX-20 are core-DONE with named enhancement plans; listed in 🟡 only for their unfinished
sub-feature — high-contrast tier, RTL/ICU.)

### Priority rollup
- **P1 (9)**: RX-02, RX-06, RX-11, RX-14(sankey), RX-21, RX-22, RX-23, RX-24, RX-26
- **P2 (10)**, **P3 (7)**.

---

## TOP-3 highest-leverage

1. **RX-26 — Code-split ApexCharts + Leaflet (P1, effort S-M).** Best leverage-to-effort ratio:
   the per-node Suspense + skeletonRegistry scaffolding already exists in `renderNode`, so two
   `React.lazy` calls remove ~650KB from the main bundle of every KPI/table page. Near-free,
   large user-facing win, directly serves Law-9 broad-access.

2. **RX-22 + RX-21 + RX-23 — The accessibility trio (P1).** The Law-9 claim is currently
   unverified at the shell layer: real shells have no axe gates (RX-22), the most-used control
   is keyboard-broken (RX-21), nothing honors reduced-motion (RX-23). Cloning the existing
   engine discovery-gate (RX-24) onto the real plugin registry closes RX-22 systemically.

3. **RX-16 — Consolidate the two map implementations (P2, escalate).** A real-Leaflet `geograph`
   and a stubbed-SVG `panels/map` compete for the same concept (Law-6 violation). Resolve into
   one map node with Leaflet/SVG/print as *variants* (RX-09 spine). Public-node-API decision →
   architect.

---

## NET-NEW innovation: the neutral-output a11y twin

**Every visual node emits a structured "accessible projection" alongside its render — generated
from the same neutral interpretation that drives the pixels.**

`MapShell` already does this ad-hoc (renders an accessible table of the choropleth's data).
Generalize it: each shell optionally registers `a11yProjection(def, ctx, rows) → AccessibleNode`
(a registry mirroring `skeletonRegistry`/`chartRendererRegistry`). The engine renders the visual
for sighted users AND exposes the projection via a visually-hidden region + "view as table"
toggle + the JSON target — from ONE registration.

- **Ambitious-but-honest**: reuses the existing neutral `ChartOutput` (RX-12/13) and the
  `renderPageToJSON` walker — the data is already structured; we add one optional registry hook,
  not a subsystem. Law 8: new node = new projection, interface unchanged.
- **Why no one else has it**: Grafana/Tableau/PowerBI/Superset bolt on a11y per-component or not
  at all; none derive the accessible twin from the same neutral interpretation that draws the
  pixels. Our renderer-agnostic neutral format makes this an architectural guarantee.
- **YAGNI guardrail**: optional hook; charts fall back to the existing ChartDataTable, map already
  has its table. Zero shells forced to implement. Start charts → map → gauge/kpi.

The claim no reference tool can make: *the data behind every pixel is, by construction, available
accessibly — because the pixels and the accessible projection share one neutral source.*
