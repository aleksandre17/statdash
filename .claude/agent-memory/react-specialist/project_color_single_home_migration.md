---
name: color-single-home-migration
description: Page color is projector-only (presentation.color); the v1→v2 migrator (core migration chain) is the FIRST real migrator; flat PageConfigBase.color was removed
metadata:
  type: project
---

Finish-line #4 (ADR adr-config-and-render-vision): page-color SSOT collapsed to ONE home + the dead migration chain exercised, in one stroke.

**Single home:** `presentation.color` is the ONLY page-color home. `PageConfigBase.color` (packages/react/src/engine/types/node.ts) was REMOVED. The `pageColorFallback` channel on `ProjectorEvalCtx` (PresentationProjector.ts) was retired — colorProjector.evaluate() now reads only its raw `presentation.color`; SiteRenderer no longer passes `page.color`. `generatePageConfigSchema` dropped the deprecated page-base `color` property (the emitted page-config.schema.json regenerated — 3 page-root branches lost the flat color block; commit the artifact).

**StaticRenderContext.color stays** — it is a SNAPSHOT render-context convenience (not a page-authored field). `buildStaticContext` folds it into `presentation.color` (legacyPresentation); `renderPageToHTML` also folds a direct-construction `staticCtx.color` into the presentation bag when presentation.color is absent. So removing pageColorFallback kept snapshot color byte-identical.

**The migrator (P-4 chain, packages/core/src/config/migration.ts):** `CURRENT_SCHEMA_VERSION` bumped 1→2. Two migrators registered at MODULE LOAD (migrations are immutable platform history, not a per-tenant seam): `registerMigration(1, c=>c)` (identity — REQUIRED because the runner `break`s at the first missing step, so v0→v1 must exist for a v0 config to REACH v2) and `registerMigration(2, …)` (moves flat `color`→`presentation.color`, drops flat; existing presentation.color WINS; no-color = no spurious presentation bag; preserves sibling presentation keys like crumbs). The chain is CALLED from apps/api (pages.ts, bootstrap/index.ts) + apps/panel saveGuard — now it actually transforms.

**GOTCHA — registerMigration is last-write-wins on a module-global Map.** A test doing `registerMigration(2, throwaway)` CLOBBERS the real v2 migrator for the whole run. The registry-mechanics test in migration.test.ts now uses HIGH targets (90/91) to avoid clobbering real v1/v2.

**F5 fitness** (packages/plugins/nodes/__tests__/page-config-schema.fitness.test.ts — it already registers all projectors): no registered presentation projector key collides with a flat page-base document field (derived from generatePageConfigSchema's page-root $def properties minus NodeBase keys + presentation); plus `color` is gone from the flat surface and lives only as a projector.

**Provisioning + fixtures migrated to v2:** geostat.provisioning.json (3 pages flat color→presentation.color, regional kept its op:find expr; all 4 stamped schemaVersion 2). Edit provisioning by parsing+writing with CRLF preserved and sorting ONLY each page.config's top-level keys (NOT a deep sort — that churns `title` ka/en order). roundtrip-pages + canvasPageAdapter (PageMeta=Omit<PageConfigBase,'id'|'path'> lost color) + pages.test/pages.validation (schemaVersion 1→2 asserts) updated.

Byte-identical: accounts/gdp literal #0080BE → same --sc; landing no color; regional's op:find(fallback #0080BE) already overrode the dead flat color, so --sc unchanged. All 6 gates green; tests 1045→1053 (migration + F5 adds). See [[project-presentation-registry]] [[wire-contract-floor]].
