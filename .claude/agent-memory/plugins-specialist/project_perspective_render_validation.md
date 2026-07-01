---
name: perspective-render-validation
description: How to validate the perspective-axis user-facing surfaces by rendering real geostat pages in jsdom from the provisioning manifest; the canvas preview seam landed
metadata:
  type: project
---

Validating the perspective-axis refactor's RENDERED behavior (toggle / KPI `when` / filter `visibleWhen` / permalink) without a live API:

**Harness pattern (path b — full render, URL-driven).** A jsdom test in `apps/geostat/src/data/` can render the REAL geostat pages by building a `SiteManifest` from `apps/api/provisioning/geostat.provisioning.json` (read via `fs`, NOT an import — keeps the dependency arrow clean):
- `pages` = `Object.fromEntries(prov.pages.map(p => [p.slug, p.config]))` (the `config` IS the `NodePageConfig` with `perspectives` attached, keyed by the URL slug — LocaleGuard routes `:pageId` by slug).
- `i18n`/`modes`/`nav`/`chrome`/`chrome_config`/`index_page_id` come from `prov.siteConfig` (a `{key,value}[]` array — `Object.fromEntries` it).
- Boot exactly like the second-tenant fitness test ([[geostat-runner-render-test-harness]]): `i18next.init` + `setupRegistrations()` in `beforeAll`, then `manifest.modes.forEach(perspectiveRegistry.register)` + `registerFormatters`. Render `MemoryRouter → SiteProvider → Routes → LocaleGuard`.
- **Perspective is driven by the URL**: `initialEntries=['/ka/gdp?mode=range']`. `stores={{}}` is fine — `resolveStore` falls back to an empty `staticStore`, and `interpretKpis` filters by `when` BEFORE reading data, so the KPI partition + bar + filter gates render faithfully with zero data.

**Why:** the perspective axis is STRUCTURAL — bar/KPI-`when`/filter-`visibleWhen` are pure `(config, perspectiveState)` functions, evaluated pre-data. So jsdom-without-a-store proves them. Data VALUES (104 598 etc.) are NOT provable this way (need the seeded stack) — that's the data pipeline's concern, not the axis.

**How to apply:** when asked to validate perspective surfaces and Docker/DB is unreachable (common in this env — `docker` not on PATH, `:3001` → 500 ECONNRESET), use this harness instead of forcing path (a). Read the DOM dump for value correctness, don't trust "no throw". The GDP/Accounts/Regional axis param is `mode`; perspectives are `year`(ka წლიური/en Annual, icon calendar) + `range`(ka დინამიკა/en Dynamics, icon calendar-range); a 3rd registered `compare` mode is correctly NOT shown (bar is axis-driven, not registry-driven).

**Seam update (supersedes the escalation note in [[constructor-perspectives-pane-pfinal]]):** the live-canvas perspective preview seam HAS LANDED — `apps/panel/src/canvas/CanvasView.tsx` builds `previewEntry = /?${perspectiveKey}=${previewPerspectiveId}`, seeding the canvas MemoryRouter with the same axis param the runner reads. No longer escalated/missing.

**Env artifacts to expect (NOT perspective bugs):** unresolved `{fromYear}`/`{time}` template tokens (empty store ⇒ no time dims), regional choropleth `Worker is not defined` (jsdom has no Web Worker; error boundary degrades to Retry), ka empty-state showing raw `empty.title` keys (harness boots i18next with `resources:{}`; ka feedback catalog not loaded in-test).
