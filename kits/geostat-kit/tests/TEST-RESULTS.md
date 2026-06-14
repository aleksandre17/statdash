# geostat-kit package tests — last run

| Field | Value |
|-------|--------|
| Date | 2026-05-21 |
| Host | Windows (`win32`) |
| Python | 3.13.x |
| **Result** | **148 passed, 17 skipped** |
| Project root | `GEOSTAT_PROJECT_ROOT` → consumer repo with `geostat.ops.json` |

## Command

```powershell
cd kits\geostat-kit
$env:PYTHONPATH = (Get-Location).Path
$env:GEOSTAT_PROJECT_ROOT = "C:\path\to\your-project"
py -3 -m pytest tests -q
```

## Golden-path scenarios verified (path logic)

| ID | Kind on server |
|----|----------------|
| B1 / B2 / B3 | `.../static/{COMPOSE_APP_SERVICE}/` |
| C1 / C2 | `.../compose/dev|prod/{service}/` |
| D1 / D2 / D3 | `.../compose/dev/{service}/` |

Tests use abstract bases (`/home/example/my-app/...`) and `COMPOSE_*` from `deploy.env` — no consumer brand names.

## Package boundary

- `test_layout_v2.py` — bans legacy `secrets/`, `packages/geostat`, `deploy/compose` in toolkit sources
- `test_scaffold_abstract_names.py` — scaffold has no branded service names
- `test_project_context.py` — manifest resolution API

## Not run in this suite

SSH, rsync, Docker, live remote deploy.
