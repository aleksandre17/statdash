# Plugins-Specialist Memory Index

## Project / Architecture
- [Plugin catalog isolation](project_catalog_isolation.md) — meta.ts extraction: each plugin's META in a Shell-free pure-TS file so apps/panel imports the catalog without pulling React/apexcharts/leaflet (done 2026-06-14)
- [DI inject-render lint gate](project_di_inject_render_lint_gate.md) — `react-hooks/static-components` off-override is scoped to `packages/plugins/**`; promoting useInject-render into `packages/react` needs a per-file scoped override
- [green gate stale buildinfo](project_green_gate_stale_buildinfo.md) — typecheck/build:engine show PHANTOM errors from stale `.tmp` buildinfo + stale core d.ts; clear/rebuild before trusting red; site-manifest test is flaky-by-timeout
- [chrome shells clean state](project_chrome_shells_clean_state.md) — chrome/** is low-yield for primitive churn (no RenderContext/placement); only accentStyle applies; node shells are the real adoption surface
- [perspective render validation](project_perspective_render_validation.md) — jsdom harness renders real geostat pages from provisioning manifest, URL-driven `?mode=`, empty store OK for structural axis surfaces; canvas previewPerspectiveId seam landed
- [store decorator install point](project_store_decorator_install_point.md) — registry-driven MetadataPort decorators (withMetricProvenance) install in stats store builder, onto ApiStore BEFORE CachedStore; gate on datasetPort||listMetrics()>0
- [responsive fix wave](project_responsive_fix_wave.md) — AUDIT-responsive shots are from `main` (re-render branch first; R3 page-measure already applied); aspect-panel height cap = `[data-aspect]` max-height `--size-panel-max-height` + `width:100%`

## Feedback — corrections & validated approaches
- [variant spine vs runtime state](feedback_variant_spine_vs_runtime_state.md) — authored-variant spine is only for def.variants; runtime selection/toggle state → data-* state attrs or aria-selected, not the spine
- [merged vs def.view label](feedback_merged_vs_defview_label.md) — read view fields off defineShell's `merged` prop, never `def.view` raw; exception = extended-view nodes (MapNode); accentStyle replaces inline `--sc` casts incl. per-row data colors


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [Chrome slot addition gotchas](project_chrome_slot_addition_gotchas.md) — inline slots not in provisioning (AppHeader `<ChromeSlot>` embed); ChromeConfig F1-locked; schema-less needs CHROME_EXEMPT + hard `.size` bump; theme-switcher useTheme persist
- [Layout-node composition](project_layout_node_composition.md) — nav-transparent cap req for section-wrapping containers, page-config.schema.json is generated (gen:schema), page body = stack, one grid primitive, layered fill chain
- [Apex responsive yaxis formatter drop](project_apex_responsive_yaxis_formatter_drop.md) — Apex responsive yaxis overrides drop labels.formatter → raw floats; re-carry via responsiveYAxis() in base.ts
- [Apex theme participation](project_apex_theme_participation.md) — F5: chart chrome reads tokens (foreColor getter + isDarkTheme luminance) + re-renders on [data-theme] flip via useThemeVersion key on Chart.tsx render wrapper
- [Panel App Setup](project_panel_setup.md) — React Admin v5 scaffold in apps/panel; pre-existing engine TS debt
- [CAPS consumer wired](project_caps_consumer.md) — getGroupedPaletteEntries() in paletteEntries.ts consumes getByCapability(CAPS.*); dead-seam closed

## [platform] Project (continued)
- [CommandBus migration](project_commandbus_migration.md) — GeorgraphShell + ExportBar panel shells migrated; controls use useFilter() not ctx — see file for why

## [platform] Project (continued)
- [Shell render testing](project_shell_render_testing.md) — jsdom-render a plugin shell in plugins vitest (mock @statdash/react, real GlobalStateProvider)
- [Chart LocaleString boundary](project_chart_localestring_boundary.md) — resolve chart config bilingual fields in useChartOutput (resolveChartDefLocale) before interpretChart; jsdom can't catch ApexCharts text leaks → chartApexLocale.fitness guard
- [Chart-fill leaf band](project_chart_fill_leaf_band.md) — band reaches .chart-wrap via WrapStyleContext (transparent wrap → data-aspect on the LEAF); fix = base.ts parentHeightOffset:0 + node-styles leaf growable-band so a vbar fills a stretched equal-height card

## [platform] Feedback
- [Node env test imports](feedback_node_env_test_imports.md) — @geostat/react sub-path + @geostat/engine fail in @vitest-environment node; test pure utils only

## [platform] Project (additional — un-indexed in source)
- [FieldConfig shape](project_fieldconfig_shape.md) — FieldConfig.thresholds shape + resolveThresholdColor usage in plugins
- [Plugin structure](project_plugin_structure.md) — actual plugin directory structure + registration wiring
- [Plugin tests](project_plugin_tests.md) — Vitest setup for plugins panel tests
