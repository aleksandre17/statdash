# Debugger Memory Index

## Project
- [Vitest 4 workspace removed](project_vitest4_workspace_removed.md) — vitest.workspace.ts is silently ignored in Vitest 4; use root vitest.config.ts test.projects
- [Barrel export gaps](project_barrel_export_gaps.md) — @geostat/engine barrel omitted functions; "X is not a function" swallowed by try/catch as data 'error' status
- [Typecheck peer-dep resolution](project_typecheck_peer_dep_resolution.md) — gate is `tsc -b apps/geostat/tsconfig.app.json`; engine peer deps need tsconfig paths to apps/geostat/node_modules
- [Escalated type decisions](project_escalated_type_decisions.md) — control `category` vs SliceCategory taxonomy gap, and `custom` DataSpec union gap; both are architectural, not mechanical
- [CachedStore async gap](project_cachedstore_async_gap.md) — live stats charts empty: CachedStore masks ApiStore caps.sync=false + renderNode is sync-only
