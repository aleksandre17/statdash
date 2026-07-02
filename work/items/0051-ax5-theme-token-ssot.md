---
id: "0051"
title: "BI-AX5: Dark/light theme axis — `data-theme` token SSOT + chart/map re-theme"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC.DELTA-new12 §3 axis-5, §5 FF-CHART-RETHEMES
depends_on: ["0045", "0016"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — A root-level theme toggle (☀/☾, visible top-right in all 12 shots), orthogonal to locale/perspective/view, that re-themes the WHOLE dashboard including charts and the choropleth — no cached light-mode palette on a dark canvas.

**Implements** — SPEC.DELTA-new12 §3 axis-5. New UI-state axis; token-set SSOT (Constructor-ready capability, not a one-off).

**Target — token-set SSOT** — Theme = a `data-theme="light|dark"` attribute on the document root selecting a CSS-variable token set; ALL color decisions are `var(--color-*)` (no literal colors in components). Applied **synchronously before first paint** (no-FOUC — already done for the initial theme, commit `fd7a5a0`). **Charts must re-theme:** Apex series/axis colors, the GeoMap choropleth ramp, and donut/treemap palettes derive from the CSS tokens at render; on `data-theme` change the chart must **re-read tokens and re-render** (Apex needs an explicit re-init/`updateOptions` — it does not observe CSS-var changes). The GeoMap fill ramp (`styles/utils/choropleth.ts`, token-derived per AR-25) recomputes on theme change.

**Files / modules touched**
- Theme state + `data-theme` application (root), persistence per O-15 (0045): localStorage + `prefers-color-scheme`, NOT URL-encoded.
- Chart shells (Apex/donut/treemap): read color tokens at render; subscribe to `data-theme` change → `updateOptions`/re-init so the palette re-derives.
- `styles/utils/choropleth.ts`: recompute the fill ramp from tokens on theme change.
- Audit for literal color values in components → replace with `var(--color-*)` tokens.

**Dependencies** — 0045 (O-15: persistence model). Relates to 0016 (C1) only insofar as both are cross-cutting render concerns. Independent of the bug fixes.

**Acceptance criteria (incl. fitness functions)**
- [ ] `data-theme` toggles the whole document token set; no literal colors remain in components (all `var(--color-*)`).
- [ ] Theme applied synchronously before first paint (no FOUC); persisted per O-15 (localStorage + prefers-color-scheme, not URL).
- [ ] A theme flip re-derives Apex chart, donut/treemap, and choropleth-ramp colors from tokens (visible re-render, no stale palette).
- [ ] **FF-CHART-RETHEMES**: a `data-theme` flip re-derives chart/map colors from CSS tokens (no cached light-mode palette on a dark canvas).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Token SSOT means "add a theme = add a token set", interface unchanged (OCP). Two-way door.
