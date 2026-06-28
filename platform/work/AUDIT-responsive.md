# Responsive-Design Audit — statdash-platform (geostat runner + Constructor panel)

> Senior frontend-architect / design-science review across the full resolution ladder.
> **AUDIT-ONLY** — no product code was modified. Findings + root-caused, design-system-expressed fix plan.
> Author pass: real-browser render (Playwright/Chromium), 54 screenshots, programmatic overflow measurement.

---

## 0. Render path (verified) + exit codes

| Step | Result |
|------|--------|
| Local browser tooling | `npx playwright --version` → **1.61.1**; no browsers pre-installed. |
| `npx playwright install chromium` | **chromium-1228 + headless_shell-1228 + ffmpeg-1011 installed** (exit 0). |
| `playwright` node module | installed into scratchpad (browsers reused from default `ms-playwright`), exit 0. |
| Live server probe | `GET http://192.168.1.199:3002/api/bootstrap` → **HTTP 200**; root `/` → 200; panel `:3003/` → 200. |
| Local API render path | **Not used** — `apps/api` needs Postgres + seeded provisioning (heavy, real-server side-effects); out of an audit's reversible scope. |
| Screenshot run (`shoot.mjs`) | **exit 0** — 4 geostat pages × 12 widths + panel × 6 widths = 54 PNGs + `_metrics.json`. |
| Re-measure run (`remeasure.mjs`, `diag.mjs`, `srcheck.mjs`) | **exit 0** — true-visible-overflow + computed-style diagnostics. |

**Render target chosen: the live server at `:3002` / `:3003`.** It serves the real, fully-provisioned site (gdp / accounts / regional dashboards with real data + all shells) which a content-less local dev build cannot (the runner is de-tenanted — ADR-0028 — and fails-soft to an empty manifest with no API).

### Branch-staleness assessment (important — and favorable)
The live server builds from `main`. The audited branch is `feat/tenant-agnostic-platform`.
`git merge-base origin/main HEAD` = `origin/main` (8a05420) → **this branch is strictly *ahead* of `origin/main`; `main` has nothing the branch lacks.** Diff of the responsive-relevant surfaces (`packages/styles`, `packages/react/src/theme`, shell components, app CSS) between `origin/main` and `HEAD`:

```
packages/react/src/components/filters/CascadeSelect.tsx | 14 ++--
packages/styles/src/css/animations.css                  | 27 ++   (reduced-motion)
packages/styles/src/index.ts / utils/motion.ts / utils/tokenColor.ts | additive
```

None of these touch breakpoints, grid/flex, the fluid scale, container queries, or shell layout. **The `:3002` render is responsively representative of this branch** — every layout/proportion finding below holds for `feat/tenant-agnostic-platform`. The only branch-delta is reduced-motion/token-color utilities (no layout effect).

### Scope reached vs not
- **Reached & audited:** geostat `landing`, `gdp`, `accounts`, `regional` at 360/390/414/768/834/1024/1280/1440/1680/1920/2560/3440. Every shell: AppHeader, PageHeader, FilterBar, KPI strip, chart, table, Leaflet map, perspective toggle, section blocks, methodology footer.
- **NOT reached:** the **Constructor canvas/inspector is auth-gated** — `:3003` renders a login card only (`Constructor / GeoStat Statistics Dashboard Platform`, username/password). The login card centers correctly with zero overflow at all 6 widths, but the actual authoring UI (canvas/outline/inspector/cmdk) **could not be audited without credentials**. → see Limitation L1.

Screenshots: `platform/work/audit-shots/` (`geo_<page>_<width>.png`, `panel_panel_<width>.png`, `_metrics.json`).

---

## 1. Executive summary

### The three systemic roots (fix these first — each resolves many findings)

**R1 · `.sr-only` accessible-table scroll leak → phantom horizontal scroll on EVERY dashboard (P0, WCAG 1.4.10 Reflow failure).**
`ChartDataTable.tsx:44` renders the AT-facing data mirror as `<table className="sr-only">` directly. For a `<table>`, CSS `width:1px` is only a **minimum** (auto table-layout never shrinks below min-content), and `.sr-only`'s own `white-space:nowrap` (`packages/react/src/styles/a11y.css:14`) forces every cell to its full single-line width. Computed result (measured in-browser): the "hidden" table is **1327.88px wide**, not 1px. The deprecated `clip:rect(0,0,0,0)` hides it *visually* but does **not** remove its box from scroll-overflow, so the full-data-width absolutely-positioned table expands `document.scrollWidth`. This is the entire cause of the giant measured overflows:

| page | width | measured hOverflow (incl. sr-only) | **true VISIBLE overflow (sr-only excluded)** |
|------|------:|----:|----:|
| regional | 360 | 985px | **13px** |
| accounts | 360 | 599px | **13px** |
| gdp | 360 | 368px | **13px** |
| regional | 1024 | 828px | **72px** (R2, not sr-only) |
| regional | 2560 | 196px | **0** |

Every dashboard has draggable horizontal scroll into empty space on every width below the data-table's intrinsic min-content width (≈ up to 3440 for `regional`). One fix kills the whole column.

**R2 · AppHeader flex overflow in the ~960–1100px band → 72px horizontal scroll + clipped locale switcher at 1024 on every page (P1).**
`.app-header__inner` (`app-header/default/app-header.css:13`) is `display:flex; justify-content:space-between` with `flex-shrink:0` on both `.app-header__brand` and `.app-header__actions` and **no `min-width:0`**. The brand block (logo + the multi-line Georgian agency name/tagline) does not shrink; in the band after the nav hides (`@media max-width:960`) but before the viewport is wide enough, brand + actions exceed the inner width → `space-between` cannot go negative → actions are pushed **72px past the right edge** (`.app-header__actions` right=1096 on a 1024 viewport; the `ENG` locale button sits in the clipped zone). Confirmed on gdp/accounts/regional, present at 1024, gone by 1280.

**R3 · No shared content max-width → proportion breaks at both ends of the ladder (P1).**
`page-layout.css` gives three layout variants *inconsistent* width strategies: `[data-layout="centered"]` caps `.page-content` at **800px** (too narrow — `regional` renders an 800px column stranded in a 3440 viewport, huge dead margins), `[data-layout="full-width"]` is `max-width:none`, and the default `.page-content` (`flex:1 1 0`, no cap) **stretches edge-to-edge** — so `gdp @3440` blows the donut to ~700px and KPI cards to ~900px with tiny content. Meanwhile the AppHeader *is* capped at 1280px, so header and body disagree about the page's measure. There is no `--size-container-*` token wired into the content area despite the tokens already existing (`--size-container-wide: 1280px`).

### Worst per-breakpoint offenders
- **360–414 (small mobile):** R1 phantom scroll (all dashboards); FilterBar native `<select>` oversize forcing hidden-scrollbar horizontal scroll of the bar (P2); gdp chart y-axis shows raw floats `120000.000000000000` (P2); PageHeader title truncates to `მთლიანი შიდა პრ…` (P3).
- **768–834 (tablet):** Largely healthy — KPI 2-col, map|donut 2-col reflow correctly; bottom bar-chart category labels overlap/crowd (P2). R1 scroll still present on regional/accounts.
- **1024 (the danger band):** R2 header 72px overflow + clipped `ENG` button on every page.
- **1280–1920 (desktop):** Cleanest tier — zero visible overflow; inner-sidebar nav rail appears correctly.
- **2560–3440 (ultrawide):** R3 over-stretch — uncapped pages balloon; `centered` pages strand an 800px column; gdp's bottom section renders **giant solid-blue empty placeholder panels** dominating ~6000px of height (P2, likely empty-data/unsupported-panel rendered as flat fill — not gracefully degrading).

### Build-readiness verdict
**READY for a focused fix wave.** The design system is fundamentally sound — it already ships a fluid type scale (`--font-size-fluid-*` clamp tokens), a full responsive aspect-ratio / padding / margin / gap cascade with **both `@media` and `@container` variants** (`node-styles.css`), container-queried cards (`card.css`), and a breakpoint scale (480/640/768/1024/1280/1536). The defects are **not** a missing system — they are (a) one mis-applied a11y utility, (b) two missing `min-width:0`/`max-width` guards, and (c) under-use of the fluid tokens that already exist. No magic numbers needed; every fix is a token or a one-line flex/container correction. P0 (R1) is a small, surgical, high-impact change. Estimated wave: P0 + P1 in one sprint, P2/P3 as polish.

---

## 2. Design-system inventory (what already exists — fixes must use it)

| Capability | Where | Status |
|---|---|---|
| Fluid type scale `clamp(min, fluid, max)` | `styles/css/tokens.css:91-96` (`--font-size-fluid-sm…display`) | **Exists, under-used** by shells (inner h1 uses a fixed 17px, not a fluid token). |
| Spacing scale (4px grid) | `tokens.css:9-17` | Good. |
| Responsive aspect-ratio cascade (`@media` **and** `@container`) | `node-styles.css:83-96` | Exemplary — desktop-default max-width cascade, Builder.io override semantics. |
| Responsive padding/margin/gap/width/… cascade | `node-styles.css:280-615` | Exemplary, per-breakpoint var fallback chain. |
| Container queries on cards | `card.css:20,178` (`container-type: inline-size`) | Good — charts in narrow columns can self-adapt. |
| Breakpoint scale | 480 / 640 / 768 / 1024 / 1280 / 1536 (node-styles), 960 (app-header), 1280 (filter-bar, page-layout) | **Mixed sources** — header uses 960/640, layout uses 1280, node-system uses the 6-step scale. No single breakpoint *token* (R3-adjacent). |
| Container max-width tokens | `tokens.css:39-41` (`--size-container-narrow/mid/wide`) | **Defined but NOT wired** into `.page-content`. |
| `.sr-only` utility | `react/src/styles/a11y.css:6-16` | Correct for text; **unsafe on `<table>`** (R1). |

---

## 3. Per-page × per-breakpoint × per-shell findings (severity-ranked)

Severity: **P0** breakage / a11y-failure · **P1** layout break or clipped content · **P2** proportion/density defect · **P3** polish.

### 3.1 All dashboards (gdp / accounts / regional) — shared shells

| ID | Shell | Width(s) | Severity | Finding | Root cause (file) |
|----|-------|----------|----------|---------|-------------------|
| F1 | Chart (AT data-table) | all < table-min-content (≤2560 on regional, ≤1024 on gdp) | **P0** | Phantom horizontal scroll into empty space; page draggable right with nothing there. WCAG 1.4.10 Reflow + 1.4.4 fail. | **R1** — `ChartDataTable.tsx:44` `<table class="sr-only">` + `a11y.css:14` `white-space:nowrap` → table min-content 1328px leaks scrollWidth; `clip` is paint-only. |
| F2 | AppHeader | ~960–1100 (peaks at 1024) | **P1** | `.app-header__actions` pushed 72px off the right edge; `ENG` button clipped; 72px page scroll. | **R2** — `app-header.css:13,58` flex `space-between` + `flex-shrink:0`, no `min-width:0`; brand tagline non-shrinking. |
| F3 | PageHeader title | ≤414 | P3 | Page title ellipsis-truncates (`მთლიანი შიდა პრ…`) — primary heading loses words on mobile. | PageHeader title is single-line truncated; no mobile wrap allowance. |
| F4 | PageHeader h1 | all | P3 | Inner-page `<h1>` computes to **17px** (~1.06rem) — undersized vs the type hierarchy (landing h1 = 50px). Weak page-title prominence. | Inner PageHeader title uses a fixed small size, not `--font-size-fluid-lg/xl`. |
| F5 | FilterBar | ≤414 | P2 | Native `<select>` (region cascade) sizes to longest option (≈374–604px) → forces the sticky `.filter-bar` to scroll horizontally **with its scrollbar hidden** (`scrollbar-width:none`) → no scroll affordance (Least Astonishment). Contained (no page break), but poor mobile UX. | `filter-bar.css:17-20,57` — `.filter-select` has no `max-width`; bar hides its scrollbar. |

### 3.2 gdp

| ID | Shell | Width(s) | Severity | Finding | Root cause |
|----|-------|----------|----------|---------|------------|
| F6 | Chart (bar) y-axis | ≤414 | P2 | Y-axis labels render raw floats `120000.000000000000` (full precision) — overflows the plot, looks broken. Desktop shows correct `88 425.6`. Width-dependent: ApexCharts axis formatter not applied at narrow tick density. | Chart axis label formatter (chart config) — not a layout token, but a width-triggered visible defect. |
| F7 | Section panels (bottom "შემოსავლების მეთოდით") | ≥1440 | P2 | Renders as 4 **giant solid-blue empty blocks** (~1600px tall each) with tiny centered labels — dominates the page, no graceful empty/placeholder state. | Empty-data / unsupported panel type rendered as flat fill; panel does not cap height or show an empty-state shell. |
| F8 | KPI strip | ≥2560 | P2 | KPI cards stretch to ~900px each with tiny value text — disproportionate whitespace. | **R3** — no content max-width; KPI grid tracks grow unbounded. |

### 3.3 accounts (table-heavy, tallest page)

| ID | Shell | Width(s) | Severity | Finding | Root cause |
|----|-------|----------|----------|---------|------------|
| F9 | Page height | 360 | P2 | `scrollH ≈ 5568px` — extreme vertical stacking on mobile; every section full-width single column with little progressive disclosure. Long scroll fatigue. | Many sections, all expanded on mobile; no mobile collapse of secondary sections (ONS progressive-disclosure pattern under-applied at small widths). |
| F10 | Visible data-table | ≤768 | OK (verify) | Visible `.data-table` wraps in `.data-table__wrap { overflow-x:auto }` (`data-table.css:7`) → wide tables scroll **inside their card** correctly. No page break. Good. | — (confirms only the *sr-only* mirror leaks, not the visible table). |

### 3.4 regional (map + wide comparison table)

| ID | Shell | Width(s) | Severity | Finding | Root cause |
|----|-------|----------|----------|---------|------------|
| F11 | Chart SVG | 768 | P2 | Apex/region chart SVG intrinsic 826px in a 768 viewport — clipped (contained, no page scroll), not fluid-resizing to container at 768. | Chart not honoring container width at the 768 step; container-query/`width:100%` not reaching the SVG. |
| F12 | Content column | ≥2560 | P2 | `regional` uses `[data-layout="centered"]` → `.page-content` capped at **800px**; on 2560/3440 the dashboard is an 800px ribbon with vast dead side-margins. | **R3** — `page-layout.css` centered cap is a reading-width (800px), wrong for a data dashboard. |
| F13 | Bottom bar-chart labels | 768–1024 | P2 | Region-name y-axis labels overlap/crowd into an unreadable pile; plot area mostly empty whitespace. | Horizontal bar chart label density not responsive; no label rotation/truncation at mid widths. |

### 3.5 landing (marketing hero) — strongest page

| ID | Shell | Width(s) | Severity | Finding | Root cause |
|----|-------|----------|----------|---------|------------|
| F14 | Hero h1 | 1280→1440 transition | P3 | h1 steps 27px → 50px across the 1280–1440 boundary (layout switches from compact to full hero) rather than scaling continuously. | Hero size driven by a layout-mode breakpoint, not a single end-to-end `--font-size-fluid-display` clamp across the whole range. |
| F15 | Overall | 360–3440 | OK | No overflow at any width; 3-card grid → stack, KPI carousel, footer all reflow cleanly. Reference-quality. | — |

### 3.6 Constructor panel (`:3003`)

| ID | Width(s) | Severity | Finding |
|----|----------|----------|---------|
| L1 | 360–2560 | **Limitation** | Auth-gated — only the **login card** rendered (centers correctly, zero overflow at all widths). The canvas/outline/inspector/cmdk authoring UI was **not auditable without credentials**. Re-run needed with a session, or a current-branch local panel build, to audit the Constructor responsively. |

---

## 4. Systemic roots → single fixes that resolve many findings

| Root | Resolves | Design-system fix (NO magic numbers) |
|------|----------|--------------------------------------|
| **R1** sr-only table scroll leak | F1 (all dashboards × most widths) — the single largest finding | **(a) Component:** wrap the AT table in a `.sr-only` **div** — `<div className="sr-only"><table>…</table></div>` — so the 1px overflow-hidden box is the boundary (canonical visually-hidden-for-complex-content pattern; the table overflows the *div's* clipped 1px box, not the document). **(b) Harden the utility** (`a11y.css`): replace deprecated `clip` with `clip-path: inset(50%)` and keep `width/height:1px` authoritative. **(c) Fitness function:** a Playwright/jsdom test asserting `documentElement.scrollWidth <= clientWidth + 1` on every dashboard page at 360px — encode the invariant so it can't regress (Evolutionary Architecture / standards-as-code). |
| **R2** header flex overflow | F2 (every page @~1024) | Add `min-width:0` to `.app-header__inner`'s flex children and let the brand tagline truncate (`.app-header__brand { min-width:0 }` + the tagline `text-overflow:ellipsis`), **or** collapse the descriptive tagline below a breakpoint **token** (reuse the existing 1024 step, not a new literal). Keeps `flex-shrink:0` only on the truly atomic actions. |
| **R3** no content measure | F8, F12, F3-adjacent, ultrawide proportion across all pages | Wire the **already-existing** `--size-container-wide` (1280px) into `.page-content` as a shared `max-width` with `margin-inline:auto`, replacing the inconsistent 800px-cap / uncapped split. Make the per-variant cap a token (`--page-measure`), so `centered` = a wider dashboard measure, `full-width` = `--size-container-wide`, default = same — header and body finally agree. Fluidize KPI/chart sizing with `clamp()` + container queries (the card system already has `container-type`). |
| **R4** typographic hierarchy under-uses fluid scale | F4, F14 | Bind inner PageHeader `<h1>` to `--font-size-fluid-lg`/`xl` and the landing hero to `--font-size-fluid-display` **end-to-end** (single clamp across the whole range) so titles scale continuously instead of stepping at layout-mode breakpoints. |
| **R5** charts not container-fluid at mid widths | F11, F13, F6 | Ensure chart SVG honors `width:100%` of its container-queried card; add responsive label handling (rotation/truncation) via the chart shell, and apply the value formatter to axis ticks (F6) so narrow widths don't fall back to raw floats. |

---

## 5. Prioritized fix sequence (sized for one follow-up build wave)

**P0 — breakage / accessibility (do first, smallest surface, biggest win)**
1. **R1** — fix `ChartDataTable` sr-only wrapping + harden `.sr-only` (`clip-path: inset(50%)`). Add the `scrollWidth ≤ clientWidth` fitness test. → eliminates F1 on all dashboards at all widths. *(WCAG 1.4.10 Reflow + 1.4.4.)*

**P1 — visible layout breaks**
2. **R2** — `min-width:0` on header flex children + tagline truncation/breakpoint. → F2.
3. **R3** — wire `--size-container-wide` into a shared `--page-measure` on `.page-content`; retire the 800px/uncapped split. → F8, F12, ultrawide proportion.

**P2 — proportion / density / chart fidelity**
4. **R5** — chart container-fluidity + axis formatter + label density (F6, F11, F13).
5. **F7** — empty/unsupported panel graceful-degradation shell (cap height, render an empty-state, never a flat color block).
6. **F5** — constrain FilterBar `.filter-select` width on mobile + restore a scroll affordance (or wrap to `--strip` variant on small widths — the wrapping variant already exists, `filter-bar.css:23`).
7. **F9** — collapse secondary sections by default on small widths (the platform's own ONS progressive-disclosure law, under-applied at mobile).

**P3 — polish**
8. **R4** — fluid-token the inner h1 (F4) and landing hero (F14); allow PageHeader title to wrap on mobile (F3).

**Follow-up (separate, needs access)**
9. **L1** — obtain Constructor credentials (or a current-branch local panel build) and run the same ladder over canvas/outline/inspector/cmdk.

---

## 6. Verification artifacts
- Screenshots (54): `platform/work/audit-shots/geo_<page>_<width>.png`, `panel_panel_<width>.png`.
- Raw measurements: `platform/work/audit-shots/_metrics.json` (per width × page: scrollWidth, clientWidth, scrollHeight, h1 size, overflow-offender elements).
- In-browser computed-style proof of R1: `.sr-only` table computed `width: 1327.88px` (rule says `1px`) — the table-min-content + `white-space:nowrap` defeat documented above.
- Method: headless Chromium 1228, `deviceScaleFactor:1`, `prefers-reduced-motion: reduce`, `networkidle` + 2.6s settle, full-page capture; true-visible overflow computed by hiding `.sr-only` and re-measuring.

> Every visual finding above was confirmed against a real render (standing rule honored). The only un-rendered surface is the auth-gated Constructor canvas (L1).
