---
name: apps-monorepo-migration
description: The apps/ monorepo restructure — why a @plugins alias was introduced and how the geostat app was moved under apps/
metadata:
  type: project
---

The project moved from a single-package root app to npm workspaces with `apps/geostat/` (moved from root `src/`) and a new empty `apps/panel/` (Phase 2 Constructor admin panel). `packages/` and `plugins/` stayed at repo root as shared, source-aliased layers (no build step — Vite `resolve.alias` + tsconfig `paths` point straight at `.ts` source).

**Why:** Phase 2 needs a second Vite+React app (the Constructor) sharing the same engine/react/plugins layers. npm workspaces (not Turborepo/Nx/pnpm) was the YAGNI-correct choice — two app entry points sharing hoisted deps.

**How to apply:** A `@plugins/*` alias was introduced as the stable seam at the plugins boundary. Reason: `src/` imported plugins by *relative path* (`../plugins`, `../../plugins`) in 8 files (`setupRegistrations.ts`, `app/LocaleGuard.tsx`, 6 `pages/*`), which silently break when `src/` nests deeper under `apps/geostat/`. Packages were always consumed via `@geostat/*` aliases (alias-portable); only plugins used relative imports. When touching imports in apps, prefer `@plugins/*` / `@geostat/*` over relative climbs. Each app carries its own vite.config + tsconfig.app.json with alias `paths` re-pathed `../../` to reach root packages/plugins. Verify with [[arrow-dependency-rule]]: packages ← react ← plugins ← apps; plugins never import apps/src (confirmed).
