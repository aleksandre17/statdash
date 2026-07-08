---
name: geostat-deploy-kit
description: geostat-kit — vendored manifest-driven ops/deploy package (kits/geostat-kit); pattern, API surface, credentials model. Distilled from 7 files 2026-07-08.
metadata:
  type: reference
---

# geostat-kit — Manifest-Driven Ops Package

**Location:** `kits/geostat-kit/` (vendored into this repo, brought from another project — same purpose here: orchestrate this repo's polyglot multi-module apps). Self-versioned (`VERSION` file, own `CHANGELOG.md`/`ARCHITECTURE.md`/`docs/`) — treat as a semi-external framework dependency, not app code.

**This repo's manifest:** root `geostat.ops.json` — modules `api` (node-api), `geostat` (node-vite), `panel` (node-vite). (Kit's own docs/examples use a different demo project's module names like `chat-api`/`frontend`/`retrieval` — don't confuse those with this repo's actual modules.)

## Core Pattern (still true, re-verified 2026-07-08)

```
geostat.ops.json (manifest, SSOT)
  → lib/project_context.py (ProjectContext: load + query manifest)
  → drivers/registry.json (type → command → script)
  → driver script (bash/ps1: docker, gradle/npm, ssh)
  → actual work
```

**Rule:** never hardcode module IDs/paths/ports/service names in kit code — everything resolved from the manifest at runtime. **Enforced as a fitness function** (`tests/test_toolkit_hardcodes.py` scans driver/lib/cli/compose/adapter scripts for forbidden brand/path literals) — not just convention.

## Manifest Essentials

Schema: `kits/geostat-kit/manifest.schema.json`. Key shape: `version`, `package`, `secrets` (env root, e.g. `ops/config`), `compose.catalog`, `modules.<id>.{role, type, path, secretsModule, credentials[]}`, `cli.aliases`, `stack.{composeModules, deployBaseSecretsModule}`, `stackDeploy.steps`, `features.gcpCredentials` + `adapters.gcp.*` (global credential fallback).

**No hardcodes principle:** module IDs only from `modules.*`; paths only from `modules.<id>.path`; secrets folder only from `modules.<id>.secretsModule`; driver type only from `modules.<id>.type` — one kit works for any project shape.

## ProjectContext API (lib/project_context.py) — stable surface, spot-checked accurate 2026-07-08

```python
ctx = ProjectContext.discover()
ctx.list_module_ids() / ctx.module_id_for_role(role) / ctx.module_ids_for_type(type)
ctx.module_path(id) / ctx.secrets_module_dir(id) / ctx.secrets_root / ctx.package_root
ctx.module_credentials_list(id)   # [{"file","mount","envVar"}]
ctx.compose_service_names()       # {module_id: docker service name}
ctx.cli_aliases() / ctx.resolve_alias(alias)
```
Bash/PowerShell equivalents exist (`project.sh`/`project.ps1`, `env.sh`/`env.ps1`). Root discovery order: `GEOSTAT_PROJECT_ROOT` env var → walk up for `geostat.ops.json` → legacy opt-in fallback.

**Caveat:** exact file inventory of `lib/` and exact command lists per driver type in `drivers/registry.json` drift as the kit is updated upstream (confirmed 2026-07-08: `node-api` driver gained full commands since last capture, `lib/` gained `driver_api.py`, `resolve_cli.py`, `ssh.sh/ps1`, migration scripts not previously recorded). **Don't trust a memorized file list — `ls kits/geostat-kit/lib/` and `cat kits/geostat-kit/drivers/registry.json` directly when exact commands/files matter.**

## Driver Dispatch

Type-based: `modules.<id>.type` → `drivers/registry.json[type].commands.<verb>` → script path under `drivers/<type>/`. Multiple modules may share one type; dispatch is never by folder-name assumption. To add a driver: copy `drivers/_template/`, implement `compose`/`deploy`/`manage` (+ optional `check`/`dev`), register in `registry.json`.

## Credentials — No Secrets in Code

Resolution order per module: (1) explicit `modules.<id>.credentials[]` overrides, (2) global `features.gcpCredentials` + `adapters.gcp.*` fallback (only for modules whose role/type accepts it), (3) none. All mounts read-only (`:ro`). Real secret values live only in `ops/config/<secretsModule>/` (gitignored: `.env.dev`, `.env.prod`, `.env.deploy`, credential JSON files) — kit code only ever holds filenames/paths/env-var-names as references, never literal values. **Verified 2026-07-08: no literal secrets present in kit documentation/memory — only filename references (e.g. `google-credentials.json`) and env-var names.**

## Consumer `ops/` Responsibility (this repo owns, kit reads)

- `ops/config/<secretsModule>/` — real env files + credential files (gitignored)
- `ops/compose/catalog.json` — templates+targets input to compose generation (3 modes: simple template, manifest-stack dynamic, manifest-module dynamic single)
- `ops/compose/infra/` — infra service compose fragments (postgres, redis, etc. — consumer-owned)
- `ops/ci/*.sh|ps1` — orchestration/smoke-test scripts the manifest points to (`ci.integration`, `ci.waitStackHealth`)

Kit generates `docker-compose*.yml` into app dirs + `ops/compose/stack/`; it never generates `package.json`/`tsconfig.json`/`build.gradle`/app Dockerfiles.
