# React-Specialist Memory Index

## Feedback — corrections & validated approaches
- [registry over special-case](feedback_registry_over_special_case.md) — generic renderers iterate a registry; concerns live in registered units, never renderer branches
- [never git stash with uncommitted work](feedback_never_git_stash_with_uncommitted_work.md) — git stash reverts all in-flight edits; use git diff/show to inspect, never stash

## Project
- [presentation projection registry](project_presentation_registry.md) — ADR-0029 v2 seam: page presentation flows through a projector registry
- [color single-home migration](project_color_single_home_migration.md) — presentation.color is color's only home; first real v1→v2 migrator; flat PageConfigBase.color removed
- [de-tenant augmentation seam](project_detenant_augmentation_seam.md) — react/styles carry zero tenant content; generic PlatformXMap open via module augmentation, /geostat/i fitness guard
- [frame system not a smell](project_frame_system_not_a_smell.md) — AppChrome data-frame is already OCP-clean via CSS attribute-selector cascade; a frame-strategy registry rejected as YAGNI
- [buildStaticContext not a smell](project_buildstaticcontext_not_a_smell.md) — per-field defaults are RenderContext infra (not extensible concerns); color/crumbs already route via registry; field-default registry rejected YAGNI
- [wire-contract floor](project_wire_contract_floor.md) — generatePageConfigSchema + emitted page-config.schema.json + registerNodeType injection in registerSlice; StructuralNode index-sig drift (F4)
- [no-privileged-node nav](project_no_privileged_node_nav.md) — nav-contributor/nav-transparent caps + NavContribution descriptor de-privilege navUtils; card.css → @statdash/styles; AnchorNavContext/DefaultPassthroughShell renames; FF-NO-PRIVILEGED-NODE
- [manifest contract version](project_manifest_contract_version.md) — describeApp() AppManifest gets SemVer contractVersion (CONTRACT_VERSION SSOT); schema $id/version derived; constructor.fitness locks capability surface
- [variant style spine](project_variant_style_spine.md) — VariantDef/resolveVariants/variantAttrs seam; section hero+compact→emphasis enum data-attr; styleKeys SSOT; nodeSchemaWithVariants fold; v3→v4 migrator; FF-NO-VARIANT-CLASS
- [shell UI hooks shared](project_shell_ui_hooks_shared.md) — useCollapsible/useViewToggle/accentStyle/viewStateKey live in react engine/hooks (not section slice); useViewToggle de-section-ed via keyNamespace param; sibling-scan verdicts
- [node template seam](project_node_template_seam.md) — useNodeTemplate/resolveNodeTemplate is the ONE canonical shell template-resolution seam; canonical {...filterParams,...vars} merge; no shell hand-rolls merge/`{`-guard
- [disclosure + placement seams](project_disclosure_placement_seams.md) — useDisclosure (minimal toggle) + mergePlacement (typed layout-item style merge) in react engine; resolveNodeTemplate string-input overload kills title! assertion
- [charts neutral color seam](project_charts_neutral_color_seam.md) — charts interpreters emit literal-hex defaults (charts/src/colors.ts), NOT cssVar; theming layered on by plugin apex adapter
- [async render warm-read](project_async_render_warm_read.md) — capability-transparent CachedStore + useNodeRows warm-then-sync-read Cache-Aside binds async-store rows through renderNode; bind queryAsync to store
- [kpi warm surface](project_kpi_warm_surface.md) — kpi-strip is a 2nd async-warm surface (interpretKpis, not useNodeRows); useKpiRows + extractKpiRequirements warm it incl. yoy year-1; CachedStore.queryAsync in-flight dedup
- [time classifier never loaded](project_time_classifier_never_loaded.md) — time dim has NO classifier members on live stats path; {$cl:'time'} year defaults resolve [] forever; latest-year only from observations
- [container visible gate](project_container_visible_gate.md) — useContainerVisible (react engine/hooks) gates DOM-measuring renderers on real layout; ApexRenderer first consumer, fixes hidden-view NaN crash


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [expr-dist-missing](project_expr_dist_missing.md) — @geostat/expr has no dist/ build; resolveNodeRows.test.ts pre-existing failure
- [extension-points](project_extension_points.md) — Architecture 3 typed extension registry (VS Code pattern) complete; 3 pre-existing i18next test failures unrelated

## Auto-relocated (memory-home-guard — reconcile into a topic section)
- [AR-37 P0 locale binding](project_ar37_p0_locale_binding.md) — <html lang>/dir + i18next global bound at LocaleGuard; localeDirection registry in packages/react; FF-HTML-LANG-BOUND
- [worktree vitest MAX_PATH block](project_worktree_vitest_maxpath_block.md) — vitest CLI startup-blocked in deep .claude/worktrees paths on Windows (env, not code); tsc/eslint/check-laws unaffected; hand-replicate logic in .mjs for signal
