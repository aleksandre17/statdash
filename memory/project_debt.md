# project_debt

Technical debt deferred to Phase 3/4 — known, logged, not lost.

## Active Phase 2 debt

| Item | Where | Why deferred |
|------|-------|-------------|
| Engine → DB DataStore | `apps/geostat` + MSW | Needs Layer 2.9 (stats routes exist, DataStore adapter pending) |
| Auth layer (JWT) | `apps/api` | Phase 2.10 — needs user model first |
| Constructor publish flow | panel → geostat | Phase 2.11 — JSON roundtrip to renderer |
| ~~Plugin catalog isolation~~ | resolved — `meta.ts` extraction complete | |
| `erasableSyntaxOnly` violations | `platform/engine/core` | Pre-existing, blocked on TS upgrade path |

## Audit findings — 2026-06-15 (law-violations sweep)

| id | Where | Violation | Severity | Card |
|----|-------|-----------|----------|------|
| D-1 | `engine/react/src/components/filters/CascadeSelect.tsx:40,42` | Georgian literals `დონე ${n}` / `ყველა` in agnostic component (Law 4) | high | work/items/0001 |
| D-2 | `engine/react/src/context/SiteContext.tsx:42-46` | `DEFAULT_I18N` hardwires `'ka'` locale in shared shell (Law 4) | high | work/items/0002 |

Laws A (dependency arrow), B (no-privileged-dims), C (DataSpec-declarative) — **clean**.
Systemic pattern: same erosion in both — agnostic layer carrying first tenant's `ka` identity.
Recommended fitness function: `law_patterns` CI gate forbidding `[Ⴀ-ჿ]` codepoints + `'ka'` literals in `engine/react/**` and `engine/core/**`.

## Phase 3/4 backlog

| Item | Phase | Notes |
|------|-------|-------|
| Node tree editor | 3.1 | columns → section → wrap → chart/table |
| FilterSchema editor | 3.2 | bars, effects, context mapping |
| VarMap / vars builder | 3.3 | |
| fieldConfig cascade editor | 3.4 | |
| visibleWhen editor | 3.5 | |
| Row-level security (RLS) | 4.1 | per-user dataset access |
| Read replica + continuous aggregates | 4.5 | TimescaleDB advanced |
| Grafana monitoring | 4.4 | pg_stat_statements → dashboard |
