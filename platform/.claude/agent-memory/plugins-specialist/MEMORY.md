# Memory Index

## Project
- [Chrome slot addition gotchas](chrome_slot_addition_gotchas.md) — inline slots not in provisioning (AppHeader `<ChromeSlot>` embed); ChromeConfig F1-locked; schema-less needs CHROME_EXEMPT + hard `.size` bump; theme-switcher useTheme persist
- [Layout-node composition](layout_node_composition.md) — nav-transparent cap req for section-wrapping containers, page-config.schema.json is generated (gen:schema), page body = stack, one grid primitive, layered fill chain
- [Apex responsive yaxis formatter drop](apex_responsive_yaxis_formatter_drop.md) — Apex responsive yaxis overrides drop labels.formatter → raw floats; re-carry via responsiveYAxis() in base.ts
- [Apex theme participation](apex_theme_participation.md) — F5: chart chrome reads tokens (foreColor getter + isDarkTheme luminance) + re-renders on [data-theme] flip via useThemeVersion key on Chart.tsx render wrapper
- [Panel App Setup](project_panel_setup.md) — React Admin v5 scaffold in apps/panel; pre-existing engine TS debt
- [CAPS consumer wired](project_caps_consumer.md) — getGroupedPaletteEntries() in paletteEntries.ts consumes getByCapability(CAPS.*); dead-seam closed

## Project (continued)
- [CommandBus migration](project_commandbus_migration.md) — GeorgraphShell + ExportBar panel shells migrated; controls use useFilter() not ctx — see file for why

## Project (continued)
- [Shell render testing](project_shell_render_testing.md) — jsdom-render a plugin shell in plugins vitest (mock @statdash/react, real GlobalStateProvider)
- [Chart LocaleString boundary](chart_localestring_boundary.md) — resolve chart config bilingual fields in useChartOutput (resolveChartDefLocale) before interpretChart; jsdom can't catch ApexCharts text leaks → chartApexLocale.fitness guard
- [Chart-fill leaf band](chart_fill_leaf_band.md) — band reaches .chart-wrap via WrapStyleContext (transparent wrap → data-aspect on the LEAF); fix = base.ts parentHeightOffset:0 + node-styles leaf growable-band so a vbar fills a stretched equal-height card

## Feedback
- [Node env test imports](feedback_node_env_test_imports.md) — @geostat/react sub-path + @geostat/engine fail in @vitest-environment node; test pure utils only
