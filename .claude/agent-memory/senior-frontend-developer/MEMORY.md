# Memory Index

## Constructor (apps/panel)
- [Panel M0 boot gaps](project_panel_m0_boot_gaps.md) — AR-49 MetricPalette unreachable live: no metric-registration path + main.tsx omits i18next.init (test-masked)
- [Constructor architecture (state)](project_constructor_state.md) — Inspector/SchemaSource seam, registry pattern, Coverage Fitness gate, standing gotchas
- [Constructor C3+C5](project_panel_c3_c5.md) — cube capability-discovery + save guard (4 checks) / i18n shift-left
- [Panel DataSpec editor](project_panel_dataspec_editor.md) — visual DataSpec Query Builder; engine types are the contract
- [Studio shell (AR-49 M1.2)](project_panel_studio_shell_m12.md) — flag-gated authoring shell; useCanvasController reuse seam; token-CSS import; M1.3/M1.4 hand-offs
- [Studio M2.0+M2.1 role lens](project_panel_studio_m2_role_lens.md) — Steward lens (useRole seam, rail stewardOnly, FF-ROLE-IS-LENS) + M2.1 modeler relocated to ModelSurface, FF-AUTHOR-NO-QUERY
- [Panel live canvas (N35)](project_panel_live_canvas.md) — real NodePageRenderer as Constructor canvas; undeclared host deps
- [Page lifecycle workflow](project_page_lifecycle_workflow.md) — draft→publish, lifecycle store slice, save-guard/403 surfacing
- [Live-preview request volume](project_live_preview_request_volume.md) — cube-request bounding via debounced page descriptor, not another cache
- [Value mappings architecture](project_value_mappings_architecture.md) — EXP-06 value→{text,token,icon}, token-bound, layer split
- [Panel code-splitting](project_panel_code_splitting.md) — lazy boundaries + Rolldown vendor groups; jsx-runtime/apexcharts priority gotcha
- [Panel tsconfig constraints](project_panel_tsconfig_constraints.md) — no TS parameter-properties / import type required
- [Panel Playwright e2e harness](project_panel_playwright_e2e.md) — real-browser boot/bind proof; runner separation; mock-API; offline-run bridge (pw 1.61.1)
- [Canvas chromeConfig defect](project_panel_canvas_chromeconfig_defect.md) — live canvas can't render nodes in-browser (CanvasView omits chromeConfig); NodeErrorBoundary masks it

## Data / stores
- [Live store measure pinning](project_live_store_measure_pinning.md) — live ApiStore does pure dim_key containment, no measure filter/agg

## i18n / locale
- [i18n content contract (AR-26)](project_i18n_content_contract_ar26.md) — where each user-facing field localizes; ChartSeries.name stays neutral
- [i18n leak-proof + integrity (AR-37/39)](project_i18n_integrity_ar37_ar39.md) — self-maintaining authoring gate + render gate + chrome i18n mechanism
- [i18n label gate + Law-4 placement](project_i18n_label_and_law4_placement.md) — labelCompleteness fitness + where bilingual authoring schemas may live
- [Law-4 i18n check](project_law4_i18n_check.md) — check-laws Georgian rule: single-locale=violation, bilingual {ka,en}=ok
- [Runner chrome i18n (ADR-019)](project_runner_chrome_i18n_adr019.md) — manifest.i18n.catalog wiring; i18next addResourceBundle deep-flag gotcha

## Data integrity
- [Integrity indicator page scope (AR-40)](project_integrity_indicator_page_scope.md) — ONE page-level indicator; two-channel NodeStatusContext; kpi-strip fold gotcha

## Theming / tokens
- [Semantic-token spine](project_semantic_token_spine.md) — 3-tier tokens, gates (FF-TOKEN-ONLY/FF-TENANT-OVERRIDE), byte-identity gotcha, ΔE collapse ratification
- [Dark-mode completeness + fitness](project_dark_mode_completeness_and_fitness.md) — dark is a token-override layer that must cover the WHOLE Tier-2 set
- [Tenant dark cascade gap](project_geostat_tenant_dark_cascade_gap.md) — a tenant block can pin a role unconditionally and beat [data-theme=dark] by source order
- [Theming seam](project_theming_seam.md) — data-theme attribute + semantic-token override; ctx.theme threading
- [Font de-brand role spine](project_font_debrand_role_spine.md) — --font-family-display L0 role; why chart donut-legend was deferred
- [Platform typeface FiraGO](project_platform_typeface_firago.md) — self-hosted Latin+Georgian face at tokens.css SSOT; subsetting recipe
- [Scrollbar utility + table overflow](project_scrollbar_utility_and_table_overflow.md) — .scroll-fancy SSOT; flex min-width:auto table-clip root cause

## Charts
- [Chart low-cardinality render rule](project_chart_low_cardinality_render_rule.md) — colour-by-series + bounded bar fill + horizontal content-height seams

## Tables
- [DataTable band fill-chain](project_datatable_band_fill_chain.md) — TableShell wrapper breaks the band flex-chain; :has() fill-flex fix
- [SNA table is PivotTable](project_sna_table_is_pivottable.md) — /ka/accounts renders via PivotTable not SimpleTable; probe gotchas

## Layout / responsive
- [Panel sizing cqi model](project_panel_sizing_cqi_model.md) — context-proportional band; --panel-ratio composes role×context×authored as 3 orthogonal vars
- [Responsive audit systemic roots](project_responsive_audit_systemic_roots.md) — 2026-06 audit + fix wave; reflow fitness guard + --page-measure seam
- [Section authoring uniformity](project_section_authoring_uniformity.md) — every section composed via `columns`; nav-safety invariants

## Chrome / navigation / export
- [Chrome config seam](project_chrome_config_seam.md) — thin ChromeConfig base + per-element PropSchema; F1/F2/F3 fitness gate
- [Fail-soft chrome + app boundary](project_failsoft_chrome_and_app_boundary.md) — resolveChrome mounts ALL slots; shells must null-guard chromeConfig
- [Export menu + section scope](project_export_menu_and_section_scope.md) — ExportBar→ExportMenu; NodeExportContext section-scoped publish/subscribe seam
- [text/gauge panels not in barrel](project_text_gauge_panels_not_in_barrel.md) — exist on disk but absent from panels/index.ts → silently render nothing

## De-tenant / runner architecture
- [Bootstrap runner Phase A (ADR-026)](project_bootstrap_runner_phasea.md) — manifest is runtime SSOT; PageLoader resolves via usePageById
- [De-tenant Phase 2 STRIP (ADR-028)](project_detenant_phase_strip.md) — geostat → pure runner; emptyManifest fallback; seed-data re-points
- [Geostat code-splitting](project_geostat_code_splitting.md) — single lazy RendererSurface boundary; store-builder eager-registration ordering regression
- [Optional-peer vite resolution](project_optional_peer_vite_resolution.md) — data-driven peer alias unions all source-bundled @statdash/* peerDeps
- [Expr bundler-agnostic env flag](project_expr_bundler_agnostic_env.md) — packages/expr dev flag: local cast only, never process.env/vite ambient

## Build / test infrastructure
- [ESLint conventions](project_eslint_conventions.md) — _-prefix unused-var ignore; react-refresh co-location warnings accepted
- [Storybook v10 setup](project_storybook_v10_setup.md) — resolves to v10; addon-essentials/@storybook/test are v8-only, use core+addon-docs
- [Plugins shell test harness](project_plugins_shell_test_harness.md) — render REAL shells: i18next stub, jsdom Apex/Leaflet limits, direct-call vs renderNode
- [Geostat runner render test harness](project_geostat_runner_render_test_harness.md) — boot sequence, vitest @/ alias fix, jsdom observer shims
- [react exportMenu fitness hangs gate](project_react_exportmenu_fitness_hangs_gate.md) — packages/react whole-suite HANGS on exportMenu.fitness; run targeted
- [CSS fitness comment-stripping gotcha](project_css_fitness_comment_stripping_gotcha.md) — block-scanning regexes MUST strip CSS comments first or false-positive
- [Windows long-path vitest worktree block](project_windows_longpath_vitest_worktree_block.md) — MAX_PATH block IS workable via node_modules junctions

## Deploy
- [node-vite remote deploy layout](project_node_vite_remote_deploy_layout.md) — ships workspace root to $DEPLOY_PATH/context; env_file path math

## Reference
- [Config API contract](reference_config_api_contract.md) — /api/config endpoint shapes & quirks the Constructor client maps
- [Render path / browser-verify](reference_render_path_browser_verify.md) — de-tenanted runner needs API; use live :3002/:3003; fail-soft-is-itself-broken note

## Feedback — corrections & validated approaches
- [Conform to engine types over spec text](feedback_conform_engine_types.md) — when a task spec contradicts a published engine type, the type wins
- [No registerSlice in engine-react tests](feedback_engine_react_no_registerslice_in_tests.md) — register via nodeRegistry.register; registerSlice pulls i18next
- [Line-ending discipline](feedback_line_endings.md) — Edit tool can flip an LF file to CRLF on this Windows repo; verify + normalize before committing
