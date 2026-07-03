# Debugger Memory Index

## Project
- [Time-default async gap](project_time_default_async_gap.md) — geostat from=0/to=0 root cause: empty async year-select coerces to 0, isLoading never gates render
- [ApiStore val measure drop](project_apistore_val_measure_drop.md) — async store dropped val measure pin + extractRequirements ignored query filter → per-measure KPI collapse + crossed approach panels
- [Transform registry tree-shake + ETag slice](project_transform_registry_treeshake_and_etag_slice.md) — Vite shook the transform-step registry empty (pipe no-op → accounts bars blank) + dataset ETag 304'd uncached slices to empty (dynamics kpi-strip cold-throw)
- [Dynamics + geomap + sector parity](project_dynamics_geomap_sector_parity.md) — dynamics single-bar (toYear pick=last/desc → min + range-mode re-pins year, no bar-visibility gate) · regional map blank (missing geojson asset + .panel has no height flex-chain) · sector donut No-data ($ne defeated by ctx baseline)
- [CAGR span + treemap render](project_cagr_span_and_treemap_render.md) — regional current CAGR 0.0% (range-only fromYear/toYear cleared in year mode → new span-derived hidden-param pattern) · GDP income treemap blank (render-wrapper had no height + empty-string color kept by `??` not `||`)
- [LocaleString compose boundary](project_localestring_compose_boundary.md) — "[object Object]" leaks: String(LocaleString) OUTSIDE row-cell resolve (template/concat ops, resolveOptions, hardcoded-en table headers) → composeLocale-and-tag in core + useResolveLocaleSafe in React shells
- [Choropleth flat + donut monochrome](project_choropleth_flat_and_donut_monochrome.md) — geograph GeoMap painted --color-accent on every region (no value→color scale ever existed; buildColorScale lives only in legacy panels/map stub) + donut grey (thresholdColor??muted, treemap already distributed chartPalette) → new token-derived sequentialRamp+quantileColors in styles
- [GDP dropped sections vs regional intact](project_gdp_dropped_sections_vs_regional_intact.md) — owner's "missing regional top chart" is really GDP structural+noe-share dropped in 52738a3 (dangling "structural" nav anchor); regional fully intact
- [Multi-region comma-geo wire](project_multiregion_comma_geo_wire.md) — live regional multi-select broken: buildObsFilterParam sends geo:"R2,R3" as one literal → 0 rows (API wants array); sectors-multi collapses to region-total bar. Bundle NEW, KPI year-reactivity OK.
- [PromiseCache node collision](project_promisecache_node_collision.md) — State-B pivot root: async _promiseCache keyed on non-node-unique depKey; geo-map + sectors share fetch fingerprint → collide (async only; sync masks). Fix = fold recipeKey into cacheKey.
- [Composition table State-A-only select](project_composition_table_stateA_only_select.md) — owner's "multi-region no sector breakdown": map-click WORKS live (wire-array+cache fixes deployed); real root = DataTable routes State-B rows to PivotTable which is never passed onRowSelect → composition table inert after first pick (not AR-38)
- [Horizontal height + map hidden-remount](project_horizontal_height_and_map_hidden_remount.md) — Chart.tsx output.horizontal inline height override = shared root for tall-clip (accounts scroll lost) + short-cramp (regional hbar 240px); GeoMap M0 0 collapse on hidden GeoJSON key-remount is pre-existing Leaflet, not the batch


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
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
