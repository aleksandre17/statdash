# Board 02 — §J Missing nodes + §K Performance (RX-25..26)

> Part of [Board 02 index](02-react.md). Analysis only.

## §J — Missing nodes (doc 26)

### [RX-25] Missing-nodes audit — links + page-header DONE, chip-select MISSING
- **Status**: 🟡PARTIAL
- **Evidence**: `plugins/nodes/{links,page-header}` exist; `plugins/controls/` = {cascade, hidden, multi-select, range, select, year-select} — **no chip-select**; doc `26-missing-nodes.md` (stale, still has Georgian literals)
- **What & why**: Doc 26 flagged three missing types. `links` and `page-header` are now built nodes. **chip-select** (segmented-control filter, always-visible options) is still absent — doc 26 specifies it as a pure presentation variant of `select` (same data contract, different shell).
- **Critical analysis**: Doc 26 is stale (Georgian literals in examples predate de-tenanting — itself doc-debt). chip-select is a real ONS/Eurostat pattern (≤5 options always visible) and per the doc is an ISP-clean variant of select — low-risk. Its absence forces a dropdown where a segmented control is the standard UX. Scanning the node set: `text`, `gauge`, `stats-carousel`, `hero`, `repeat`, `table`, `kpi-strip` all exist — coverage is broad. No `tabs`/`accordion`/`stepper` container node (disclosure hooks exist, RX-19, but no shell consuming them as a multi-panel container).
- **Reference platforms**: Grafana segmented control, Retool Segmented Control, ONS metric toggle. **Where WE beat them**: chip-select would share the select data contract exactly (Constructor treats them identically) — Grafana's segmented variable is a separate type.
- **Foresight (multi-tenant)**: Dashboard tenants want segmented controls; publication tenants want tabs/accordion containers. Both near-term.
- **Plan**: (1) Add `chip-select` control slice (shell-only variant of select per doc 26, shared codec/validate); (2) consider a `tabs`/`accordion` container node consuming `useDisclosure`/`useViewToggle`; (3) refresh doc 26 (remove Georgian, mark links/page-header DONE). Files: `plugins/controls/chip-select/`, optional `plugins/nodes/tabs/`, `docs/.../26-missing-nodes.md`. Fitness: control-registry test + a11y gate (segmented = radiogroup, full keyboard). Effort **M**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: Presentation-variant controls sharing one data contract.

## §K — Performance / code-splitting

### [RX-26] Heavy viz libs (ApexCharts, Leaflet) are static imports — no code-splitting
- **Status**: ⛔NOT-DONE
- **Evidence**: `ApexRenderer.tsx:1` (`import ReactApexChart from 'react-apexcharts'`); `GeoMap.tsx:15-16` (`import {…} from 'react-leaflet'; import L from 'leaflet'`) — both top-level static; `grep React.lazy plugins` → only `renderNode`/`validatePageTree` (engine internals), no shell lazy-loading
- **What & why**: ApexCharts (~500KB) and Leaflet (~150KB + leaflet.css) are imported synchronously at module load. Any bundle including the chart/geograph plugin pulls these into the main chunk regardless of whether a chart/map actually renders on a given page.
- **Critical analysis**: The clearest performance deficit — and the engine already HAS the machinery to fix it. `renderNode` wraps every node in `Suspense` (240-248, 373-381) with `skeletonRegistry` fallbacks. So a `React.lazy(() => import('react-apexcharts'))` in `ApexRenderer` (and lazy Leaflet in GeoMap) would code-split for free, with the existing skeleton as fallback. The infrastructure is built and unused. A KPI-only or table-only page currently ships ~650KB of unused viz JS. For a public-stats platform with slow-connection users (Law 9 broad-access), real harm.
- **Reference platforms**: Grafana (lazy-loads panel plugins on demand), Superset (code-split viz plugins), Observable (per-cell lazy). **Where WE beat them**: nothing yet — but we're one `React.lazy` away because the Suspense+skeleton scaffolding already exists per-node. Grafana built a whole plugin-loader for this; we get it nearly free.
- **Foresight (multi-tenant)**: Tenant pages mix node types; per-shell code-splitting means a KPI-only landing page never downloads Apex/Leaflet. As viz libs grow (Sankey/d3, ECharts), static imports balloon the main bundle linearly.
- **Plan**: (1) `React.lazy` the Apex import in `ApexRenderer` + Leaflet in `GeoMap`, leaning on the existing per-node Suspense+skeletonRegistry; (2) verify Vite chunk-splits them; (3) bundle-size fitness check (main chunk excludes apexcharts/leaflet). Files: `ApexRenderer.tsx`, `GeoMap.tsx`, `vite.config`. Fitness: bundle-analysis assertion. Effort **S-M**, risk **two-way**, Class **M**, priority **P1**.
- **Raises-the-bar**: Per-shell code-splitting riding the existing Suspense skeleton scaffolding — near-free because the engine already wraps every node in Suspense.
