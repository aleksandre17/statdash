# React-Specialist Memory Index

## Presentation / render-context architecture (ADR-0029 family)
- [Presentation projection registry](project_presentation_registry.md) — ADR-0029 v2: page presentation (color, crumbs) flows through a projector registry, renderer stays concern-free
- [Color single-home migration](project_color_single_home_migration.md) — presentation.color is color's only home; the v1→v2 migration chain's first real migrator
- [Frame system not a smell](project_frame_system_not_a_smell.md) — AppChrome data-frame is already OCP-clean via CSS attribute-selector cascade; a strategy registry was rejected as YAGNI
- [buildStaticContext not a smell](project_buildstaticcontext_not_a_smell.md) — per-field defaults are RenderContext infra, not an extensible concern; a field-default registry rejected YAGNI
- [Wire-contract floor](project_wire_contract_floor.md) — generatePageConfigSchema + registerNodeType injection; StructuralNode index-signature drift (F4)
- [No-privileged-node nav](project_no_privileged_node_nav.md) — nav-contributor/nav-transparent caps de-privilege navUtils; FF-NO-PRIVILEGED-NODE
- [Manifest contract version](project_manifest_contract_version.md) — describeApp() AppManifest gets SemVer contractVersion; schema $id/version derives from it
- [Variant style spine](project_variant_style_spine.md) — VariantDef/resolveVariants/variantAttrs seam; section hero+compact→emphasis enum; FF-NO-VARIANT-CLASS
- [Shell UI hooks shared](project_shell_ui_hooks_shared.md) — useCollapsible/useViewToggle/accentStyle/viewStateKey live in react engine/hooks, never a slice
- [Node template seam](project_node_template_seam.md) — useNodeTemplate/resolveNodeTemplate is the ONE canonical shell template-resolution seam
- [Disclosure + placement seams](project_disclosure_placement_seams.md) — useDisclosure (toggle) + mergePlacement (layout-item style merge) in react engine
- [De-tenant augmentation seam](project_detenant_augmentation_seam.md) — react/styles carry zero tenant content; generic PlatformXMap open via module augmentation
- [Extension points](project_extension_points.md) — VS Code contribution-points pattern (ExtensionRegistry/useExtensions); PANEL_TITLE_BADGE/SECTION_HEADER_ACTIONS

## Data / async render path
- [Async render warm-read](project_async_render_warm_read.md) — capability-transparent CachedStore + useNodeRows warm-then-sync-read Cache-Aside
- [KPI warm surface](project_kpi_warm_surface.md) — kpi-strip is a 2nd async-warm surface (interpretKpis, not useNodeRows); yoy year-1 warm
- [Time classifier never loaded](project_time_classifier_never_loaded.md) — time dim has NO classifier members on live stats path; latest-year only from observations
- [Charts neutral color seam](project_charts_neutral_color_seam.md) — charts interpreters emit literal-hex defaults, NOT cssVar; theming layers on in the plugin apex adapter

## Map / geo rendering
- [Declarative choropleth](project_declarative_choropleth.md) — geograph map is a data-derived d3-geo SVG choropleth (Leaflet retired); kills the hidden-container blank-map bug class
- [Container visible gate](project_container_visible_gate.md) — useContainerVisible gates DOM-measuring renderers on real layout; ApexRenderer is the live consumer (GeoMap's old Leaflet use was superseded)

## i18n / data integrity
- [AR-37 P0 locale binding](project_ar37_p0_locale_binding.md) — <html lang>/dir + i18next global bound at LocaleGuard; localeDirection registry
- [Integrity visible fold](project_integrity_visible_fold.md) — page data-integrity fold gates on NodeVisibilityContext; hidden view-toggle panels clear their report

## Build / test infrastructure
- [Worktree vitest MAX_PATH block](project_worktree_vitest_maxpath_block.md) — independent re-confirmation; see senior-frontend-developer's canonical writeup

## Feedback — corrections & validated approaches
- [Registry over special-case](feedback_registry_over_special_case.md) — generic renderers iterate a registry; concerns live in registered units, never renderer branches
- [Never git stash with uncommitted work](feedback_never_git_stash_with_uncommitted_work.md) — git stash reverts all in-flight edits; use git diff/show to inspect, never stash
