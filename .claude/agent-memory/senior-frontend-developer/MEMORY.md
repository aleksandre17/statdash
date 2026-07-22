# Memory Index

> Housekept 2026-07-22: distilled from 105→52 files (692KB→~250KB). Wave-by-wave build logs
> (SL-0..SL-5, S1-S5, M1.2-M2.2, ADR-046/049/050 pipeline history) were folded into fewer
> current-state distillate files; pure logs/resolved bugs/superseded facts were deleted.

## Panel — AR-52 canon + current shell/IA
- [Studio shell map](project_panel_studio_map.md) — RightDock zones · Focus-View · EditPopover · overflow escalation · role lens · data-flow spine · canvas mount
- [Four-moment shell (AR-52 Step 1)](project_panel_four_moment_shell.md) — Data-first 5-mode rail · top bar = context+Publish
- [Plane the inspector (AR-52 Step 2)](project_panel_plane_inspector.md) — AudiencePlane hides plumbing; FF-NO-UNPROJECTED-DECLARED-FIELD
- [REFINE by concern-groups (AR-52)](project_panel_concern_refine.md) — FieldConcern axis groups the whole-node dock
- [Placement Law](project_placement_law.md) — pure scope×weight→container primitive + escalation port
- [Facet axis](project_facet_axis_style_facet.md) — 5 universal/opt-in facets (style/data/events/visibility/chrome) → dock
- [Bounded element bands (ADR-038/041)](project_panel_bounded_element_bands.md) — Part port, stable-key selection address

## Panel — data workspace (ADR-051) + pipeline program (ADR-046)
- [One Data workspace (ADR-051 DU1-3)](project_panel_one_data_workspace.md) — sources+model→one `data` door; DU3 ONE editor; DU3 persistence hold
- [Editor capability parity (DU4)](project_panel_editor_capability_parity.md) — trust-recovery restore; narrow fold gate + AdvancedRawPanel/SpecTypePicker
- [Capability Matrix (0104-E1)](project_panel_capability_matrix.md) — kinds require / editors provide / admissibility DERIVED; two-pool split, admissibility MUST stay pure
- [Data pipeline program (ADR-046)](project_panel_pipeline_program.md) — live grid · 3-pane workbench · emission flip · P-OFFER+role projection · steward raw-cube · C3/C5 capability+save-guard
- [Substrate + presets (ADR-049/050)](project_panel_substrate_presets.md) — workbench kind-agnostic · composed-preset primitive · skeleton restoration
- [DataSpec Authoring Lifecycle (C3)](project_authoring_hold_dataspec_persistence.md) — draft→publish→history band; hold DELETED (0104 E0); client drafts + validated-PUT violations

## Panel — canvas, chrome, authoring features
- [W1 Honest Canvas (AR-52)](project_panel_w1_honest_canvas.md) — live-default+veil, honest UNBOUND KPI, honest placeholders
- [W2 Semantic Spine (AR-52)](project_panel_w2_semantic_spine.md) — front-door hoist · corpus→governed ids
- [Canvas craft + brand-faithful (AR-52 W1)](project_panel_canvas_craft_and_brand.md) — craft punch-list seams + portable themeOverrides
- [Canvas chrome fidelity](project_panel_canvas_chromeconfig_defect.md) — whole app-shell paints on canvas; chrome canvas-selectable + reachable
- [Chrome shell mechanisms](project_chrome_shell_mechanisms.md) — ChromeConfig ISP seam · fail-soft null-guard rule · per-entry nav
- [Section scope + export](project_section_scope_and_export.md) — ExportMenu/NodeExportContext · page-level integrity indicator
- [Layout site-assembly (0102 R1)](project_panel_layout_assembly_r1.md) — empty-container affordance · move-guard nest · overlay geometry
- [Page-type + insert accept-graph](project_panel_page_type_and_insert_graph.md) — CanvasPage.type first-class · the accept-graph gap
- [Panel authoring features misc](project_panel_authoring_features_misc.md) — value mappings · uniform sections · Summary-Card Inspector · calc editor · DataSpec editor types
- [Panel sizing (AR-8 cqi model)](project_panel_sizing_cqi_model.md) — `--panel-ratio` composes role×context×authored
- [Panel UI kit + rail](project_panel_ui_kit_and_rail.md) — MUI→Radix ratchet · `--insp-*` undefined tokens · filter sizing · rail cell+panel pattern
- [Panel live-data plumbing](project_live_data_plumbing.md) — live ApiStore no measure-filter · request-volume debounce · store region-scoping
- [Page lifecycle workflow](project_page_lifecycle_workflow.md) — draft→publish, lifecycle slice, save-guard/403
- [Panel Playwright e2e](project_panel_playwright_e2e.md) — boot proof, keystone flow, idempotent-hydrate fix
- [Panel code-splitting](project_panel_code_splitting.md) — lazy boundaries + Rolldown vendor groups + expr bundler-agnostic env flag
- [Page-config schema-gen + panel i18n](project_page_config_schema_gen_and_panel_i18n.md) — gen:schema after schema edits; chrome-i18n {en,ka}+t()
- [Panel dev tooling conventions](project_dev_tooling_conventions.md) — eslint `_`-prefix/co-location · Storybook v10 trap · tsconfig constraints
- [Constructor architecture (state)](project_constructor_state.md) — Inspector/SchemaSource seam, registry pattern, byte-identical mandate

## i18n
- [i18n map](project_i18n_map.md) — AR-26 content contract · AR-37/39 full-sync+badges · ADR-019 catalog (RESOLVED) · Law-4 check semantics
- [i18n runtime wiring](project_i18n_runtime_wiring.md) — registerManifestI18n boot seam · accessible-name integrity class · useTSafe

## Theming, tokens, chart/table rendering
- [Semantic-token spine](project_semantic_token_spine.md) — 3-tier tokens, FF-TOKEN-ONLY/FF-TENANT-OVERRIDE gates
- [Dark-mode theming](project_dark_mode_theming.md) — dark=token-override completeness gates + tenant source-order cascade trap
- [Theming + typography](project_theming_and_typography.md) — data-theme seam · FiraGO platform default supersedes de-brand rule
- [Chart/table rendering](project_chart_table_rendering.md) — sequential palette · low-cardinality rule · DataTable band fill-chain · scrollbar SSOT

## Runner (apps/geostat)
- [Runner bootstrap + de-tenant](project_runner_bootstrap_and_detenant.md) — ADR-0026 manifest SSOT + ADR-0028 STRIP to a pure generic runner
- [Build/bundler gotchas](project_build_bundler_gotchas.md) — geostat lazy RendererSurface + store-builder eager-registration order · optional-peer Vite alias
- [Responsive audit roots](project_responsive_audit_systemic_roots.md) — 3 systemic roots fixed in-system; `--page-measure` seam
- [Portal review batch](project_portal_review_batch.md) — axis fmtNum/niceFloor/tooltip; brush LIVE-FIX (apex UMD-global + `_chartInstances`)

## Test/build infra
- [Windows long-path vitest block](project_windows_longpath_vitest_worktree_block.md) — MAX_PATH block workable via node_modules junctions
- [Test harness gotchas](project_test_harness_gotchas.md) — real plugin shells (i18next stub) · geostat runner render harness · react exportMenu hang
- [CSS fitness comment-strip gotcha](project_css_fitness_comment_stripping_gotcha.md) — block-scanning regexes MUST strip comments; `?raw` CSS-scan blind spot

## References
- [Dev-line panel :3013](reference_dev_line_panel_3013.md) — statdash-dev-panel-full; packages/* baked as SRC; tar-sync + Playwright drive
- [Render path / browser-verify](reference_render_path_browser_verify.md) — runner needs API; live :3002/:3003; fail-soft-is-itself-broken; LIVE render proof recipe
- [Panel dev notes](reference_panel_dev_notes.md) — /api/config contract · gate commands · `.css?raw` empty · node-vite remote-deploy layout

## Feedback — corrections & validated approaches
- [Contextual-relevance + legend taste](feedback_ui_craft_taste.md) — drill-in disclosure canon; chart legend contract (owner-blessed)
- [Radix jsdom polyfills](feedback_radix_jsdom_polyfills.md) — 4 polyfills a Radix listbox needs; native→Radix breaks fireEvent.change tests
- [Engine/react mock conventions](feedback_engine_react_mock_conventions.md) — nodeRegistry.register not registerSlice; keep shell vi.mock in sync with new engine imports
- [Line-ending discipline](feedback_line_endings.md) — Edit tool can flip an LF file to CRLF; verify + normalize before committing
- [icon token rendering](feedback_icon_token_rendering.md) — token→component via createElement in a .ts helper
- [Conform to engine types over spec text](feedback_conform_engine_types.md) — when a task spec contradicts a published engine type, the type wins
