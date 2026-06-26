# 🌙 Overnight #5 — Full render parity restored on the API architecture (verified vs the old version)

## Headline
The new API/SDMX-cube demo now renders **everything the old static-config version did — and better** —
**visually verified, page by page, in both modes, against the old reference at `:5171/ka`.**
The old version was the correctness yardstick; the new one now meets it on the new architecture,
with higher concepts (real i18n, SDMX hierarchies, the canonical pipeline) and no quality drop.

**Live demo: http://192.168.1.199:3002** · all green · all committed + pushed (`6544d29`).

## What you'll see now (all confirmed by reading real screenshots, new vs old)
| Page | Current mode | Dynamics mode |
|------|-------------|---------------|
| **GDP** | KPIs 104 598 / 7.5% / 10 297; Production donut, Expenditure waterfall, **Income treemap** | full 2010–2025 timeseries (bar + line + growth), KPIs 10.9% / 7.9% |
| **Accounts** | 4 SNA diverging-bar panels (Resources/Uses, labelled, the sequence hero) | stacked sequence 2010–2025 |
| **Regional** | **choropleth map** + sector donut + region-comparison bars; CAGR **10.6%** | map + full-span timeseries + sector area |

No empty panels, no `0.0%`/`NaN`/`[object Object]`, no crashes, zero console errors anywhere.
(Value differences vs the old version are real **data-vintage** differences — the new REGIONAL spans
2010–2023, GDP through 2025 — not render gaps.)

## The deep root causes (why it looked broken though the configs were intact)
The architect's key finding reframed everything: the **page configs + pipe machinery survived
de-tenanting intact** — every gap was at the new **`ApiStore` adapter boundary** or a build/seed issue.
Fixed at root, once each:
1. **Transform steps tree-shaken to empty** — core's `sideEffects` omitted `transform/index.ts`, so
   Vite dropped all 18 `registerTransformStep` calls → every pipe was a silent no-op → blank charts.
2. **Classifier labels never wired** — the store-builder didn't pass a `display` overlay; `$d` returned
   only codes. Wired it (+ real `{en,ka}` i18n resolved at the React boundary).
3. **`obs_value` arrived as a string** (pg numeric) → every aggregate was `NaN`; **`seq_pos` not lifted**
   → the SNA sequence collapsed. Coerced + lifted at the one ACL seam.
4. **Dynamics range collapsed to a single year** (`toYear` picked min; the year default re-resolved in
   range mode) → "No data". Fixed the default-resolution to be mode-aware (bar-visibility gated).
5. **Dataset-level ETag 304'd per-slice reads to empty** → the dynamics kpi-strip cold-crashed.
6. **Regional map** — the `georgia-regions.geojson` asset was missing + a height-0 Leaflet box (CSS).
7. **`aggregates` SNA classifier** + **geo de-dup** seeded (V33); **GDP 4-dim** made deterministic for a
   fresh `compose up` (V34 + a canonical-ingest bring-up step).
8. **HIGH data-integrity bug** the review caught: a structural heuristic was silently corrupting
   `provenance` (killing preliminary/methodology badges) — fixed (discriminate by field, not shape).

Every fix has a **fitness function** so the class can't regress (display-wired, obs-numeric,
warm≡read key, no-rollup-in-comparison, span-default, provenance-survives, value-binding).

## Your storeId question — researched and answered
Doc: **`work/RESEARCH-data-binding-architecture.md`**. Conclusion (evidence-based, vs Vega-Lite,
Cube/Looker, Grafana, Tableau, the SDMX ecosystem): **the evolution already shipped and is the right
one — keep it.** Your 3 old variants (local / href / storeId→query+pipe) were not lost; they were
**unified into one `DataStore` port with pluggable kinds** (`static` / `href` / `stats`-cube) behind one
registry, plus a semantic layer (a metric names its store) and declarative cross-store `blend` — the
canonical hybrid the whole field converges on. The query/pipe you valued is intact. Only *adoption*
work remains (use metric refs; author one real blended page), explicitly **not** re-architecting.

## State for the morning
- **Live demo correct + green.** HEAD `6544d29` on `feat/tenant-agnostic-platform`, pushed.
- typecheck 0 · lint 0 errors · check-laws clean · **1669 tests passed**.
- **Reproducibility fixed:** a fresh `compose up` now provisions the real 4-dim data deterministically
  (V34 + canonical-ingest step); `validate-local` realigned to the canonical SSOT (the stale 3-dim
  bundles retired); RUNBOOK updated. One demo-data SSOT = the canonical workbooks.
- DB backup retained: `/tmp/statdash-preCutover-20260626T131739Z.dump`.
- **Playwright MCP** added to `.mcp.json` — restart Claude Code + approve it to give me interactive
  browser access next session (meanwhile I verify via headless Playwright-in-Docker + reading shots).

## Small notes (non-blocking, your call)
- Source-data label spellings already corrected (employees/world/განკარგვადი; net-taxes split per SNA);
  the Georgian net-taxes wording is my SNA translation — swap for the official GeoStat term anytime.
- `verify-parity.ts` kept as a comparator import (dead as a script) — a tidy-up follow-up if you want it.
- `validate-local` STAGE 6 needs `bash`+`curl`+`jq` on the host (noted in the RUNBOOK).
