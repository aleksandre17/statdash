# geostat-kit

**v1.0.0** — Manifest-driven **operations package** for SaaS monorepos.

Compose generation, SSH deploy, env contract, multi-module CLI — **no** application code, **no** production secrets in this repo.

| | |
|---|---|
| **Install** | [docs/INSTALL.md](docs/INSTALL.md) |
| **What it is** | [docs/ADOPTION.md](docs/ADOPTION.md) |
| **Full setup** | [docs/ADOPTION-LINE.md](docs/ADOPTION-LINE.md) |

## Install (others download your package)

```bash
# Recommended: git submodule
git submodule add https://github.com/YOUR_USER/geostat-kit.git kits/geostat-kit
cd kits/geostat-kit && git checkout v1.0.0
```

Or clone / copy this repo into your project as `kits/geostat-kit/`.

In your **project root** (not inside the kit):

```json
// geostat.ops.json
{
  "version": 2,
  "package": "kits/geostat-kit",
  "secrets": "ops/config",
  ...
}
```

```powershell
# From your project root — add tools/geostat.ps1 shim (see docs/INSTALL.md)
.\tools\geostat.ps1 init
.\tools\geostat.ps1 validate
```

Details: **[docs/INSTALL.md](docs/INSTALL.md)**

## Features (1.0.0)

- `geostat.ops.json` — modules, roles (`ui`, `api`, `worker`), paths, CI, adapters
- Drivers: `java-boot` (Spring/Gradle), `node-vite` (Vite)
- `geostat validate` · `migrate` · `vscode-gen` · `stack` · remote deploy / `dev watch`
- N-module CLI: `geostat mod <moduleId> …`
- See [CHANGELOG.md](CHANGELOG.md)

## Layout

```text
geostat-kit/          ← this repository (standalone package)
├── lib/              # manifest resolution API
├── drivers/          # stack-type plugins
├── toolkit/          # deploy, stack, init
├── compose/          # catalog → docker-compose generator
├── cli/              # geostat entry
├── scaffold/         # templates for new projects
├── ci/               # generic CI helpers
├── scripts/          # verify / smoke
├── tests/
└── docs/
```

## Tests (package maintainers)

```powershell
cd geostat-kit
$env:PYTHONPATH = (Get-Location).Path
python -m pytest tests -q
```

```powershell
.\scripts\dev-modes-verify.ps1 -SkipDocker
```

## Version

[VERSION](VERSION) — current: **1.0.0**  
Release tag: **`v1.0.0`**

## License

Add your license file when you distribute the package (MIT, Apache-2.0, or proprietary). This repo may ship without `LICENSE` until you add one.
