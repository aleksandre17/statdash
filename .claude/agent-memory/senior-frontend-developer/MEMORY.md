# Memory Index

## Project
- [SNA table is PivotTable (AR-35)](project_sna_table_is_pivottable.md) — /ka/accounts National Accounts renders via PivotTable (series encoding), NOT SimpleTable — why AR-15/27/34 missed it; align SSOT + bounded-scroll roots; probe/verify gotchas
- [Section authoring uniformity](project_section_authoring_uniformity.md) — owner #1 fix: every geostat.provisioning section composed via `columns` (pairs count:2/singles count:1), gate on wrapper; gdp already canonical (untouched); repeat-wrap is nav-safe; FF-UNIFORM-SECTION-AUTHORING
- [Plugins shell test harness](project_plugins_shell_test_harness.md) — render REAL shells in plugins vitest: i18next optional-peer stub alias, jsdom Apex/Leaflet→EmptyState, full provider stack, direct-call vs renderNode (vacuous-pass) for FF-PLUGIN-SHELLS-AXE-CLEAN
- [i18n content-contract (AR-26)](project_i18n_content_contract_ar26.md) — where each user-facing field localizes (badge=PerspectiveCarrier, KpiTrend static, geograph, series via transform tagCell); ChartSeries.name deliberately NOT LocaleString (neutral output); config-no-locale-leak fitness
- [i18n label gate + Law-4 placement](project_i18n_label_and_law4_placement.md) — labelCompleteness fitness + authoring-metas.ts pure SSOT; where bilingual authoring schemas may live (core ALLOW vs meta/Node auto-exempt vs apps unscanned); gen:schema drift on label edits
- [Value mappings architecture](project_value_mappings_architecture.md) — EXP-06 value→{text,token,icon}: core resolver / styles tokenColor / table MappedCell / panel FieldControl; token-bound (no hex), schema in panel not core
- [Peer vite resolution (data-driven)](project_optional_peer_vite_resolution.md) — geostat+panel vite.config alias UNIONs all source-bundled @statdash/* peerDeps (react-router-dom/i18next + optional leaflet/apexcharts) past clean-Docker resolve failures; entry-file alias (browser-IIFE trap) + nested-export-condition gotcha + guard
- [Panel code-splitting](project_panel_code_splitting.md) — lazy boundaries (wizard steps/canvas/cmdk/saveGuard) + Rolldown codeSplitting vendor groups + jsx-runtime/apexcharts priority gotcha; eager ≈732 kB (was 1.89 MB)
- [Geostat code-splitting](project_geostat_code_splitting.md) — single lazy RendererSurface boundary (engine+ApexCharts+Leaflet+setupRegistrations) + Rolldown vendor groups; entry 1.25 MB → 68 kB; tests import setupRegistrations/LocaleGuard sync (keep them so)
- [Constructor source-authoring (M2)](project_constructor_source_authoring_m2.md) — store-builder getMetadata/testConnection caps + type↔kind SSOT + ADD/TEST/BROWSE/SAVE UI + FF-SOURCE-AUTHORABLE
- [Panel tsconfig constraints](project_panel_tsconfig_constraints.md) — no TS parameter-properties / import type required in platform/apps/panel
- [Config API contract](reference_config_api_contract.md) — /api/config endpoint shapes & quirks the Constructor client maps
- [Storybook v10 setup](project_storybook_v10_setup.md) — SB resolves to v10; addon-essentials/@storybook/test are v8-only, use core + addon-docs
- [node-vite remote deploy layout](project_node_vite_remote_deploy_layout.md) — remote ships workspace root to $DEPLOY_PATH/context (context-dir), env_file path math
- [Constructor Inspector (C1/C2)](project_constructor_inspector.md) — schema-driven Inspector + FieldControlRegistry + unified NodeDef store + flat⇄tree round-trip in apps/panel; in-flight engine enum-ref/coverage seam
- [ESLint conventions](project_eslint_conventions.md) — _-prefix unused-var ignore is config'd; react-refresh co-location warnings are accepted residual; arrow gate via no-restricted-imports
- [Law-4 i18n check](project_law4_i18n_check.md) — check-laws Georgian rule: single-locale=violation, bilingual {ka,en}=ok; engine uses LocaleString; useResolveLocaleSafe for provider-optional components
- [Geostat runner render test harness](project_geostat_runner_render_test_harness.md) — how to write full render-path tests for apps/geostat: boot, vitest @/ alias fix, jsdom observer shims, project name=national-accounts
- [text/gauge panels not in barrel](project_text_gauge_panels_not_in_barrel.md) — text+gauge panels exist on disk but absent from panels/index.ts → never register → silently render nothing
- [expr bundler-agnostic env flag](project_expr_bundler_agnostic_env.md) — packages/expr dev flag: local cast only, never process.env / vite ambient / global ImportMeta augmentation (leaks to apps)
- [Page lifecycle workflow](project_page_lifecycle_workflow.md) — draft→publish UI in apps/panel: lifecycle store slice (separate from CanvasPage), thunks, PageWorkflowBar, save-guard/403 surfacing, store split for bloat
- [Live-preview request volume](project_live_preview_request_volume.md) — canvas live preview cube-request bounding: ApiStore bypasses CachedStore (async), _promiseCache + ApiStore._cache dedupe, G3.2 page-descriptor debounce seam
- [Semantic-token theming spine P0](project_semantic_token_theming_spine_p0.md) — 3-tier tokens + brand-neutral default theme + [data-tenant] seam + --sc rebase landed; shells still literal (P1-P5); no-tenant-content scan bans "geostat" in packages/{react,styles}
- [Semantic-token byte-identity gotcha](project_semantic_token_byte_identity_gotcha.md) — ADR §3 collapse rows are ΔE near-dups NOT byte-identical (only canonical value is); var() works in CSS not SVG presentation attrs; status tones diverge from --status-*
- [Semantic-token spine COMPLETE (Pfinal)](project_semantic_token_spine_complete.md) — all stragglers tokenized; new roles (trend/obs-status/error/translucent/chip); cssVar() chart-fill util in @statdash/styles; DonutChart split; FF-TOKEN-ONLY(error)+FF-TENANT-OVERRIDE gates+allowlist
- [Constructor coverage + op-schemas (V1)](project_constructor_coverage_and_op_schemas.md) — PropSchema moved to core; transform-op authoring registry (registerTransformStep schema arg); Coverage Fitness #1 gate enumerating engine SSOTs; TransformStepEditor reuses Inspector
- [Constructor ParamDef/Filters (V0)](project_constructor_paramdef_filters_v0.md) — param-schema registry + FiltersDrawer + ParamDefEditor reuse Inspector; cube-bound key/default (sourceDim now typed); COVERAGE_TODO.paramDefs emptied; effects/crossValidate noted
- [Constructor Page Inspector + Methodology (V3)](project_constructor_page_inspector_methodology_v3.md) — page-config/ pageSchemaSource (presentationPropSchema reprefixed) authors PageConfigBase via Inspector; section methodology.* + shared dataIntegritySchema preliminary fragment make Law-9 badge authorable; page-root kind NOT editable (adapter hardwire)
- [Constructor DataSpec editors (V2)](project_constructor_dataspec_editors_v2.md) — row-list (RowSpec schema registry, single ROW_SPEC_KEY) / by-mode (recursive DataSpecEditor) / transform (reuse PipelineBuilder+EncodingEditor) / pivot (own friendly editor); JsonDataField render-reconcile (no useEffect setState); dataSpecs COVERAGE_TODO = only custom
- [Constructor field-wells + Show-Me (V5)](project_constructor_fieldwells_showme_v5.md) — drag field chips into measure/encoding wells + Tableau Show-Me; binding.ts pure write = BARE STRING (byte-identical to typed editors, NOT ChannelDef); reuses cubeProfile/suggestPanels/dnd-kit; pick→click = keyboard equiv (WCAG)
- [Constructor Outline + Cmd-K/slash (V6)](project_constructor_outline_cmdk_v6.md) — Webflow Navigator tree + cmdk palette over SAME flat store; insertNodePatch/moveNodePatch engine + makeNode/nestAccepts SSOT; byte-identical-insert fitness test; role=tree a11y; cmdk dep adopted
- [Constructor templates + data-first generate (V7)](project_constructor_templates_generate_v7.md) — "never start blank" gallery (3 starters ARE valid NodePageConfigs) + generatePageFromProfile reuses suggestPanels/buildSuggestedSpec; save-guard REQUIRED-field check is the real gate (not just validateConfig); radiogroup a11y
- [Constructor Perspectives pane (P-final)](project_constructor_perspectives_pane_pfinal.md) — page-level PerspectiveAxis authoring: registry-driven scope.* schema source (Law 8 auto-surface), record⇄list adapter (perspectives[0]=default SSOT), when/available via VisibilityBuilder, filter-item visibleWhen added to ParamDefEditor; live-canvas preview needs CanvasView perspectiveState seam (escalated)
- [Responsive audit systemic roots](project_responsive_audit_systemic_roots.md) — 2026-06 audit + FIX wave (R1 sr-only reflow leak/R2 header flex@1024/R3 page-measure/F5 select) landed in-system; reflow fitness guard + --page-measure seam + Chromium before/after proof

- [Chart low-cardinality render rule](project_chart_low_cardinality_render_rule.md) — few-series/few-bar canonical rule: seriesColorByIndex (interpreter flag → chartColorAt render) + autoBarFillPct bounded 64→34% + hbar content-height inline override (opts out of aspect band); branch feat/chart-lowcardinality-render un-merged
- [Panel sizing cqi model](project_panel_sizing_cqi_model.md) — AR-8 CONTEXT-PROPORTIONAL band: `calc(var(--panel-ratio)*100cqi)` flex-BASIS; `--panel-ratio` = role×context×authored as 3 orthogonal vars (fallback+multiply, NO specificity fight); `@container` scale → solo≠paired; role via `data-content` (geo .72/chart .52, plugin-owned); aspectRatio inverts to authored; 7 FFs; wrapper never carries height
- [Font de-brand role spine](project_font_debrand_role_spine.md) — --font-family-display L0 role + geostat [data-tenant] rebind (byte-identical); WHY chart.css donut-legend deferred (unique 3rd stack + JS apex literals) — guards later chart wave from regression
- [Platform typeface FiraGO](project_platform_typeface_firago.md) — canonical SELF-HOSTED Latin+Georgian face wired at tokens.css SSOT (supersedes system-ui default); fonts.css @font-face + subsetted woff2; brand-neutral BAN + new FF-PLATFORM-TYPEFACE lock; geostat inherits it; fonttools subset recipe
- [Fail-soft chrome + app boundary](project_failsoft_chrome_and_app_boundary.md) — resolveChrome mounts ALL registered chrome slots (not the site chrome map) → shells MUST null-guard chromeConfig; two-layer fail-soft = AppHeaderShell brand guard + AppErrorBoundary (mechanism-only, fallback injected); FF-CHROME-FAILSOFT
- [Dark-mode completeness + fitness](project_dark_mode_completeness_and_fitness.md) — dark = token-OVERRIDE layer that MUST cover whole Tier-2 semantic set; switcher froze on --color-surface-frame (~30 roles unflipped); FF-DARK-COMPLETE (styles) + FF-NO-UNTHEMED-COLOR (plugins) make "forgot dark mode" a red test; light-dark() flagged as future BEST

## Reference
- [Render path / browser-verify](reference_render_path_browser_verify.md) — de-tenanted runner needs API; use live :3002 (`/ka/gdp` etc) + panel :3003 (auth-gated login only); branch-vs-main staleness check; playwright chromium install steps


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [Scrollbar utility + table overflow](project_scrollbar_utility_and_table_overflow.md) — AR-15: .scroll-fancy SSOT themed scrollbar (styles/css/scrollbar.css, token-derived); flex min-width:auto = table-clip root cause; apply .scroll-fancy to any new scroll pane
- [Panel DataSpec editor contract](project_panel_dataspec_editor.md) — engine types are the contract the Constructor UI must produce; spec-text mismatches resolved toward engine
- [Bootstrap runner Phase A (ADR-0026)](project_bootstrap_runner_phasea.md) — manifest is runtime SSOT; PageLoader resolves via usePageById; modes+formatters register post-bootstrap from manifest
- [Constructor C3 + C5](project_panel_c3_c5.md) — cube capability-discovery (discovery/), active-dataset via DataSource.config.datasetCode, save guard (4 checks) wired into api-actions
- [De-tenant Phase 2 STRIP (ADR-0028)](project_detenant_phase_strip.md) — geostat → pure runner; emptyManifest fallback; seed.ts/verify-parity/seed-pipeline read ops/seed-data files
- [Chrome config seam](project_chrome_config_seam.md) — thin ChromeConfig base + per-element meta.ts PropSchema (ISP/OCP); F1/F2/F3 fitness gate; ChromeSlot per-facet config resolution
- [Constructor Visibility V4](project_constructor_visibility_v4.md) — VisibilityExpr "show-when" builder: leaf PropSchemas + recursive composite tree; new filterParams/modes enum-ref sources; closes last COVERAGE_TODO
- [Live store measure pinning](project_live_store_measure_pinning.md) — live ApiStore does pure dim_key containment, no measure filter/agg; every DataSpec/KPI must pin all scoping dims (incl. measure) in its own filter

## [platform] Feedback — corrections & validated approaches
- [Conform to engine types over spec text](feedback_conform_engine_types.md) — when a task spec contradicts a published @geostat/engine type, the type wins

## [platform] Project / Feedback (additional — un-indexed in source)
- [Panel live canvas](project_panel_live_canvas.md) — N35 mounts real NodePageRenderer as Constructor canvas; react/plugins undeclared host deps panel must provide
- [Theming seam](project_theming_seam.md) — data-theme attribute + semantic-token override seam in @statdash/styles; ctx.theme threading
- [No registerSlice in engine tests](feedback_engine_react_no_registerslice_in_tests.md) — register node types via nodeRegistry.register directly; registerSlice pulls i18next (app-tier)

## Auto-relocated (memory-home-guard — reconcile into a topic section)
- [Geostat tenant dark-mode cascade gap](project_geostat_tenant_dark_cascade_gap.md) — a tenant [data-tenant] block can pin a Tier-2 role UNCONDITIONALLY and beat [data-theme=dark] via source order (equal specificity); root-caused the hero white-text bug (PINNED_NO_FLIP) + a broader geostat accent/trend AA failure (FF-TENANT-DARK-COMPLETE)
- [CSS fitness comment-stripping gotcha](css_fitness_comment_stripping_gotcha.md) — parseBlockAt()-style regexes in tokens.parity.test.ts/tenant-theme.fitness.test.ts MUST strip CSS comments first or a rationale comment naming a token+colon produces a false-positive parsed entry
- [Windows long-path vitest worktree block](windows_longpath_vitest_worktree_block.md) — vitest CLI cannot start at all in deep `.claude/worktrees/agent-<id>/platform` paths (Node ESM >260-char MAX_PATH bug); universal/pre-existing; verify fitness logic via a plain-node replica script instead

## Auto-relocated (memory-home-guard — reconcile into a topic section)
- [DataTable band fill-chain](project_datatable_band_fill_chain.md) — banded table won't scroll: TableShell `<div {...bodyAttrs}>` wrapper breaks the band flex-chain (chart merges bodyAttrs onto .chart-wrap, table doesn't → asymmetry); NOT the NaN-crash root; `:has(> .data-table__wrap)` fill-flex fix in data-table.css; FF-TABLE-BAND-FILL-CHAIN

## Auto-relocated (memory-home-guard — reconcile into a topic section)
- [Chart low-cardinality render rule](project_chart_low_cardinality_render_rule.md) — few-series/few-bar canonical rule: seriesColorByIndex (interpreter flag → chartColorAt render) + autoBarFillPct bounded 64→34% + hbar content-height (bounded/scroll model, HBAR_MIN_HEIGHT retuned 240→380→560); branch feat/chart-lowcardinality-render un-merged
