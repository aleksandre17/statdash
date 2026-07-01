---
name: constructor-templates-generate-v7
description: V7 starter-template gallery + data-first "generate a dashboard" in apps/panel — templates ARE valid NodePageConfigs, generation reuses suggestPanels/buildSuggestedSpec
metadata:
  type: project
---

V7 of the Constructor roadmap: "never start blank" (ADR `adr_constructor_vision_north_star.md` V7, Wix/Gutenberg templates-first + Budibase data-first). All ADDITIVE — templates/generated configs are VALID NodePageConfigs that pass the same gates a hand-built page does. Lives in `apps/panel/src/features/templates/`.

**Key gotcha — the save-guard's per-node REQUIRED-field check (`save/saveGuard.ts` Check 3a via `inspector/validateField`) is what templates must survive, not just the structural `validateConfig`.** `createPage` (api-actions) runs `assertSaveable` → `validatePageForSave` BEFORE the server write. So a committed template / generated page must fill every REQUIRED PropSchema field or it's rejected. Required fields by slice: `page-header.title`, `section.title` (strings), `chart.chartType`, `kpi-strip.items` (non-empty array), `map`/`geograph` (geoJsonUrl/geoCodeMap/paramKey/isoField — UNfillable from a profile). Consequence:
- Starters use ONLY page-header/filter-bar/section/chart/table with placeholder titles + chartType; NO empty kpi-strip/map/geograph (their required fields can't ship blank). Panels carry NO `data` (author binds later via Show-Me/field-wells → Law 2, no fabricated codes). Placeholder titles are generic ('ახალი გვერდი'/'სექცია'), not domain data.
- The data-first generator maps EVERY suggestion to a `chart` (chart's only required field is chartType, always supplied) carrying the bound DataSpec — map/tree/kpi-strip suggestions still render as a data-bound chart (line for timeseries, bar otherwise). Author swaps to richer panels once extra inputs exist.

**Files:**
- `starterTemplates.ts` — 3 committed `StarterTemplate` (single-chart / chart-table / ons-dashboard). Each `config` is a `NodePageConfig` with STABLE authored ids (deterministic round-trip). `name`/`description` typed `{ka,en}` NOT `LocaleString` (LocaleString=string|{ka,en} → no `.ka` access; the bilingual object is the honest type, mirrors NavItem.label/CanvasPage.title).
- `generatePage.ts` (PURE) — `generatePageFromProfile(profile)`: REUSES `discovery/suggestPanels` + `data-layer/showme/buildSuggestedSpec` (NO new suggestion logic — the V7 invariant). CHART_TYPE_BY_SUGGESTION map (timeseries→line, else bar) is the only translation SSOT. Returns null when no measure bindable (caller falls back to a starter).
- `loadTemplate.ts` (PURE + 1 thunk) — `hydrateTemplate(config,title,slug)` stamps id/path from slug + `fromNodePageConfig` (the SAME adapter every loaded page uses). `createFromTemplate` → the SAME `createPage` thunk PageBrowser uses (save-guard + server + setActivePage). `slugify` mirrors PageBrowser.
- `TemplateGallery.tsx` — dialog; starters are a semantic `role=radiogroup`/`role=radio` (tabIndex 0, Space/Enter selects = keyboard equiv, WCAG 2.1 AA). Data-first generate option only renders when `useActiveProfile().status==='ready'` (graceful degradation). `onCreated` prop fired on success so the host (PageBrowser) closes.
- Wired into `page-workflow/PageBrowser.tsx`: "From template" (primary, variant=contained) opens the gallery; "Blank page" (the old inline form) is the escape hatch.

**Fitness (the invariant):** `templates.fitness.test.ts` — for EVERY starter + a generated page: `validateConfig`===[] AND adapter round-trip lossless AND `validatePageForSave`.ok (registers real registry via setupCanvasRegistry in beforeAll so knownNodeTypes + per-node schemas are live). `loadTemplate.test.ts` (slugify/hydrate purity) + `TemplateGallery.test.tsx` (radiogroup a11y, Space-selects, pick→createFromTemplate, create-disabled-until-chosen).

**Green:** build:engine+geostat+panel+typecheck+lint(0 err, 44 accepted react-refresh warnings)+test 1385→1410 (+25: templates.fitness 14, loadTemplate 5, TemplateGallery 5 ... + per-starter parametrized). No engine/config TYPE changed — pure additive panel feature.
