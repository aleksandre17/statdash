# Debugger Memory Index

> Solved one-off bug narratives (fixes live in git + tests) were retired in the SSOT-reorg curation. Their recurring diagnostic HEURISTICS were consolidated into the pattern files below. Path key: older references to `engine/*` / `@geostat/*` map to `platform/packages/*` / `@statdash/*`.

## Recurring patterns (consolidated diagnostic playbooks)
- [Async-store live-render patterns](project_async_store_live_render_patterns.md) — the two-store contract (sync ExternalStore vs async ApiStore/CachedStore) + a 12-trap catalog for "renders in tests, broken live" bugs (dropped pins, cache-key node-uniqueness, warm≡read key, $ne/comma client-side-only, tree-shaken register*(), 304-to-empty, loading-vs-empty, span-derived hidden params) + render/CSS traps (`??`-vs-`||`, value-shading ramps, height-chain, Leaflet hidden-remount)
- [LocaleString resolve boundary](project_localestring_boundary.md) — the positional i18n boundary: resolve {ka,en}→scalar ONLY at/after React; combine per-locale + re-tag (composeLocale) or resolve in shells; discriminate objects by field-identity not shape; honest types + full-page fitness matrices
- [Probe methodology: hard vs soft nav](project_probe_methodology_hard_vs_soft.md) — goto-only probes hard-load and can't see soft-nav bugs (scroll restoration, theme-at-first-paint, leaked route state); replicate the SOFT path; apply data-theme synchronously pre-render; theme-reading useMemo needs a theme-epoch dep

## Standing environment / build gotchas
- [Vitest 4 workspace removed](project_vitest4_workspace_removed.md) — vitest.workspace.ts is silently ignored in Vitest 4; use root vitest.config.ts test.projects; "Failed to resolve entry across many suites" → suspect the project-config layer, not aliases
- [Typecheck peer-dep resolution](project_typecheck_peer_dep_resolution.md) — real gate is `tsc -b apps/geostat/tsconfig.app.json`; engine peer deps need tsconfig `paths` to apps/geostat/node_modules (+@types redirect for type-less deps); never add the dep to an engine package
- [Barrel export gaps](project_barrel_export_gaps.md) — a symbol defined-but-not-re-exported from the engine barrel surfaces as "X is not a function", often swallowed by try/catch and mis-reported as a data 'error' status; grep `export (function|const)` and add the re-export

## Open judgment records
- [Escalated type decisions](project_escalated_type_decisions.md) — two tsc clusters that are architectural decisions, not mechanical fixes: control `category` vs SliceCategory taxonomy, and the `custom` DataSpec union gap (deliberately unresolved — needs team intent)
