# Backend JAR & Dockerfile flows

Which Dockerfile and path apply to each command (Windows → Linux or local).

Golden paths: [GOLDEN-PATHS-BACKEND.md](./GOLDEN-PATHS-BACKEND.md).  
Layout (flat vs structured): [../../../docs/BACKEND-DEPLOY-LAYOUTS.md](../../../docs/BACKEND-DEPLOY-LAYOUTS.md).

---

## Layout: სად რომელი Dockerfile

| `DEPLOY_LAYOUT` | JAR deploy path | Source dev path |
|-----------------|-----------------|-----------------|
| **structured** | `{DEPLOY_PATH}/runtime/{container}/` | `{DEPLOY_PATH}/workspace/{container}/` |
| **flat** (legacy) | `{DEPLOY_PATH}/{container}/` | `be dev` არაა (საჭიროა structured) |

---

## Dockerfiles (API)
| File | Used by | Where it runs |
|------|---------|---------------|
| `backend/src/Dockerfile` | **`be deploy`** | Server `runtime/{container}/` — copies pre-built `app.jar` |
| `backend/src/Dockerfile.dev` | **`be compose up`** (local) | Laptop — multi-stage build inside image |
| `backend/src/Dockerfile.dev.remote` | **`be dev bootstrap`** | Server `workspace/{container}/` — Gradle image + volume `.:/app` + `bootRun` |

Worker: `worker/Dockerfile`, `worker/Dockerfile.dev`, `worker/Dockerfile.dev.remote` — same pattern.

---

## `src/Dockerfile` — prod / runtime (JAR deploy)

```dockerfile
FROM eclipse-temurin:21-jre-jammy
COPY app.jar app.jar
...
```

| Step | Where |
|------|--------|
| 1. `./gradlew bootJar` | **Windows** (or CI) |
| 2. Copy jar → `backend/app.jar` (module dir) | Local `deploy_step_prepare_jars` |
| 3. scp `app.jar` + `Dockerfile` + `.env.*` | → `{DEPLOY_PATH}/runtime/{container}/` |
| 4. `docker compose up --build -d` | Server — image rebuild picks up new `app.jar` |

**`be deploy watch`** repeats steps 1–4 on debounced saves (no full `check.sh` / compose regen).

---

## `Dockerfile.dev.remote` — workspace (source dev)

| Step | Where |
|------|--------|
| 1. rsync `apps/backend/` (no `.gradle/`, `build/`) | → `workspace/{container}/` |
| 2. `docker-compose.workspace.yml` | Generated on server — `command: ./gradlew bootRun` |
| 3. Volume `.:/app` | Container compiles on Linux |

**`be dev watch`** — rsync only; Spring DevTools reloads bootRun (`--restart` for Dockerfile/Gradle changes).

---

## Path separation

```text
{DEPLOY_PATH}/
  runtime/{COMPOSE_API_SERVICE}/     # be deploy, be deploy watch
  workspace/{COMPOSE_API_SERVICE}/   # be dev bootstrap, be dev watch
```

Do not mix without migration.

---

## Comparison to frontend

| Frontend | Backend |
|----------|---------|
| `fe deploy watch` → npm build → `static/` | `be deploy watch` → bootJar → `runtime/` |
| `fe dev watch` → rsync → `compose/dev/` | `be dev watch` → rsync → `workspace/` |

See [REMOTE-DEV-DOCKERFILE-FLOW.md](./REMOTE-DEV-DOCKERFILE-FLOW.md) (SPA) and [../../../docs/BE-DEPLOY-WATCH.md](../../../docs/BE-DEPLOY-WATCH.md).
