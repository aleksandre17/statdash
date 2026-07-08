---
name: project-toolchain-facts
description: Non-obvious build/toolchain facts — pnpm workspace root is platform/, Docker build context, build:engine ordering, no node pin
metadata:
  type: project
---

- **pnpm workspace root is `platform/`** (`platform/pnpm-workspace.yaml`), NOT the git repo root. `pnpm-lock.yaml`, the catalog, and the root `package.json` all live under `platform/`. Run all pnpm commands from `platform/`. Workspace globs: `packages/*` (publishable libs, `@statdash/*`) + `apps/*` (private deployables). pnpm pinned to 9.15.0 (`packageManager`).
- **Docker build context is `platform/`**, not the repo root. Any `platform/apps/*` Dockerfile/compose service must set `context: ../../platform`; COPY paths are relative to that (`apps/api/...`, `pnpm-lock.yaml` at top level). A repo-root-workspace assumption in a Dockerfile is wrong.
- **`pnpm build:engine` (`pnpm -r --filter "./packages/*..." run build`) must run BEFORE any api command** (typecheck/test/seed/start). `apps/api` depends on `@statdash/*` (contracts etc., `workspace:*`); api typecheck and the `migratePageConfig` import in bootstrap-parity break without the packages' dist.
- **No node version pin** — no `.nvmrc` or `engines`; `@types/node` is ^24. Node 22 LTS is a safe CI default; bump if a step needs 24.
- **api start:** `dev` is `tsx watch src/index.ts`. For one-shot (CI/scripts) use `tsx src/index.ts` directly to avoid watch holding/re-triggering.

**How to apply:** Any CI/script touching api sets working-directory to `platform`, runs `build:engine` first, prefers one-shot tsx over `dev`. Note ops/infra (`ops/`, DB migrations) is OUTSIDE `platform/` — see [[project-sql-migrations-location]], [[project-ci-db-gating]], [[project-api-tsconfig-overrides]].
