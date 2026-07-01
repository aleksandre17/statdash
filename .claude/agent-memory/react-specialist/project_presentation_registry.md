---
name: project-presentation-registry
description: ADR-0029 v2 Presentation-Projection Registry — where the seam lives, how projectors register, the tenant-agnostic-label gotcha
metadata:
  type: project
---

The page-presentation seam (page color, breadcrumbs, future title/badge/theme) is a Presentation-Projection Registry [ADR-0029 v2].

**Where it lives:**
- Engine infra: `packages/react/src/engine/presentation/` — `PresentationProjector.ts` (contract: key, schema(), evaluate(raw, evalExpr, ctx), project(value, sink)), `presentationRegistry.ts` (register/list/`presentationPropSchema`), `projectPresentation.ts` (the SSOT loop both renderers share). Re-exported from `@statdash/react/engine`.
- Concrete projectors: `packages/plugins/presentation/{colorProjector,crumbsProjector}.ts` + `index.ts` exporting `registerPresentationProjectors()`. New subpath `@statdash/plugins/presentation` (added to plugins package.json exports, tsup entry, root tsconfig paths, both app tsconfigs, plugins vitest include glob).
- Registered at boot in `apps/geostat/src/setupRegistrations.ts` AND `apps/panel/src/canvas/setupCanvasRegistry.ts`, beside `registerStoreBuilders()`.

**Renderers carry ZERO concern code:** `SiteRenderer.tsx` + `targets/html.tsx` call `projectPresentation(...)`, apply `sink.cssVars` on the wrapper div and spread `sink.nav` into navContext. (UPDATE — finish-line #4: the old `pageColorFallback: page.color` channel and the flat `PageConfigBase.color` field were REMOVED. `presentation.color` is now color's single home, reached via the v1→v2 migration. See [[color-single-home-migration]].)

**Gotcha — tenant-agnostic labels:** PropField `label` in plugin projectors must be `en`-ONLY (`{ en: '…' }`). The `tests/no-tenant-content.fitness.test.ts` (TIER 2) forbids Georgian script in library code EXCEPT files matching `*Node.ts` / `meta.ts` (the `isCatalogClass` allowlist). Projector files are neither, so a `ka` label there fails the build. Tenant locales arrive via the manifest i18n catalog at boot.

**Provisioning was already migrated** (v1): `apps/api/provisioning/geostat.provisioning.json` already uses `presentation.{color,crumbs}` (verbatim expr objects). No `_pageColor`/`_pageCrumbs` keys remain in any config/fixture.

**Invariants verified:** byte-identical render (page `--sc` color + crumb trail), lossless round-trip (`STRUCTURAL_KEYS` = type/variant/id/children only, so `presentation` carries as an arbitrary prop), all 6 gates green. See [[registry-over-special-case]].
