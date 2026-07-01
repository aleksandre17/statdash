# Debugger Memory Index

## Project
- [Vitest 4 workspace removed](project_vitest4_workspace_removed.md) — vitest.workspace.ts is silently ignored in Vitest 4; use root vitest.config.ts test.projects
- [Barrel export gaps](project_barrel_export_gaps.md) — @geostat/engine barrel omitted functions; "X is not a function" swallowed by try/catch as data 'error' status
- [Typecheck peer-dep resolution](project_typecheck_peer_dep_resolution.md) — gate is `tsc -b apps/geostat/tsconfig.app.json`; engine peer deps need tsconfig paths to apps/geostat/node_modules
- [Escalated type decisions](project_escalated_type_decisions.md) — control `category` vs SliceCategory taxonomy gap, and `custom` DataSpec union gap; both are architectural, not mechanical
- [CachedStore async gap](project_cachedstore_async_gap.md) — live stats charts empty: CachedStore masks ApiStore caps.sync=false + renderNode is sync-only
- [Accounts aggregates classifier load](project_accounts_aggregates_classifier_load.md) — SNA chart empty: store loaded classifiers only from nonTimeDims (not classifierDims) + ACL dropped metadata.isClosing; canonical workbook (not seed bundle) is the dim-code SSOT
- [ApiStore wire-inexpressible filters](project_apistore_wire_inexpressible_filters.md) — KPI warm reintroduced wildcard-deleted dims (cold-throw) + $ne exclusion String()-mangled onto wire (empty regional map); both warm/read-key or wire-contract mismatches
- [LocaleString structural flatten](project_localestring_structural_flatten.md) — resolveRowLocales flattened ANY object as LocaleString, killing DataRow.provenance badges (Law 9); discriminate by field identity not shape
- [LocaleString landing unit gap](project_localestring_landing_unit_gap.md) — portal React #31: StatItem.unit typed `string` masked missing resolve + render-guard matrix omitted the index/landing page entirely
- [Soft-nav scroll parity](project_softnav_scroll_parity.md) — "table still broken" soft-nav≠hard-load was scroll-restoration (no ScrollRestoration on classic BrowserRouter); goto-only probes hard-load and structurally can't see it
- [Choropleth theme frozen memo](project_choropleth_theme_frozen_memo.md) — map colors differ hard vs soft ONLY in dark mode: data-theme applied post-paint (useEffect) + ramp memo frozen on [rows] bakes pre-theme --color-surface; fixed by sync data-theme pre-render in main.tsx
