# node-api (placeholder)

Planned driver for **Node.js HTTP backends** (Express, Fastify, Nest, etc.) — separate from `node-vite` (UI build + nginx dist).

## Not registered yet

This type is **not** in `registry.json` until scripts exist. Setting `modules.*.type = "node-api"` before implementation will error with a clear message.

## When implementing

1. Copy patterns from `node-vite/ps1/` (PowerShell) and/or `java-boot/sh/` (SSH + compose on server).
2. Register in `registry.json` with `"roles": ["api"]`.
3. Set `modules.backend.type` (or a new module id) to `node-api`.
4. Update `stackDeploy.steps` in `geostat.ops.json` if remote deploy args differ from `java-boot deploy all`.

## Why a separate type

| | `node-vite` | `node-api` |
|---|-------------|------------|
| Role | UI (Vite, static dist) | API (process/container) |
| Deploy | dist + nginx | npm build, optional JAR-like artifact or image |
| Manage | nginx reload | process/docker like Java |

Same language (Node), different ops surface — one registry entry per stack, not per language.
