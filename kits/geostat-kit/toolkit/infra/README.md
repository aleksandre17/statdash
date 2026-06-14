# geostat infra (kit driver)

Postgres, Redis, Qdrant — **one stack per consumer repo** on a shared server root.

## Commands

| Command | Description |
|---------|-------------|
| `geostat infra prereqs` | SSH checks + Docker network (`ensure-prereqs.sh`) |
| `geostat infra local up\|down\|status` | Docker on developer machine |
| `geostat infra remote sync` | rsync `stack.infraComposeDir` → `{base}/{DEPLOY_PROJECT}/infra/{INFRA_SLUG}/compose/` |
| `geostat infra remote up\|down\|status` | Remote compose (scoped path) |
| `geostat infra remote purge -Confirm` | `down -v` for **this** `INFRA_SLUG` only |
| `geostat infra tunnel` | SSH `-L` only for `stack.infra.services` (ports via `infra-catalog.json` tunnel env keys) |

Implementation: `Invoke-Infra.ps1`  
Path helpers: `lib/env.ps1`, `lib/deploy_paths.py`

## Consumer wiring

- `geostat.ops.json` → `stack.infraComposeDir`, **`stack.infra.services`** (e.g. `["postgres"]`)
- Optional **`stack.infra.composeFiles`** — full `-f` list override
- Consumer: `docker-compose.base.yml` + `services/<id>.yml`
- Reference catalog: `compose/infra-catalog.json` (not required at runtime)
- **No** `INFRA_PROFILES` — manifest is the only service selector

## Isolation

Sibling projects: `.../geostat/infra/project-a` vs `.../geostat/infra/project-b` — separate containers, volumes, and host ports. `down` / `purge` never touches another slug's path.
