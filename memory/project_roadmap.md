# project_roadmap

## Phase 2 — Constructor Platform (current)

| Layer | Title | Status |
|-------|-------|--------|
| 2.1 | Capability Descriptor Pattern | ✅ done |
| 2.2 | Constructor UI (wizard + D&D) | ✅ done |
| 2.3 | DataSpec Query Builder | ✅ done |
| 2.4 | DB Schema (TimescaleDB + LTREE + Flyway) | ✅ done |
| 2.5 | API Server (@geostat/api Fastify) | ✅ done |
| 2.6 | Infra (two-stack Docker, pgBouncer) | ✅ done |
| 2.7 | Bootstrap (.claude kit) | ✅ done |
| 2.8 | Constructor → API wiring | ✅ done |
| **2.9** | **Engine → DB DataStore (stats API)** | 🔄 active |
| 2.10 | Auth layer (JWT on API) | ⏳ |
| 2.11 | Constructor publish flow (JSON → renderer) | ⏳ |

## Phase 3 — Advanced Constructor

| Layer | Title |
|-------|-------|
| 3.1 | Node tree editor (columns→section→wrap→chart/table) |
| 3.2 | FilterSchema editor (bars, effects, context mapping) |
| 3.3 | VarMap / vars builder |
| 3.4 | fieldConfig cascade editor |
| 3.5 | visibleWhen editor |

## Phase 4 — Production

| Layer | Title |
|-------|-------|
| 4.1 | Row-level security (RLS) |
| 4.2 | Auth (JWT/session, pgBouncer user mapping) |
| 4.3 | CI/CD pipeline |
| 4.4 | Monitoring (pg_stat_statements → Grafana) |
| 4.5 | Continuous aggregates (TimescaleDB) |
