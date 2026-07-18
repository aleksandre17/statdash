---
id: "0093"
title: "CHROME INTEGRITY BATCH (fix-on-sight, S) — «[object Object]» links · EN aria-labels on KA · studio topbar EN · dark table-header 4.28:1 AA fail · skip-link"
status: DONE (2026-07-18, commit 37062e5 on main) — all 4 items root-caused + class-closing fitness. Portal :3012 fixes await a build+deploy (built assets); studio topbar LIVE-PROVEN on :3013. See DELIVERY note at foot.
class: S
priority: P0
owner: lead → build agent (sonnet-capable)
implements: sweep findings 5/7 — all chrome strings + accessible names through the ONE i18n contract; an axe fitness so the class never returns; token-bound contrast fix (the 8d86baf discipline)
---

## DELIVERY (2026-07-18, commit 37062e5, senior-frontend)

Per-item ROOT CAUSE → FIX:
1. **«[object Object]» links** — 3 header social links authored `label:{ka,en}` into `SocialLinkDef.label` typed bare `string`; `aria-label={social.label}` rendered the object raw. Fix: widen to `LocaleString` (+ `coverage:'localized'` in the item schema, mirroring FooterLinkDef) and resolve `aria-label={t(social.label)}` (useResolveLocale). Contract-level, no `.toString()`.
2. **EN aria/chrome on KA** — (a) `YearSelectShell` fallback hardcoded `'Year'` → `useT('year-select')('label')` (bilingual default added to the control META i18n). (b) `NodeErrorBoundary` hardcoded "Failed to load component"/"Retry" in app-agnostic engine → new **`useTSafe`** (non-throwing useT twin, symmetric with `useResolveLocaleSafe`) + `feedback` keys `error.title`/`error.retry`; the boundary can fire ABOVE/without a SiteProvider, so a safe resolver was required. (c) Studio topbar (`PageWorkflowBar`) PAGES/HISTORY/SAVE DRAFT/PUBLISH + alerts → panel local-`T` + `useActiveLocales` seam (like PageBrowser). Theme switcher "Light/Dark theme" was NOT broken live (already `useT('ThemeSwitcher')`; the sweep caught a pre-i18n-load transient) — no change.
3. **Dark table header 4.28:1** — `.data-table th` used `--color-text-faint` (tuned vs `--color-surface`) but sits on lighter `--color-surface-raised`. → `--color-text-muted` = 5.09:1 dark / 5.28:1 light (also fixed a marginal 4.48:1 light). Mode-aware token, no hex.
4. **Skip-link** — bilingual "Skip to main content" bypass block, first focusable in `AppChrome`, visible-on-focus (`.skip-link` in a11y.css), targets `#main-content` on `<main>` (feedback key `skip.toContent`).

**THE GATE (class-closer):** extended `FF-RENDER-NO-LOCALE-LEAK` (`apps/geostat/src/data/i18n-full-sync.fitness.test.tsx`) to scan the **accessible-name attribute tree** (aria-label/title/alt/placeholder/aria-description) — the exact seam [object Object] escaped (an attribute never enters `textContent`, which the gate previously scanned only). Asserts no flattened bag in any name + `/en` names carry no leaked Georgian. Negative-proven: reverting the shell resolution → 8 red. **LEDGERED:** full axe/@axe-core adoption deferred (targeted structural gate ships now).

**GATES:** `tsc -b` geostat+panel green · targeted vitest green (extended fitness 22/22; table/chrome/token/dark/a11y/control/engine/page-workflow suites) · eslint 0 errors (react-refresh warnings pre-existing/accepted).

**LIVE:** BEFORE-evidence on :3012 confirmed all 4 defects (probe `work/probe-0093-chrome-a11y.mjs`: 3× `[object Object]` social aria, `Year` select aria, contrast 4.28, no skip-link, first-Tab=brand). Studio topbar AFTER-proven on :3013 (panel-src bind-mount synced): `[გვერდები, ისტორია, მონახაზის შენახვა, გამოქვეყნება]`, 0 page errors (`work/authoring-truth/0093/studio-topbar.png`).

**DEPLOY FLAG (serialize with infra):** portal :3012 serves BUILT assets — items 1/3/4 + the provisioning catalog keys need a portal **build + deploy** to go live; studio :3013 bakes `packages/*` as source (only `apps/panel/src` is bind-mounted) so its chrome (NodeErrorBoundary/AppChrome/table) also needs the whole-`packages`-src tar-sync + container restart. Neither triggered here (shared-infra side-effect, per card). Acceptance check ready: `node platform/work/probe-0093-chrome-a11y.mjs` (expects 0 `[object Object]`, Georgian `Year` aria, dark contrast ≥4.5, skip-link on first Tab).
