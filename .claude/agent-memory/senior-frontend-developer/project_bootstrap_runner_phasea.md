---
name: bootstrap-runner-phasea
description: ADR-0026 Phase A client seam — manifest is runtime SSOT; PageLoader resolves via usePageById (SiteContext), not standalone loadPage; modes+formatters registered post-bootstrap from manifest
metadata:
  type: project
---

ADR-0026 (universal SDUI runner) Phase A is done on the geostat client. The seam decisions that are NOT obvious from a quick read:

- **The bootstrapped manifest is the runtime SSOT for pages.** `PageLoader` resolves the current page via `usePageById(pageId)` from `SiteContext` (where `App` injected `manifest.pages`), NOT via the standalone `loadPage()` in `data/pages/registry.ts`. This is the key to the Phase A fitness function: the render path is identical whether the manifest came from `/api/bootstrap` or local `buildManifest()`.
- **`data/pages/registry.ts` is now LOCAL-FALLBACK ONLY.** `listPages()` feeds `buildManifest()` and the `locale-coverage.test.ts`; `loadPage()` was removed (no callers left after PageLoader switched to the manifest). `listPages()` must stay arg-free — the locale-coverage test calls it directly.
- **Two orthogonal flags** (ISP): `VITE_SITE_MODE=api` selects the manifest source (api-or-local, fallback in `resolveManifest`); `VITE_STORE_MODE=stats|api|static` selects the store source. They compose independently — do not fold one into the other.
- **Modes + locale formatters register POST-bootstrap from the manifest** (`App.tsx` effect, before `setBootstrap`). `setupRegistrations.ts` no longer hardcodes `modeRegistry.register(...)` nor side-effect-imports `formatters.ts`. Safe because `App` gates render on `bootstrap` and `AppSkeleton` has no formatted content.

**Why:** ADR-0026 turns apps/geostat into a generic content-agnostic runner; content moves to `/api/bootstrap` (DB-seeded), `buildManifest()` survives as the reversible offline-fallback gate.
**How to apply:** when extending the runner, treat the SiteManifest (`data/site-manifest.ts`) as the contract and the SiteContext as the runtime SSOT — add capabilities as manifest data registered at boot, not as hardcoded app constants. Phase B seeds this content into config.*; Phase C deletes the local fallbacks.

i18n note: only the locale LIST was de-hardcoded (formatters now iterate `manifest.i18n.locales`, using the locale code directly as the Intl tag — dropped the `ka-GE`/`en-US` mapping). A per-locale explicit region tag (if ever needed) is deferred to Phase B when site_config defines the locale catalog. Related: [[conform-engine-types]].
