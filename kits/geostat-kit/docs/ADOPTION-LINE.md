# geostat-kit — სრული კონფიგურაციის ხაზი

ეს არის **ერთი გზამკვლევი** პროექტისთვის, რომელიც გადმოიტანს `kits/geostat-kit` პაკეტს. ნაბიჯ-ნაბიჯ: სად რა ფაილი, რა ჩაწერო, frontend/backend, CI, ახალი driver.

**სქემა:** [manifest.schema.json](../manifest.schema.json) · **მაგალითი:** [scaffold/geostat.ops.json](../scaffold/geostat.ops.json) · **პაკეტის ჩატვირთვა:** [../../../docs/KITS-PACKAGE.md](../../../docs/KITS-PACKAGE.md)

---

## 0. რა რჩება პაკეტში vs პროექტში

| პაკეტი (`geostat-kit`) | პროექტი (შენი repo) |
|------------------------|---------------------|
| `lib/`, `toolkit/`, `drivers/`, `compose/build.py` | `geostat.ops.json` |
| `cli/geostat.ps1` | `ops/config/` (რეალური env, gitignored) |
| `contracts/`, `ci/wait-health.sh` | `ops/compose/catalog.json` |
| `scaffold/` მაგალითები | `apps/frontend/`, `apps/backend/` აპლიკაცია |
| — | `tools/geostat.ps1` (1 ხაზი delegate) |
| — | `ops/ci/` (პროექტის ინტეგრაცია) |
| — | გენერირებული `docker-compose*.yml`, `apps/backend/ops.modules` |
| `toolkit/infra/Invoke-Infra.ps1` | `ops/compose/infra/*.yml` + `ops/config/infra/.env.*` (პროექტის compose/პორტები) |

წესი: დომენური სახელი, API key, ბიზნეს-ლოგიკა → **პროექტი**. SSH/Docker/Gradle/npm ოპს ხელსაწყო → **პაკეტი**.  
`geostat infra` = **პაკეტი** (agnostic driver); consumer `services/*.yml` + manifest `stack.infra.services`; remote path `{DEPLOY_PROJECT}/infra/{INFRA_SLUG}/`. იხ. `docs/PACKAGE-PRINCIPLES.md`.

---

## 1. საბოლოო ხე (target layout)

```text
your-app/                          ← repo root (GEOSTAT_PROJECT_ROOT)
├── geostat.ops.json               ← კონტრაქტი (აუცილებელი)
├── tools/
│   ├── geostat.ps1                ← delegate → kits/geostat-kit/cli/
│   └── geostat.sh                 ← optional (Linux/Git Bash)
├── kits/
│   └── geostat-kit/               ← პაკეტი (submodule | copy) — იხ. docs/KITS-PACKAGE.md
├── ops/
│   ├── config/                    ← env + SSH (gitignored values)
│   │   ├── deploy.env
│   │   ├── frontend/  (.env.dev, .env.prod, …)
│   │   └── backend/   (.env.dev, google-credentials.json, …)
│   ├── compose/
│   │   ├── catalog.json
│   │   └── stack/                 ← GENERATED full-stack compose
│   ├── cli/                       ← geostat.ps1 (canonical)
│   └── ci/
├── apps/frontend/                 ← UI მოდული
│   ├── ops.config.ps1
│   ├── docker-compose.yml         ← GENERATED (ზოგი target)
│   ├── nginx.conf.template        ← თუ nginx-gen
│   └── src/ …
└── apps/backend/                       ← API მოდული
    ├── ops.config.sh
    ├── ops.modules                ← GENERATED (java-boot)
    ├── docker-compose.dev.yml     ← GENERATED
    └── src/ …
```

---

## 2. წინაპირობები

| ხელი | გამოყენება |
|------|------------|
| **Python 3.10+** | `compose-gen`, `driver_api.py`, nginx adapter |
| **Docker** | compose, CI integration |
| **PowerShell** | Windows CLI, `node-vite` driver |
| **Git Bash** | `java-boot` driver Windows-ზე |
| **Node + npm** | frontend build |
| **Java + Gradle** | თუ `java-boot` backend |

---

## 3. ნაბიჯი 1 — პაკეტის გადმოტანა

```powershell
# მაგალითი: copy
xcopy /E /I vendor\geostat-kit kits\geostat-kit

# ან git submodule
git submodule add <repo-url> kits/geostat-kit
```

არაფერი საიდუმლო არ ჩაიდოს პაკეტში: არა `deploy.env`, არა production keys.

---

## 3b. ნაბიჯი 2 — Project bootstrap (`geostat init`)

**რეკომენდებული** — ერთი ბრძანება: scaffold + seed env + full catalog + compose-gen + checklist:

```powershell
.\tools\geostat.ps1 init
```

```bash
./tools/geostat.sh init
```

რას აკეთებს: `tools/`, `ops/ci/`, `ops/config/*.example` → რეალური env (თუ არ არსებობს), `ops/compose/catalog.json` (full stack), `ops/compose/stack/`, `frontend|backend/ops.config*`, `geostat.ops.json`, `.gitignore` merge, `compose-gen`, optional `nginx-gen`.

სრული სია / flags: [toolkit/init/README.md](../toolkit/init/README.md) · [scaffold/README.md](../scaffold/README.md).

**არ გადაწერს** არსებულ `deploy.env`, `.env.dev`, SSH keys (გარდა `init -ForceExamples`).

ხელით scaffold-ისთვის: `kits/geostat-kit/scaffold/apply-scaffold.ps1`

---

## 4. ნაბიჯი 3 — `geostat.ops.json` (root)

ფაილი repo root-ში. `apply-scaffold` ქმნის მას [scaffold/geostat.ops.json](../scaffold/geostat.ops.json)-დან, ან დააკოპირე ხელით და შეცვალე.

### ველების ახსნა

| ველი | რა ჩაწერო |
|------|-----------|
| `version` | `1` |
| `package` | `"kits/geostat-kit"` — ფარდობითი გზა root-დან |
| `secrets` | `"secrets"` |
| `compose.catalog` | `"ops/compose/catalog.json"` |
| `compose.syncModules` | `"apps/backend/ops.modules"` — მხოლოდ `java-boot` multi-module-ისთვის |
| `stack.composeDir` | `"ops/compose/stack"` — full-stack local compose |
| `cli.aliases` | `{ "fe": "frontend", "be": "backend" }` —  ბრძანებები |
| `stackDeploy.steps` | remote full-stack deploy ნაბიჯები (იხ. §12) |
| `modules.<id>.type` | driver id: `java-boot`, `node-vite`, … ([registry.json](../drivers/registry.json)) |
| `modules.<id>.path` | ფოლდერი root-თან: `backend`, `frontend` |
| `modules.<id>.secretsModule` | ჩვეულებრივ = იგივე სახელი `ops/config/<name>/` |
| `modules.<id>.target` | SSH deploy target: `backend` \| `frontend` |
| `adapters.nginx` | template/output/env paths (ოფციური) |
| `ci.integration` | `"ops/ci/integration-stack.sh"` |
| `ci.prepareEnv` | `"kits/geostat-kit/ci/prepare-integration-env.sh"` |
| `ci.waitHealth` | `"kits/geostat-kit/ci/wait-health.sh"` |

### მინიმალური მაგალითი (Java API + Vite UI)

```json
{
  "$schema": "./kits/geostat-kit/manifest.schema.json",
  "version": 1,
  "package": "kits/geostat-kit",
  "secrets": "secrets",
  "compose": {
    "catalog": "ops/compose/catalog.json",
    "syncModules": "apps/backend/ops.modules"
  },
  "stack": { "composeDir": "ops/compose/stack" },
  "cli": {
    "aliases": { "fe": "frontend", "be": "backend" }
  },
  "stackDeploy": {
    "steps": [
      { "module": "backend", "command": "deploy", "args": ["all"] },
      { "module": "frontend", "command": "deploy", "args": ["dist", "-Environment", "{environment}"] }
    ]
  },
  "modules": {
    "backend": {
      "type": "java-boot",
      "path": "backend",
      "secretsModule": "backend",
      "target": "backend"
    },
    "frontend": {
      "type": "node-vite",
      "path": "frontend",
      "secretsModule": "frontend",
      "target": "frontend"
    }
  },
  "ci": {
    "integration": "ops/ci/integration-stack.sh",
    "prepareEnv": "kits/geostat-kit/ci/prepare-integration-env.sh",
    "waitHealth": "kits/geostat-kit/ci/wait-health.sh"
  }
}
```

**მნიშვნელოვანი:** `type` არ უნდა გამოიცნოს ფოლდერის სახელიდან — ყოველთვის დაწერე `modules.<id>.type`.

---

## 5. ნაბიჯი 3 — CLI შესვლა (`tools/`)

### `tools/geostat.ps1`

```powershell
$Root = Split-Path $PSScriptRoot -Parent
& (Join-Path $Root "kits\geostat-kit\cli\geostat.ps1") -Command $Command -Args $Args
exit $LASTEXITCODE
```

(პარამეტრები: `Command`, `Args` — იხ. reference repo `tools/geostat.ps1`.)

### `tools/geostat.sh` (optional)

```bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GEOSTAT_PROJECT_ROOT="$ROOT"
exec bash "$ROOT/kits/geostat-kit/cli/geostat.sh" "$@"
```

### ბრძანებები

| ბრძანება | დანიშნულება |
|----------|-------------|
| `geostat help` | მოდულები + driver types |
| `geostat compose-gen` | catalog + manifest (`stack.composeModules`) → docker-compose ფაილები |
| `geostat stack up -d --build` | local API+UI |
| `geostat mod <moduleId> deploy …` | ნებისმიერი მოდული |
| `geostat be deploy all --prod` | alias → `modules.backend` |
| `geostat fe deploy dist -Environment prod` | alias → `modules.frontend` |
| `geostat stack-deploy --prod` | `stack.composeModules` → auto steps (or `stackDeploy.steps`) |

---

## 6. ნაბიჯი 4 — `ops/config/`

```powershell
mkdir ops\config\frontend, ops\config\backend
copy kits\geostat-kit\scaffold\ops\config\deploy.env.example ops\config\deploy.env
copy ops\config\.env.example ops\config\frontend\.env.example   # თუ გაქვს root contract
# თითო მოდულის .env.example → .env.dev / .env.prod (ლოკალურად)
```

### სავალდებულო ფაილები (ლოკალურად)

| ფაილი | შიგთაღი (მაგალითი) |
|-------|---------------------|
| `ops/config/deploy.env` | `DEPLOY_SERVER=user@host`, `DEPLOY_PROJECT=myapp`, `DOCKER_NETWORK=myapp-net` |
| `ops/config/frontend/.env.dev` | `VITE_API_URL=http://localhost:8090` |
| `ops/config/frontend/.env.deploy` | `DEPLOY_HOST_PORT=5177`, `DEPLOY_PATH=/home/user/.../frontend` |
| `ops/config/backend/.env.dev` | `API_PORT=8090`, API keys |
| `ops/config/backend/.env.prod` | prod keys, `API_INTERNAL_URL` worker-ისთვის |

`.gitignore`-ში: `ops/config/**` გარდა `*.example`.

Legacy სერვერი: [scaffold/profiles/legacy-server.env.example](../scaffold/profiles/legacy-server.env.example) → შეურთე `deploy.env`-ში, შემდეგ `compose-gen`.

---

## 7. ნაბიჯი 5 — `ops/compose/catalog.json`

პროექტის **ერთადერთი წყარო** იმისთვის, სად რა service გენერირდება.

1. დაიწყე [catalog.minimal.json](../scaffold/ops/compose/catalog.minimal.json)-ით.
2. დაამატე `templates` (YAML ფრაგმენტები) და `targets` (რომელი ფაილი რა service-ებს იღებს).
3. `features.worker: true|false` — embedded `apps/backend/worker` on/off (not manifest `ingestion`; use **false** when worker role is a separate module).
4. `deploy.env`: `COMPOSE_PROJECT_NAME`, `DOCKER_NETWORK`; სერვისის სახელები — manifest + `compose_identity` (`compose-gen`). `COMPOSE_*_SERVICE` მხოლოდ legacy პროფილში.

**არ შეცვალო ხელით** ფაილებს, რომლებც იწყება `# GENERATED` — მხოლოდ `compose-gen`.

```powershell
.\tools\geostat.ps1 compose-gen
```

გენერირდება ჩვეულებრივ: `apps/backend/docker-compose.*.yml`, `apps/frontend/docker-compose*.yml`, `ops/compose/stack/*.yml`, `apps/backend/ops.modules`.

---

## 8. ნაბიჯი 6 — Frontend (რა უნდა იყოს)

**Golden paths / Linux / watch:** **[GOLDEN-PATHS.md](./GOLDEN-PATHS.md)** · **`src/Dockerfile` + Windows→Linux:** **[REMOTE-DEV-DOCKERFILE-FLOW.md](./REMOTE-DEV-DOCKERFILE-FLOW.md)**.

Driver: **`node-vite`** (`modules.frontend.type`).

### ფაილები მოდულის root-ში (`apps/frontend/`)

| ფაილი | დანიშნულება |
|-------|-------------|
| `ops.config.ps1` | [ops.config.ps1.example](../toolkit/templates/ops.config.ps1.example) — `OpsSecretsModule` |
| `docker-compose.yml` | ბაზა (შეიძლება GENERATED) |
| `docker-compose.override.yml` | dev overlay |
| `docker-compose.prod.yml` | prod overlay |
| `src/Dockerfile` | dev + production targets |
| `package.json` | `npm run build` → `dist/` |
| `nginx.conf.template` | თუ `adapters.nginx` manifest-ში |
| `logs/` | ops ლოგები (ცარიელი + `.gitignore`) |

### `ops.config.ps1` (მინიმუმ)

```powershell
$OpsSecretsModule = "frontend"
$OpsComposeFile     = "docker-compose.yml"
```

### ოპერაციები

```powershell
.\tools\geostat.ps1 fe compose up -d
.\tools\geostat.ps1 fe deploy dist -Environment prod
.\tools\geostat.ps1 fe dev bootstrap -Environment dev   # source -> Linux compose/dev (Vite/Angular)
.\tools\geostat.ps1 fe dev watch                        # rsync on save, no npm build
# static prod loop: fe deploy sync / fe deploy watch  (see GOLDEN-PATHS.md, repo docs/FE-WATCH.md)
# Linux-ზე პირდაპირ dev: npm run dev ან fe compose up — არა fe dev watch (იხილე GOLDEN-PATHS.md §4)
.\tools\geostat.ps1 fe manage status
.\tools\geostat.ps1 fe check
```

### CI-ში

- `npm ci` + `npm run build` (`apps/frontend/`)
- `VITE_API_URL` env CI-სთვის

Frontend **არ** უნდა შეიცავდეს deploy ლოგიკის ასლს — მხოლოდ აპი + Dockerfile; ყველაფერი `drivers/node-vite/`.

---

## 9. ნაბიჯი 7 — Backend (რა უნდა იყოს)

Driver: **`java-boot`** (Spring/Gradle) ან მომავალში სხვა `type`.

### ფაილები (`apps/backend/`)

| ფაილი | დანიშნულება |
|-------|-------------|
| `ops.config.sh` | [ops.config.sh.example](../toolkit/templates/ops.config.sh.example) |
| `ops.modules` | GENERATED — Gradle subproject registry |
| `docker-compose.dev.yml` | GENERATED |
| `docker-compose.prod.yml` | GENERATED |
| `gradlew`, `settings.gradle` | multi-module |
| `src/Dockerfile`, `src/Dockerfile.dev` | API image |
| `worker/` | ოფციური worker მოდული |
| `logs/` | deploy/manage logs |

### `ops.config.sh` (მინიმუმ)

```bash
OPS_SECRETS_MODULE="backend"
OPS_TARGET_DEFAULT="backend"
VERSIONS_KEEP=5
HEALTH_RETRIES=24
```

### `ops.modules` (პროექტის registry, sync compose-gen-ით)

```
your-app-api=your-app:api
your-app-worker=your-app:worker
```

### ოპერაციები

```powershell
.\tools\geostat.ps1 be compose up --build
.\tools\geostat.ps1 be deploy your-app-api --prod
.\tools\geostat.ps1 be deploy all --prod
.\tools\geostat.ps1 be manage api status --prod
.\tools\geostat.ps1 be modules
.\tools\geostat.ps1 be check
```

### CI-ში

- `./gradlew build` (`apps/backend/`)
- integration: docker compose dev + health (იხ. §10)

---

## 10. ნაბიჯი 8 — CI სრული ხაზი

### 10.1 `.github/workflows/ci.yml` (რეკომენდებული jobs)

| Job | რა ამოწმებს |
|-----|-------------|
| `compose-catalog` | `python3 kits/geostat-kit/compose/build.py` + `git diff` GENERATED yaml |
| `ops-scripts` | Python compile, `shellcheck` drivers/toolkit, catalog JSON valid |
| `frontend-build` | `npm ci && npm run build` |
| `backend-build` | `./gradlew build` |
| `integration-compose` | `prepare-integration-env.sh` + `ops/ci/integration-stack.sh` |

### 10.2 პროექტის `ops/ci/integration-stack.sh`

შაბლონი (დააკოპირე და შეცვალე health URL/port):

```bash
#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="$ROOT/kits/geostat-kit"
BE="$ROOT/backend"
export GEOSTAT_PROJECT_ROOT="$ROOT"

bash "$PKG/ci/prepare-integration-env.sh"
python3 "$PKG/compose/build.py"

cd "$BE"
ENV_ARGS=(--env-file "$ROOT/ops/config/backend/.env.dev")
[[ -f "$ROOT/ops/config/deploy.env" ]] && ENV_ARGS+=(--env-file "$ROOT/ops/config/deploy.env")

docker compose "${ENV_ARGS[@]}" -f docker-compose.dev.yml up -d --build
bash "$PKG/ci/wait-health.sh" "http://127.0.0.1:${API_PORT:-8090}/health" "UP" 120
docker compose "${ENV_ARGS[@]}" -f docker-compose.dev.yml down -v
```

`geostat.ops.json` → `ci.*` ბილიკები უნდა ემთხვეოდეს.

### 10.3 PR-ის წინ (ლოკალურად)

```powershell
.\tools\geostat.ps1 compose-gen
git diff --exit-code **/docker-compose*.yml
.\tools\geostat.ps1 be check
.\tools\geostat.ps1 fe check
# თუ Docker ჩართულია:
bash ops/ci/integration-stack.sh
```

---

## 11. ნაბიჯი 9 — შემოწმების checklist

- [ ] `geostat.ops.json` root-ში, `$schema` მითითებული
- [ ] `tools/geostat.ps1` მუშაობს: `.\tools\geostat.ps1 help`
- [ ] `ops/config/deploy.env` არსებობს ლოკალურად (არა commit)
- [ ] `ops/compose/catalog.json` valid JSON
- [ ] `compose-gen` გაშვებული, GENERATED ფაილები commit-ში
- [ ] `frontend/ops.config.ps1`, `backend/ops.config.sh`
- [ ] `.\tools\geostat.ps1 stack up -d --build` — UI + API ლოკალურად
- [ ] CI workflow დამატებული

---

## 12. Remote deploy (production)

1. სერვერზე ერთხელ: `.\tools\geostat.ps1 infra`
2. Full stack: `.\tools\geostat.ps1 stack-deploy --prod`  
   → იკითხავს `stackDeploy.steps` manifest-იდან.
3. ცალკე: `geostat be deploy …`, `geostat fe deploy dist …`

`stackDeploy` placeholder-ები: `{environment}` → `dev` | `prod`; deploy ნაბიჯებზე ავტომატურად ემატება `--dev` / `--prod`.

---

## 13. ახალი backend driver (სხვა ენა / stack)

მაგალითები: Node API (`node-api`), Go, Python FastAPI — **ცალკე driver type**, არა `java-boot`-ის ჩანაცვლა ფოლდერის სახელით.

### 13.1 არქიტექტურა

```
drivers/
  registry.json       ← დაამატე ახალი type
  java-boot/          ← JVM (არსებული)
  node-vite/          ← UI (არსებული)
  node-api/           ← შენი ახალი API (მაგალითი)
  _template/          ← კოპირების შაბლონი
```

### 13.2 ნაბიჯები

**1.** კოპირება:

```text
drivers/_template/  →  drivers/go-api/   (სახელი = registry key)
```

**2.** იმპლემენტაცია:

| ფაილი | რა უნდა გააკეთოს |
|-------|------------------|
| `_init.sh` ან `_init.ps1` | `GEOSTAT_MODULE_ID`, `ops.config`, toolkit `_common` |
| `deploy.*` | build artifact → SSH → server compose |
| `manage.*` | stop/start/logs/status |
| `compose.*` | local `docker compose` + env files |
| `check.*` | prereqs, build smoke |

გამოიყენე `kits/geostat-kit/toolkit/` — არ გადააწერო SSH/env ლოგიკა driver-ში თავიდან.

**3.** `drivers/registry.json`:

```json
"go-api": {
  "label": "Go — static binary / container",
  "roles": ["api"],
  "runtime": "bash",
  "commands": {
    "deploy": "sh/deploy.sh",
    "manage": "sh/manage.sh",
    "compose": "sh/compose.sh",
    "check": "sh/check.sh"
  }
}
```

`runtime`: `bash` | `powershell` — როგორც გაუშვებ driver სკრიპტებს.

**4.** `geostat.ops.json`:

```json
"modules": {
  "backend": {
    "type": "go-api",
    "path": "backend",
    "secretsModule": "backend",
    "target": "backend"
  }
}
```

**5.** `ops/compose/catalog.json` — შენი სერვისის Dockerfile/ports (პროექტი).

**6.** `stackDeploy.steps` — თუ remote deploy განსხვავებულია:

```json
{ "module": "backend", "command": "deploy", "args": ["all"] }
```

**7.** შემოწმება:

```powershell
.\tools\geostat.ps1 help
.\tools\geostat.ps1 mod backend check
.\tools\geostat.ps1 mod backend deploy api --prod
```

### 13.3 რამდენიმე API ერთ პროექტში

```json
"modules": {
  "legacy-api": { "type": "java-boot", "path": "backend", "secretsModule": "backend" },
  "gateway":    { "type": "node-api", "path": "gateway", "secretsModule": "gateway" }
}
```

```powershell
.\tools\geostat.ps1 mod legacy-api deploy all --prod
.\tools\geostat.ps1 mod gateway deploy --prod
```

### 13.4 Node backend vs Vite frontend

| | `node-vite` | `node-api` (ახალი) |
|---|-------------|---------------------|
| როლი | UI, `dist`, nginx | HTTP API, process/container |
| Deploy | static files | npm build / image |
| არ უნდა აერიოს | ერთ driver-ში | ცალკე folder + registry |

გზამკვლევი placeholder: [drivers/node-api/README.md](../drivers/node-api/README.md).

---

## 14. ახალი frontend driver

იგივე ნაბიჯები, მაგ. `node-next` (Next.js):

- `roles: ["ui"]`
- `commands`: deploy, manage, compose, check (საჭიროებისამებრ)
- `modules.frontend.type = "node-next"`

---

## 15. ხშირი შეცდომები

| პრობლემა | გამოსავალი |
|----------|------------|
| `Unknown driver type` | დაამატე `registry.json` + `drivers/<type>/` |
| `modules.*.type is required` | manifest-ში დაწერე `type` |
| `compose-gen` ვერ მუშაობს | დააყენე Python; გაუშვი repo root-დან |
| GENERATED drift CI-ში | `geostat compose-gen` + commit |
| `Git Bash required` | დააყენე Git for Windows (`java-boot`) |
| Backend deploy ცარიელი modules | შეამოწმე `ops.modules` + `compose.syncModules` |

---

## 16. სქოლიო ბმულები

| თემა | ფაილი |
|------|--------|
| Driver types | [drivers/README.md](../drivers/README.md) |
| Package vs project | [PACKAGE.md](PACKAGE.md) |
| Manage ბრძანებები | [../contracts/MANAGE-CONTRACT.md](../contracts/MANAGE-CONTRACT.md) |
| ADR drivers | [../../../docs/adr/007-module-drivers.md](../../../docs/adr/007-module-drivers.md) |

---

**ვერსია პაკეტი:** [VERSION](../VERSION) ·  ADOPT: [ADOPT.md](ADOPT.md) → ეს ფაილი არის სრული ხაზი.
