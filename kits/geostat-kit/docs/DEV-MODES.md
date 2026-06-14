[]()# დეველოპმენტის რეჟიმები — რომელი ვარიანტი როდის

ეს არის **მთავარი გზამკვლევი**: ლოკალური (Docker-ის გარეშე), ლოკალური Docker, remote სერვერი + Docker.  
Run and Debug (`launch.json`) — იხ. [LOCAL-DEBUG.md](LOCAL-DEBUG.md). Golden paths — [GOLDEN-PATHS.md](GOLDEN-PATHS.md).

---

##  ცხრილი

| რეჟიმი | სად მუშაობს | Docker | VS Code Run and Debug |
|--------|-------------|--------|------------------------|
| **① ლოკალური, host** | შენი Windows/Mac — Node/Java პირდაპირ | **არა** | **კი** — `npm run dev`, `Spring Boot`, `Full stack (local)` |
| **② ლოკალური Docker** | იგივე მანქანა, `localhost` | **კი** | Task / launch: `geostat stack`, `fe/be compose up` |
| **③ Remote + Docker** | Linux სერვერი (SSH) | **კი** (სერვერზე) | Tasks: `geostat: <alias> dev watch (remote)` — `geostat dev up <alias> --mode remote` |
| **④ Hybrid** | Apps host-ზე, infra remote + tunnel | **კი** (remote) | **კი** — `Hybrid: infra tunnel + API + UI`, `geostat hybrid boot` |

---

## ① ლოკალური — Docker-ის გარეშე (ყველაფერი host-ზე)

ჩვეულებრივი დეველოპმენტი **შენს კომპიუტერზე**, პირდაპირ Node და Java-თი.

### Run and Debug (Cursor / VS Code)

| კონფიგურაცია | რა ხდება |
|---------------|----------|
| **frontend: npm run dev** | Vite — `modules.<ui>.path` (მაგ. `apps/frontend`), პორტი ~5173 |
| **backend: Spring Boot** | Gradle/Java ლოკალურად, breakpoints |
| **Full stack (local)** | UI + API ერთად (compound) |

### ტერმინალი (იგივე რეჟიმი)

```powershell
cd apps/frontend; npm run dev
cd apps/backend; .\gradlew bootRun
```

**Docker არ გჭირდება.** API შეიძლება იყოს ლოკალური ან remote URL — `ops/config/<ui>/env.dev` (`VITE_API_URL`).

---

## ② ლოკალური — Docker-ით (compose შენს მანქანაზე)

კონტეინერები **`localhost`**-ზე; remote SSH არაა.

### Run and Debug / Tasks

| სახელი | რა ხდება |
|--------|----------|
| **geostat: stack (compose dev)** | მთელი stack — `geostat stack up -d --build` |
| Task: **geostat: fe compose up** | მხოლოდ UI კონტეინერი |
| Task: **geostat: be compose up** | მხოლოდ API კონტეინერი |

### ტერმინალი

```powershell
.\tools\geostat.ps1 fe compose up -d --build
.\tools\geostat.ps1 be compose up -d --build
.\tools\geostat.ps1 stack up -d --build
```

**Docker კი, remote არა.**

---

## ③ Remote სერვერი + Docker (Linux / SSH)

კოდი იწერება **ლოკალურად** (Windows), გაშვება **სერვერზე** Docker compose-ით.  
Run and Debug launch-ში ეს mode **არ ჩანს** — VS Code Tasks (`geostat: <alias> dev watch (remote)`) ან CLI.

### სწრაფი გაშვება — ერთი ბრძანება

```powershell
geostat dev up be --mode remote    # chat-api: rsync → server, bootRun container
geostat dev up fe --mode remote    # frontend: rsync → server, Vite container
geostat dev up all --mode remote   # ყველა მოდული: თითო ახალ terminal window-ში
```

`dev up --mode remote` ავტომატურად ირჩევს `dev watch` (java-boot) ან `dev watch` (node-vite) driver-ს.

### VS Code Tasks (Terminal → Run Task)

| Task | რა ხდება |
|------|----------|
| `geostat: be dev watch (remote)` | rsync + Gradle bootRun server workspace |
| `geostat: fe dev watch (remote)` | rsync + Vite dev container |
| `geostat: ret dev watch (remote)` | rsync + retrieval-service bootRun |
| `geostat: ing dev watch (remote)` | rsync + ingestion-service bootRun |
| `geostat: be deploy watch (remote)` | JAR build → `runtime/` publish loop |
| `geostat: fe deploy watch (remote)` | Vite build → `static/` + nginx reload |

### ხელით CLI (bootstrap საჭიროა პირველ გაშვებაზე)

#### Frontend (Vite კონტეინერში)

| მიზანი | ბრძანება | სერვერზე |
|--------|----------|----------|
| Remote dev | `geostat fe dev bootstrap` → **`geostat fe dev watch`** | `{DEPLOY_PATH}/compose/dev/{container}/` + Docker |
| Prod-like static | `geostat fe deploy dist` → **`geostat fe deploy watch`** | `static/` + nginx |

#### Backend modules (Gradle bootRun კონტეინერში)

| მოდული | Dev watch | Deploy watch |
|--------|-----------|--------------|
| `be` (chat-api) | `geostat be watch` | `geostat be deploy watch` |
| `ret` (retrieval) | `geostat ret watch` | `geostat ret deploy watch` |
| `ing` (ingestion) | `geostat ing watch` | `geostat ing deploy watch` |

#### Full stack prod (remote)

```powershell
.\tools\geostat.ps1 stack-deploy --prod
```

### პირობები

- `ops/config/deploy.env` — `DEPLOY_SERVER`, `DEPLOY_LAYOUT=structured`
- SSH: `ops/config/ssh/`

დეტალი: [REMOTE-DEV-DOCKERFILE-FLOW.md](REMOTE-DEV-DOCKERFILE-FLOW.md), [GOLDEN-PATHS.md](GOLDEN-PATHS.md), consumer `docs/DEV-REMOTE.md`, `docs/FE-WATCH.md`.

---

## ④ Hybrid — apps ლოკალურად (Windows), infra remote Linux

**Apps** — `gradlew bootRun` / `npm run dev` შენს მანქანაზე; **Postgres / Redis / Qdrant / RabbitMQ** — მხოლოდ Linux სერვერზე Docker-ით; კავშირი **SSH tunnel** → `localhost`.

| ნაბიჯი | ბრძანება |
|--------|----------|
| 1. Infra remote | `geostat infra remote up` |
| 2. Tunnel | `geostat infra tunnel` (ან VS Code compound preLaunch) |
| 3. Apps | `geostat hybrid boot <alias>` ან `geostat <alias> run` |
| 4. F5 compound | Run and Debug → **Hybrid: infra tunnel + API + UI** |

**Env:** `ops/config/<module>/.env.dev` — `INFRA_HOST=127.0.0.1`, peer URLs (`RETRIEVAL_BASE_URL`, …). Spring profile — manifest `modules.*.hybrid.springProfiles`.

**არ აურიო:** legacy `apps/backend/worker` — worker = `ingestion-service`.

სრული არქიტექტურა: consumer [HYBRID-DEV-ARCHITECTURE.md](../../../docs/plan/HYBRID-DEV-ARCHITECTURE.md).

---

## სქემა

```text
                    ┌─────────────────────────────────────┐
                    │  შენი ლეპტოპი (Windows / Mac)        │
                    └─────────────────────────────────────┘
         │                              │
         │ ① ლოკალური, NO Docker         │ ② ლოკალური Docker
         │    Run and Debug:            │    stack / fe|be compose
         │    npm + Java                │    localhost
         │    Full stack (local)        │
         │                              │
         └──────────────┬───────────────┘
                        │ SSH + rsync
                        ▼
                    ┌─────────────────────────────────────┐
                    │  Linux სერვერი                        │
                    │  ③ geostat fe|be dev watch            │
                    │     Docker on server                  │
                    └─────────────────────────────────────┘
```

---

## რას აირჩიო (სწრაფი)

| მინდა… | აირჩიე |
|--------|--------|
| F5, breakpoints, UI+API სწრაფად ლოკალურად | **Full stack (local)** — launch compound |
| მხოლოდ UI ლოკალურად | **frontend: npm run dev** — launch config |
| ყველაფერი Docker-ში ლაპტოპზე | task **geostat: stack dev** ან `geostat stack up -d --build` |
| Apps local, infra remote (✓ breakpoints) | task **geostat: dev up be** / `geostat dev up be` |
| ყველა მოდული ერთდროულად (hybrid) | `geostat dev up all` — ახალ windows-ებში |
| Windows სოუსი → Linux+Docker live reload | task **geostat: be dev watch (remote)** / `geostat dev up be --mode remote` |
| ყველა მოდული remote watch | `geostat dev up all --mode remote` |
| Prod UI სერვერზე | task **geostat: fe deploy watch (remote)** / `geostat fe deploy watch` |
| Prod API სერვერზე | `geostat be deploy all` |
| Full production deploy | `geostat stack-deploy --prod` |

---

## `deploy watch` vs `dev watch` (remote — Mode ③)

| ბრძანება | რას აკეთებს | path სერვერზე | VS Code Task |
|----------|-------------|----------------|--------------|
| **`fe dev watch`** | rsync სორსი, Vite კონტეინერში | `.../compose/dev/{service}/` | `fe dev watch (remote)` |
| **`fe deploy watch`** | build static → nginx reload loop | `.../static/{service}/` | `fe deploy watch (remote)` |
| **`be watch`** | rsync + Gradle bootRun კონტეინერში | workspace | `be dev watch (remote)` |
| **`ret watch`** | rsync + retrieval-service bootRun | workspace | `ret dev watch (remote)` |
| **`ing watch`** | rsync + ingestion-service bootRun | workspace | `ing dev watch (remote)` |
| **`be deploy watch`** | JAR → `runtime/` publish loop | runtime/ | `be deploy watch (remote)` |

**წესი:** `dev watch` = სორსი live + compose dev; `deploy watch` = artifact build loop.

---

## ტესტირება (ყველა რეჟიმი — smoke)

ავტომატური შემოწმება (არ იწყებს ხანგრძლივ სერვისებს mode ①-ში):

```powershell
.\kits\geostat-kit\scripts\dev-modes-verify.ps1
```

```bash
bash kits/geostat-kit/scripts/dev-modes-verify.sh
# სრული Docker integration (თუ daemon ჩართულია):
bash kits/geostat-kit/scripts/dev-modes-verify.sh
# მხოლოდ პაკეტი + config, Docker-ის გარეშე:
bash kits/geostat-kit/scripts/dev-modes-verify.sh --skip-docker --skip-integration
```

რას ამოწმებს:

| რეჟიმი | ავტომატური | ხელით (E2E) |
|--------|------------|-------------|
| ① host | paths, gradlew, npm, launch.json | `npm run dev`, Java F5 |
| ② Docker | `fe/be check`, docker daemon | `stack up`, compose |
| ③ remote | `DEPLOY_LAYOUT`, module-ops-smoke | SSH + `fe/be dev watch` |

პაკეტის pytest: `tests/test_dev_modes_smoke.py`.

---

## დაკავშირებული

- [LOCAL-DEBUG.md](LOCAL-DEBUG.md) — `.vscode` გენერაცია
- [GOLDEN-PATHS.md](GOLDEN-PATHS.md) / [GOLDEN-PATHS-BACKEND.md](GOLDEN-PATHS-BACKEND.md)
- [REMOTE-DEV-DOCKERFILE-FLOW.md](REMOTE-DEV-DOCKERFILE-FLOW.md)
- Consumer: [../../docs/DEV-REMOTE.md](../../docs/DEV-REMOTE.md), [../../docs/FE-WATCH.md](../../docs/FE-WATCH.md)
