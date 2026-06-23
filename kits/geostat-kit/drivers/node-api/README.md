# node-api driver

Node HTTP services (Fastify / Express / Nest) for `geostat.ops.json` modules with
`"type": "node-api"`. Same deploy **lifecycle** as `java-boot` (build artifact → docker
image → `up -d` → health-gate → rollback on failure), but the build is **pnpm**
(workspace) and the run is `node dist/index.js` inside a multi-stage image — not gradle/JAR.

Separate from `node-vite` (UI static dist + nginx): node-api is a long-running,
health-checked process/container, so its ops surface mirrors java-boot, not node-vite.

## Commands

| Command | Purpose |
|---------|---------|
| `<api> deploy [svc] --dev\|--prod` | pnpm build verify → upload workspace context + Dockerfile → server `compose up --build` → health-gate → image rollback |
| `<api> dev bootstrap\|sync\|watch\|restart` | rsync source → `workspace/{container}/` + `pnpm dev` (tsx watch) in container |
| `run` | Local host run — `pnpm run <debug.npmScript\|dev>` (via `toolkit/hybrid/Invoke-HybridRun.ps1`) |
| `<api> manage` | stop/start/restart/logs/status/rm/rebuild on server runtime paths |
| `<api> compose` | Local `docker-compose.dev.yml` / `--prod` with secrets env files |
| `<api> check` | Pre-flight (package.json, pnpm, Dockerfile, `.env.prod` DATABASE_URL/JWT_SECRET/…) |
| `<api> modules` | List compose services for this module |

Scripts: `sh/*.sh` (Git Bash on Windows: `tools/statdash.ps1`); `ps1/run.ps1` for local run.

## Build ordering (important)

The pnpm engine packages build **before** the api: `pnpm run build:engine` then
`pnpm --filter <name> build` (filter = the module `package.json` `name`, auto-detected in
`_init.sh` as `$NODE_PKG_FILTER`; workspace root auto-detected as `$NODE_WORKSPACE_DIR`).
The production image's multi-stage Dockerfile re-runs this build server-side; the host
build is a fail-fast compile check (skipped on `--no-build`).

## Toolkit reuse

| Script | Role | Origin |
|--------|------|--------|
| `toolkit/deploy/common.sh`, `deploy-path.sh` | service discovery + `runtime/`/`workspace/` paths | shared (generic) |
| `toolkit/deploy/server-compose.sh` | per-service compose-gen on server | shared (generic) |
| `toolkit/deploy/pnpm-build.sh` | `build:engine` + `pnpm --filter build` | node-stack step |
| `toolkit/deploy/node-upload.sh` | rsync workspace context + Dockerfile + env (no JAR) | node-stack step |
| `toolkit/deploy/node-docker-up.sh` | `up --build` + health-gate + **image** rollback | node-stack step |
| `toolkit/deploy/node-dev-remote.sh` | node workspace compose + `pnpm dev` + node watch globs | overrides `dev-remote.sh` |

Where java-boot does gradle/jar, node-api does pnpm-build/image. The generic SSH, env,
compose, deploy-path, and server-compose helpers are reused unchanged.

## Manifest

```json
"modules": {
  "api": {
    "role":          "api",
    "type":          "node-api",
    "path":          "platform/apps/api",
    "secretsModule": "api",
    "debug": { "npmScript": "dev" }
  }
}
```

`cli.aliases`: `"a": "api"`. Deploy expects a Dockerfile at the module path (multi-stage,
build context = pnpm workspace root) and `.env.prod` under the secretsModule.

Tests: `kits/geostat-kit/tests/test_registry_integrity.py`, `test_driver_api.py`.
