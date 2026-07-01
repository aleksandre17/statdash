---
name: vitest4-workspace-removed
description: Vitest 4 silently ignores vitest.workspace.ts — projects must live in root vitest.config.ts test.projects
metadata:
  type: project
---

Vitest 4 (platform is on 4.1.8) **removed workspace support**. A standalone `vitest.workspace.ts` file is **silently ignored** — not auto-discovered, no warning. (Only the *inline* `test.workspace` config option throws an explicit error: "The `test.workspace` option was removed in Vitest 4. Please migrate to `test.projects`.")

**Symptom this produces:** running `vitest run <dir>` from the monorepo root finds *no* project config (no root `vitest.config.ts`, workspace file ignored) → falls back to a default single-project config with **no resolve.alias** → every `@geostat/*` import falls through to the package's `package.json` exports → `./dist/index.js` (no dist built) → "Failed to resolve entry for package @geostat/engine". Suites that only use relative imports still pass, masking the config defect as if it were per-file.

**Why:** Discovered 2026-06-17 — 13 engine/react suites failed at collection with this error while the per-package `engine/react/vitest.config.ts` alias was correct. Root cause was the ignored workspace file, not the alias.

**How to apply:** The fix is a root `platform/vitest.config.ts` with `test.projects: ['engine/core', 'engine/charts', ...]` (one entry per package, each package keeps its own vitest.config.ts + resolve.alias). Delete `vitest.workspace.ts`. If you see "Failed to resolve entry for package" across many suites at once, suspect the project-config layer (is a root config present and loading?), not the individual aliases. Related: [[barrel-export-gaps]], [[cachedstore-encapsulation]].
