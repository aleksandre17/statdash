---
name: project-toolchain-facts
description: Non-obvious build/toolchain facts — pnpm workspace root, build:engine ordering, no node pin
metadata:
  type: project
---

- **pnpm workspace root is `platform/`** (platform/pnpm-workspace.yaml), NOT the repo root.
  All pnpm commands run from `platform/`. Packages: `engine/*` (publishable libs) + `apps/*`
  (private deployables). pnpm pinned to 9.15.0 (platform/package.json packageManager).
- **`pnpm build:engine` must run BEFORE any api command** (typecheck/test/seed/start). apps/api
  depends on `@geostat/engine` (workspace:*); api typecheck and the `migratePageConfig` import in
  bootstrap-parity break without the engine dist. Known board requirement.
- **No node version pin** — repo has no .nvmrc or package.json engines; `@types/node` is ^24.
  Node 22 LTS is a safe CI default; bump if a step needs 24.
- apps/api start: `dev` is `tsx watch src/index.ts` (watch mode). For one-shot (CI/scripts) use
  `tsx src/index.ts` directly to avoid watch holding/​re-triggering.

**How to apply:** Any CI/script that touches api must set working-directory to platform, run
build:engine first, and prefer one-shot tsx over `dev`. See [[project-ci-db-gating]].
