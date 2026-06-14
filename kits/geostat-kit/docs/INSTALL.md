# Install geostat-kit (for other projects)

Use this after you **cloned or submodule-added** this package. Your app code stays in **your** repo; only ops live here.

## 1. Get the package

### A. Git submodule (recommended)

```bash
cd your-project
git submodule add https://github.com/YOUR_USER/geostat-kit.git kits/geostat-kit
cd kits/geostat-kit
git checkout v1.0.0
cd ../..
git add kits/geostat-kit .gitmodules
git commit -m "chore: add geostat-kit v1.0.0"
```

### B. Copy

```bash
git clone https://github.com/YOUR_USER/geostat-kit.git /tmp/geostat-kit
cp -r /tmp/geostat-kit your-project/kits/geostat-kit
```

Pin version: use tag `v1.0.0` or commit SHA.

## 2. Project layout (v2)

```text
your-project/
├── geostat.ops.json      ← you own this
├── apps/                 ← your frontend, backend, …
├── ops/config/           ← secrets (gitignored)
├── ops/compose/
├── tools/geostat.ps1     ← thin shim (below)
└── kits/geostat-kit/     ← this package (do not edit for app logic)
```

## 3. CLI shim (`tools/geostat.ps1`)

Create in **your project root**:

```powershell
# tools/geostat.ps1
$Kit = Join-Path $PSScriptRoot "..\kits\geostat-kit"
& (Join-Path $Kit "cli\geostat.ps1") @args
```

Linux / macOS can call `kits/geostat-kit/cli/geostat.sh` from project root with `GEOSTAT_PROJECT_ROOT` set.

## 4. Manifest

```bash
cp kits/geostat-kit/scaffold/geostat.ops.json ./geostat.ops.json
```

Edit:

- `modules.<id>.path` — e.g. `apps/frontend`, `apps/backend`
- `modules.<id>.role` — `ui`, `api`, `worker`
- `modules.<id>.secretsModule` — folder under `ops/config/`
- `package` — must be `"kits/geostat-kit"`

## 5. Bootstrap

```powershell
.\tools\geostat.ps1 init
.\tools\geostat.ps1 validate
.\tools\geostat.ps1 compose-gen
.\tools\geostat.ps1 vscode-gen
```

## 6. Daily commands

```powershell
.\tools\geostat.ps1 help
.\tools\geostat.ps1 mod backend check
.\tools\geostat.ps1 mod frontend compose up -d
.\tools\geostat.ps1 stack up -d --build
```

Aliases (`fe`, `be`) come from `cli.aliases` in your manifest.

## 7. Requirements

- Windows: PowerShell 5.1+, Git Bash for some backend deploy scripts
- Python 3.10+ for `validate`, `compose-gen`
- Docker (optional) for compose / stack
- Java / Node in **your** `apps/*` (not in the kit repo)

## Next

- [ADOPTION-LINE.md](ADOPTION-LINE.md) — full pipeline
- [DEV-MODES.md](DEV-MODES.md) — local vs Docker vs remote
- [STARTER.md](STARTER.md) — short checklist
