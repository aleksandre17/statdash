---
name: geostat-kit-overview
description: What geostat-kit is — manifest-driven ops package for multi-module polyglot orchestration
metadata:
  type: reference
---

# geostat-kit — Manifest-Driven Ops Package (v1.0.0)

**Location:** `kits/geostat-kit/` (this repo)  
**Consumer project:** `national-accounts` (this repo root)  
**Released:** 2026-05-21

## What It Is

**geostat-kit** is a reusable operations package — not application code. It orchestrates multi-module polyglot projects (Java/Spring, Node/Vite, etc.) **without hardcoding module names, paths, or ports**. Everything reads from a single `geostat.ops.json` manifest at runtime.

**Provides:**
- Manifest-driven CLI dispatcher (type → driver → command)
- Docker Compose generation (manifest + catalog → docker-compose.yml files)
- Per-module credentials management (no secrets in code)
- Environment configuration contracts (cascading .env files)
- Remote SSH deploy framework (JAR/dist to server)
- CI orchestration scaffold (health checks, artifact handoff)
- Extensible driver model (java-boot, node-vite, user-defined)

**Does NOT include:**
- Application code, business logic, deployable artifacts
- Production secrets (references only; real values in ops/config/)
- Build system changes (uses gradle, npm, vite — doesn't rewrite)
- Package.json or tsconfig.json generation (consumers own those)

## Core Pattern

```
geostat.ops.json (manifest—single source of truth)
    ↓ (read at runtime)
lib/project_context.py (API: load + query manifest)
    ↓
drivers/registry.json (type → command scripts)
    ↓
Driver script (bash/ps1: calls docker, gradle, npm, ssh)
    ↓
Actual work (docker compose, rsync, remote exec)
```

**Rule:** Never hardcode module IDs, paths, ports, or service names in kit code. All from manifest.

## Key Files Read

- `geostat.ops.json` (410 lines) — manifest that drives everything
- `lib/project_context.py` (205 lines) — ProjectContext API
- `lib/modules.py` (99 lines) — role/type resolution
- `drivers/registry.json` (22 lines) — driver type registry
- `compose/build.py` (175 lines) — compose generator
- `manifest.schema.json` (432 lines) — validation schema
- `scaffold/geostat.ops.json` — defaults source
- `contracts/MANAGE-CONTRACT.md` — unified verbs

