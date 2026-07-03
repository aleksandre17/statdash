---
name: ar37-p0-locale-binding
description: AR-37 P0 (i18n full-sync) shipped — <html lang>/dir + i18next global bound at LocaleGuard via localeDirection registry in packages/react
metadata:
  type: project
---

AR-37 P0 (`platform/work/DESIGN-i18n-full-sync-and-integrity-badges.md`) shipped on
`feat/i18n-p0-locale-binding`: `document.documentElement.lang`/`dir` were frozen at
`index.html`'s `lang="en"` forever (R1), and the i18next global `language` never left
`'en'` (R3) — `useT` masked it per-call but any global reader leaked.

**Fix seam (small, isolated, matches the design 1:1):**
- `packages/react/src/context/localeDirection.ts` — new public export `localeDirection(locale): 'ltr'|'rtl'`,
  a static lookup (ar/he/fa/ur → rtl, else ltr), agnostic/Postel-ready (Law 1/8) — no per-locale
  conditional in a shell. Exported from `packages/react/src/index.ts`.
- `apps/geostat/src/app/LocaleGuard.tsx` — `useBindDocumentLocale(locale)` (`useLayoutEffect`,
  pre-paint) sets `documentElement.lang`/`dir` + calls `i18next.changeLanguage(locale)`. Called
  unconditionally BEFORE the invalid-locale early-return (`Navigate`), binding
  `manifest.i18n.defaultLocale` (not the raw invalid segment) in that branch.
- `apps/geostat/src/main.tsx` — mirrors the pre-paint pattern already used for `data-theme`:
  parses the first `/:locale/*` URL segment synchronously (before `ReactDOM.createRoot(...).render`)
  and sets `lang`/`dir` from it directly (no manifest validation available yet — LocaleGuard's
  layout effect corrects it once the manifest resolves). Prevents a one-frame flash on hard-load.
- New fitness gate `apps/geostat/src/data/html-lang-binding.fitness.test.tsx` (FF-HTML-LANG-BOUND) —
  mirrors the `localeString-render-guard.fitness.test.tsx` harness (manifest-derived page×locale
  matrix, mounts real `LocaleGuard`), asserts `documentElement.lang === locale` + `dir === localeDirection(locale)`
  + `i18next.language === locale` for every shipped locale/page, plus the invalid-segment→defaultLocale case.

**Deferred to later AR-37 phases (do NOT do in a P0-scoped task):** P1 widen
`SectionMethodology` source/lastUpdated to `LocaleString`; P2 provisioning backfill +
`FF-AUTHORING-LOCALE-COMPLETE`; P3 `useLocaleVersion` for the Leaflet map remount key; P4
Constructor `LocaleField` + `FF-RENDER-NO-LOCALE-LEAK`. See design doc §3 for the full phase table.
