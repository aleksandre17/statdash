---
name: project-workspace-root
description: The pnpm workspace root is platform/, not the git repo root — affects Docker build context and compose paths
metadata:
  type: project
---

The pnpm workspace root is `platform/`. `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the catalog, and the root `package.json` all live under `platform/` — NOT at the git repo root (`national-accounts/`).

**Why:** The repo splits app/engine code (`platform/`) from ops/infra (`ops/`). pnpm only governs `platform/`. The `engine/*` and `apps/*` workspace globs are relative to `platform/`.

**How to apply:** When writing a Dockerfile or compose service for any `platform/apps/*` package, the Docker build `context` must be `platform/` (e.g. compose `context: ../../platform`), and COPY paths inside the Dockerfile are relative to that (`apps/api/...`, `pnpm-lock.yaml` at top level). The task spec's example Dockerfile assumed a repo-root workspace and had to be corrected. See [[project-api-tsconfig-overrides]].
