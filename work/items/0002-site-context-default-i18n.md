---
id: "0002"
title: "D-2: Remove ka-hardwired DEFAULT_I18N from SiteContext (engine/react)"
status: done
class: G
priority: P2
owner: —
links:
  - docs/audit/2026-06-15-law-violations.md
---
**Goal** — `engine/react/src/context/SiteContext.tsx:42-46` defines:
```ts
const DEFAULT_I18N: I18nConfig = { locales: ['ka'], defaultLocale: 'ka', fallbackLocale: 'ka' }
```
This violates Law 4 (react-agnostic): the shared site-shell provider carries the Geostat
locale as its default — any consumer not passing `i18n` silently inherits Georgian-only config.

Root cause: "agnostic layer carries the first tenant's identity" (Lehman erosion). The app
already passes `i18n={manifest.i18n}` (L6 comment says so), so DEFAULT_I18N only serves as
a footgun for new consumers. More load-bearing than D-1 — affects every tenant/constructor site.

**DoD**
- [ ] `DEFAULT_I18N` with `ka` locale removed from `engine/react`.
- [ ] `SiteProvider.i18n` is a required prop, OR the fallback is a neutral locale-agnostic stub (no `ka`/`ka-GE`).
- [ ] Geostat app passes `i18n` explicitly (it already does — verify no regression).
- [ ] `npx tsc --noEmit` = 0 errors.
- [ ] CI fitness function gate: `engine/react/src/**` and `engine/core/src/**` must contain no literal `'ka'`/`'ka-GE'` locale constants (add to `law_patterns` in `project.json`).

**Notes**
Preferred fix: make `i18n` required on SiteProvider — the type system enforces it, removing the
need for any default. The `manifest.i18n` field is already the SSOT for locale config.
Two-way door. Land together with D-1 in one PR (same erosion shape, same fitness function).
