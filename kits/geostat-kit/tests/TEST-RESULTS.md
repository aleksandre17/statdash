# geostat-kit package tests — last run

| Field | Value |
|-------|--------|
| Date | 2026-06-23 |
| Host | Windows (`win32`) |
| Python | 3.13.x |
| **Result** | **250 passed, 23 skipped** (0 failed, 0 errors) |
| Project root | **synthetic fixture** `tests/fixtures/geostat-chat-ai` (self-contained) |

## Command

```powershell
cd kits\geostat-kit
$env:PYTHONPATH = (Get-Location).Path
py -3 -m pytest tests -q
```

No `GEOSTAT_PROJECT_ROOT` is required: the suite runs against a synthetic,
self-contained reference consumer that the kit owns. `conftest.py` materialises
the two volatile bits at session start (a `kits/geostat-kit` junction back to the
real kit, and `ops/config/deploy.env` from `deploy.env.fixture`). Set
`GEOSTAT_PROJECT_ROOT` only to smoke-test the kit against a *real* consumer repo.

## Why a synthetic fixture (the fix for the long-standing red baseline)

The suite used to point `repo_root` at whatever `geostat.ops.json` sat at the
real project root, asserting a *stale reference project* (modules `frontend` /
`chat-api` / `retrieval` / `ingestion`). When the live consumer migrated to
`api` / `geostat` / `panel`, ~44 tests + 11 errors appeared — the suite was
testing the consumer, not the kit. The kit is a reusable package, so its tests
now run against a fixture it controls: deterministic, and immune to consumer
manifest churn (standard golden-fixture pattern).

The fixture (`geostat-chat-ai`) models a representative multi-module consumer —
`chat-api` (java-boot api, env-profiles), `retrieval` (java-boot api, simple +
qdrant + credentials), `ingestion` (java-boot worker, postgres), `frontend`
(node-vite ui) — so every machinery path stays covered.

## What the suite still meaningfully verifies

- Manifest validation + schema + package boundary (`test_validate_manifest`, `test_layout_v2`)
- Driver registry integrity + driver_api resolution incl. node-api & node-vite (`test_driver_api`, `test_registry_integrity`)
- Compose service naming + config-gen golden output (`test_compose_identity`, `test_config_gen`)
- Deploy-path logic, stack-deploy ordering, migrate-layout (`test_deploy_paths`, `test_migrate_layout`)
- Credentials (explicit list + global GCP fallback), vscode-gen, scaffold abstractness

## Not run in this suite

SSH, rsync, Docker, live remote deploy.
