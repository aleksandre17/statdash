---
name: migration-progress
description: Platform structure re-architecture (engine/→packages/ + @geostat→@statdash scope rename) — COMPLETE; surviving constraints only
metadata:
  type: project
---

Platform structure re-architecture (Strangler-Fig, ADR-012) is **COMPLETE**. This file keeps only the durable outcomes + surviving constraints; the phase-by-phase execution log lived here and is now in git history.

**Outcome (landed 2026-06-23, commit `7a47e5d`):**
- `engine/` → `platform/packages/` (filesystem move); the pure engine dir is `packages/core` (was `engine/`).
- New zero-dep innermost shared-types package `@statdash/contracts` (json / manifest / snapshot / problem / site).
- npm scope rename `@geostat/*` → `@statdash/*` across every package `name`, dependency entry, alias/tsconfig-path key, and import specifier. The rename is guarded by `platform/tests/no-geostat-scope.fitness.test.ts` — no `@geostat/*` may return to source/config.
- The dependency arrow now lives in root `CLAUDE.md` Law 3 (SSOT), enforced by `eslint no-restricted-imports`. Don't restate it from memory — read the law.

**Surviving constraints (non-obvious, still true):**
- **`apps/geostat` package `name` is `national-accounts`, NOT `@statdash/*`** — the tenant app is deliberately un-scoped; only the reusable packages + `apps/api`/`apps/panel` carry the `@statdash` scope.
- **`ops/docker-compose.yml` is a DISTINCT standalone postgres+pgadmin DB stack, NOT a duplicate of `ops/compose/docker-compose.yml`** (the app stack). Chesterton's Fence — do not "de-dup"/delete it; it's referenced by the architect's i18n-db notes.

**Resolved (do not re-flag):** the Phase-3 alias-drop blocker (`packages/plugins` used `react-dom` while declaring only a `react` peer → Rolldown `pnpm build` red on `createPortal`) is FIXED — `packages/plugins/package.json` now declares the `react-dom` peer.
