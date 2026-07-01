# Senior Frontend Developer — Memory Index

## Project
- [Scrollbar utility + table overflow](project_scrollbar_utility_and_table_overflow.md) — AR-15: .scroll-fancy SSOT themed scrollbar (styles/css/scrollbar.css, token-derived); flex min-width:auto = table-clip root cause; apply .scroll-fancy to any new scroll pane
- [Panel DataSpec editor contract](project_panel_dataspec_editor.md) — engine types are the contract the Constructor UI must produce; spec-text mismatches resolved toward engine
- [Bootstrap runner Phase A (ADR-0026)](project_bootstrap_runner_phasea.md) — manifest is runtime SSOT; PageLoader resolves via usePageById; modes+formatters register post-bootstrap from manifest
- [Constructor C3 + C5](project_panel_c3_c5.md) — cube capability-discovery (discovery/), active-dataset via DataSource.config.datasetCode, save guard (4 checks) wired into api-actions
- [De-tenant Phase 2 STRIP (ADR-0028)](project_detenant_phase_strip.md) — geostat → pure runner; emptyManifest fallback; seed.ts/verify-parity/seed-pipeline read ops/seed-data files
- [Chrome config seam](project_chrome_config_seam.md) — thin ChromeConfig base + per-element meta.ts PropSchema (ISP/OCP); F1/F2/F3 fitness gate; ChromeSlot per-facet config resolution
- [Constructor Visibility V4](project_constructor_visibility_v4.md) — VisibilityExpr "show-when" builder: leaf PropSchemas + recursive composite tree; new filterParams/modes enum-ref sources; closes last COVERAGE_TODO
- [Live store measure pinning](project_live_store_measure_pinning.md) — live ApiStore does pure dim_key containment, no measure filter/agg; every DataSpec/KPI must pin all scoping dims (incl. measure) in its own filter

## Feedback — corrections & validated approaches
- [Conform to engine types over spec text](feedback_conform_engine_types.md) — when a task spec contradicts a published @geostat/engine type, the type wins
