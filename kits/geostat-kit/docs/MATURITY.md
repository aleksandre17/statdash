# Package maturity checklist (100% target)

Use this list before tagging a release or declaring geostat-kit **required** for new repos.

## 1. Package boundary

| Check | How |
|-------|-----|
| No consumer brands in runtime | `pytest tests/test_toolkit_hardcodes.py` |
| No hardcoded `ops/config/frontend\|backend` in drivers/toolkit | same |
| No hardcoded `google-credentials.json` in `toolkit/deploy/` | same |
| Root = `geostat.ops.json` | `ProjectContext.discover()` |

## 2. Manifest contract

| Check | How |
|-------|-----|
| Schema valid | `geostat validate` |
| Every module has `role`, `type`, `path`, `secretsModule` | validate |
| Driver types in `drivers/registry.json` | validate |
| `geostat migrate --apply` for legacy trees | one-time |

## 3. Credentials (multi-file / multi-module)

| Check | How |
|-------|-----|
| Per-module list | `modules.<id>.credentials[]` |
| Global GCP fallback | `features.gcpCredentials` + `adapters.gcp` |
| dev-remote / upload / ci_prepare | use `lib/credentials.py` |
| Tests | `pytest tests/test_credentials.py` |

## 4. CI & integration

| Check | How |
|-------|-----|
| Project script manifest-driven | `ops/ci/integration-stack.sh` |
| Package helpers | `kits/geostat-kit/ci/*` |
| Golden fixture | `tests/fixtures/golden-consumer/` |

## 5. Release

| Check | How |
|-------|-----|
| Version file | `VERSION` (semver) |
| Changelog | `CHANGELOG.md` |
| Tests | `pytest tests/test_release.py` |
| Tag | `git tag v$(cat VERSION)` in kit repo |

## 6. Dev modes documented

| Check | How |
|-------|-----|
| Local / Docker / remote guide | [DEV-MODES.md](DEV-MODES.md) |

## 7. Local Run and Debug (VS Code / Cursor)

| Check | How |
|-------|-----|
| launch.json + tasks.json | `geostat vscode-gen` |
| Paths from `modules.*.path` | [LOCAL-DEBUG.md](LOCAL-DEBUG.md) |
| Java Extension Pack | Spring breakpoints |

## 8. Adoption

| Check | How |
|-------|-----|
| Starter guide | [STARTER.md](STARTER.md) |
| Adoption line | [ADOPTION-LINE.md](ADOPTION-LINE.md) |
| Consumer docs | `docs/CI.md`, `docs/CONFIG.md` |

## Dev modes (all variants smoke)

```powershell
.\kits\geostat-kit\scripts\dev-modes-verify.ps1
.\kits\geostat-kit\scripts\dev-modes-verify.ps1 -SkipDocker   # without Docker daemon
```

```bash
bash kits/geostat-kit/scripts/dev-modes-verify.sh --skip-integration
```

## Full verification (from consumer repo root)

```bash
cd kits/geostat-kit
PYTHONPATH=. pytest tests -q

cd ../..   # project root
python3 kits/geostat-kit/lib/validate_manifest.py
bash kits/geostat-kit/ci/prepare-integration-env.sh
# optional if Docker available:
bash ops/ci/integration-stack.sh
```

PowerShell:

```powershell
.\tools\geostat.ps1 validate
cd kits\geostat-kit; $env:PYTHONPATH='.'; python -m pytest tests -q
```

## Score

When every row above passes, the package is **production-ready** for multi-module SaaS consumers with optional multi-credential profiles.
