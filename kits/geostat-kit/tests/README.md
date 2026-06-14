# geostat-kit package tests

Runs **without SSH, rsync, or Docker**. Validates contracts before you adopt the package.

## Run locally

From repo root:

```bash
pip install pytest
python3 -m pytest kits/geostat-kit/tests -v
```

Or:

```bash
bash kits/geostat-kit/tests/run-kit-tests.sh
```

## What is covered

| Suite | Covers |
|-------|--------|
| **`test_layout_v2.py`** | **Post-migration layout** — manifest paths, `apps/`/`kits/`/`ops/`, no legacy dirs, Spring/Vite/compose wiring |
| `test_deploy_paths.py` | structured / flat / full paths (B1, D1, C1, …) |
| `test_golden_path_matrix.py` | static vs compose/dev vs compose/prod separation |
| `test_driver_api.py` | registry, `fe` alias, stack-deploy, no top-level `watch` |
| `test_frontend_contracts.py` | Dockerfile EXPOSE 80, compose `HOST:80`, deploy/dev scripts |
| `test_registry_integrity.py` | every registry command file exists |

## Not covered (manual / integration)

- Real `rsync` / `ssh` from Windows
- Live `fe dev bootstrap` on a server
- PowerShell runtime of full deploy.ps1 (use `layout` simulation on Windows)

CI job: `ops-package-tests` in `.github/workflows/ci.yml`.

## Last results

**[TEST-RESULTS.md](./TEST-RESULTS.md)** — summary (41/41 passed). Raw log: [LAST-RUN.txt](./LAST-RUN.txt).
