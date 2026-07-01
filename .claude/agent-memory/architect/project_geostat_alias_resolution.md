---
name: geostat-alias-resolution
description: How @geostat/* packages resolve — path aliases only, NOT npm workspaces; workspace:* protocol is a latent landmine
metadata:
  type: project
---

UPDATE 2026-06-15: the layout moved again — shared layer now lives under `platform/engine/*` (root has `platform/` containing apps + engine), and the repo is now a REAL pnpm workspace: `platform/pnpm-workspace.yaml` globs `engine/*` + `apps/*` and defines a `catalog:` of shared version pins. `engine/react/package.json` now legitimately uses `"@geostat/engine": "workspace:*"` / `"@geostat/styles": "workspace:*"` (pnpm understands these). BUT `node_modules/@geostat` still does not exist — build-time resolution for the `@geostat/*` scope is still ALIAS-based (vite/vitest/tsconfig paths), pnpm workspace governs install/catalog, not in-repo import resolution. So new-package work still requires editing the alias maps below.

(Historical, pre-2026-06-15:) The `@geostat/*` packages resolved **purely through path aliases**, not npm workspaces; the shared layer lived under `engine/` at repo root (`engine/core` = @geostat/engine, `engine/react`, `engine/expr`, `engine/styles`, plus `engine/plugins` which has NO package.json — config vocabulary, resolved via `@plugins/*` alias). Root `package.json` `workspaces` is `["apps/*"]` — does NOT pick up `engine/*`. Resolution happens in three places only: per-app `vite.config.ts` aliases, per-package/app `vitest.config.ts` aliases, and the `paths` map in root `tsconfig.json` (re-pathed for project references) / `apps/*/tsconfig*.json`.

**Why:** the project never wired up real npm workspace linking for the shared layer — aliases were enough for vite/vitest/tsc. `engine/react/package.json` STILL carries `"@geostat/engine": "workspace:*"` and `"@geostat/styles": "workspace:*"` (pnpm syntax) but it is inert because the package was never installed as a workspace. The apps themselves declare NO `@geostat/*` dependency at all — they reach the engine purely by alias.

**Alias map locations (verified 2026-06-15, all under `platform/`):** `tsconfig.json` (root, project-reference base), `apps/geostat/tsconfig.app.json`, `apps/panel/tsconfig.json`, `apps/geostat/vite.config.ts`, `apps/panel/vite.config.ts`, `engine/react/vitest.config.ts` (and core/expr/styles vitest.config.ts for their own scope). A new `@geostat/*` package = an entry in each of these 6+ maps.

**How to apply:** Before any task that touches `package.json` workspaces, build config, or the shared-library directory layout — verify whether pnpm workspace resolution is active (it now is, but `@geostat/*` import resolution is still alias-based). Adding these packages to `workspaces` would make `npm install` try to resolve `workspace:*`, which npm does not understand (EUNSUPPORTEDPROTOCOL) — an install-breaking regression. Converting to true workspaces is a separate, deliberate initiative (convert `workspace:*` → `*`, add the glob, decide alias-vs-symlink precedence), never a side effect of a path move. Verify current state by checking for `node_modules/@geostat` before recommending. Related: [[project_apps_monorepo]].
