// ── Component styles ──────────────────────────────────────────────────
//  Imported here so any app using @statdash/react gets the component CSS
//  automatically — no separate CSS import needed in the app entry.
import './styles/index.css'

// ── @statdash/react — Public API ───────────────────────────────────────
//
//  React adapter — headless components consuming @statdash/engine.
//  Hexagonal Architecture: this is the "adapter" layer (ports → React).
//
//  Import everything from this single entry point:
//    import { Page, defineFilters, type PageDef } from '@statdash/react'
//

// ── Engine config vocabulary — re-exported so app layer imports from ONE place ─
//
//  App layer (src/features/**) should import everything from '@statdash/react'.
//  Direct '@statdash/engine' imports in feature configs are an anti-pattern:
//  they couple app content to engine internals and break the hexagonal boundary.
//
//  data/ store files (ExternalStore, Observation) still import from engine —
//  they ARE the data layer, not the config layer. That coupling is intentional.
//
export type {
  // Core context
  ModeId, ModeDef, ModeContext, TimeMode, SectionContext, DimVal,
  // Config vocabulary
  DataSpec, ColumnDef, RowSpec, TableConfig, VisibilityExpr,
  KpiDef, FieldConfig,
  // Methodology-link primitives (live: consumed by the `links` panel plugin)
  LinkDef, LinkIconKey,
  // Data types
  DataRow, DataStore,
}                                                                        from '@statdash/engine'
export type { KpiSpec }                                                  from '@statdash/engine'

// ── Navigation types ──────────────────────────────────────────────────
export type { NavItemDef, NavSubItem, NavIconKey }               from './page'

// ── Filter system ─────────────────────────────────────────────────────
export { useFilterState }                                           from './filters/useFilterState'
export type {
  ParamDef, ParamHidden, ParamYearSelect, ParamCascade,
  ParamSelect, ParamRange, ParamMultiSelect, ParamChipSelect,
  ChipOption, SelectOption, OptionsSource, ChipSource, YearsSource,
  Validator, CrossValidator, Effect, Condition, WhenMap,
  CascadeNode, ContextMapping,
  FilterBarNode, BarNode, ParamNode, FilterDerive, VarMap,
  ParamHiddenNode, ParamYearSelectNode, ParamCascadeNode, ParamSelectNode,
  ParamRangeNode, ParamMultiSelectNode, ParamChipSelectNode,
}                                                              from '@statdash/engine'
export { validators, evalFilterDerive }                        from '@statdash/engine'

// ── Frame system — page frame provider + hook ─────────────────────────
export { FrameProvider, usePageFrame }  from './context/FrameContext'

// ── Chrome override — per-page chrome slot overrides ─────────────────
export { ChromeOverrideProvider, useChromeOverrides } from './context/ChromeOverrideContext'

// ── Chrome slot config — per-instance config via hooks ───────────────
export { useSlotConfig }                              from './context/ChromeSlotConfigContext'

// ── Site context — SiteProvider + hooks ──────────────────────────────
export {
  SiteProvider, SiteLocaleProvider,
  usePageStore, useStores, useStoreQuery,
  useSiteNav, useSiteChrome, useSitePages, usePageById,
  useLocale, useI18n, useFmt, useResolveLocale, useResolveLocaleSafe, useT,
  useChromeConfig,
}                                                                  from './context/SiteContext'
export type {
  SiteProviderProps, NavEntry, I18nConfig, ChromeConfig,
}                                                                  from './context/SiteContext'
export type { ChromeEntry, ChromeSlotConfig }                      from './engine/types'

// ── Page store context ────────────────────────────────────────────────
export { PageStoreProvider, useCurrentStore } from './context/PageStoreContext'

// ── Filter context ────────────────────────────────────────────────────
export { FilterProvider, useFilter } from './context/FilterContext'

// ── Mode context ──────────────────────────────────────────────────────
export { useModeContext, ModeProvider, useMode } from './context/ModeContext'

// ── Chart renderer registry — extension point for external chart types ──
export { chartRendererRegistry }   from './engine/ChartRendererRegistry'
export type { ChartRendererProps } from './engine/ChartRendererRegistry'

// ── Chart vocabulary — re-exported from @statdash/charts ───────────────
export type { ChartDef, ChartOutput } from '@statdash/charts'
export { interpretChart } from '@statdash/charts'

// ── Filter input components ────────────────────────────────────────────
export { default as CascadeSelect }      from './components/filters/CascadeSelect'

// ── Shared UI primitives ──────────────────────────────────────────────
export { LINK_ICONS, InfoIcon, ChevronIcon } from './components/icons'
// ── Layout primitives ─────────────────────────────────────────────────
export { PanelLayout, PANEL_LAYOUT }         from './components/PanelLayout'
export type { PanelLayoutProps }             from './components/PanelLayout'
// ── Feedback primitives ───────────────────────────────────────────────
export { EMPTY_STATE }                       from './components/feedback/EmptyState'
export type { EmptyStateProps }              from './components/feedback/EmptyState'
export { EXPORT_BAR }                        from './components/feedback/ExportBar'
export type { ExportBarProps }               from './components/feedback/ExportBar'
// ── UI component DI container (InjectionToken<T> pattern) ────────────
//  InjectionToken: typed DI key — token IS the type, no correlated-union cast.
//  Container: runtime DI container interface. MapContainer: concrete impl.
//  ContainerSetup: caller-supplied override function for NodePageRenderer.
export { InjectionToken }                    from './engine/di/InjectionToken'
export type { Container }                    from './engine/di/Container'
export { MapContainer }                      from './engine/di/Container'
// ── DI hook — stable component reference from Container ──────────────
export { useInject }                         from './engine/useInject'
// ── ContainerSetup — NodePageRenderer ui prop type ────────────────────
export type { ContainerSetup }               from './engine/SiteRenderer'
// ── Data integrity components [N14] ───────────────────────────────────
export { StatusBadge }                       from './components/data/StatusBadge'
// ── Chart accessibility [N15] ─────────────────────────────────────────
export { ChartDataTable }                    from './components/data/ChartDataTable'
// ── Extension point system ────────────────────────────────────────────
export { ExtensionPoint, createExtensionPoint } from './engine/extensions/ExtensionPoint'
export type { Contribution }                    from './engine/extensions/ExtensionPoint'
export { ExtensionRegistry }                    from './engine/extensions/ExtensionRegistry'
export { useExtensions }                        from './engine/extensions/useExtensions'
export { PANEL_TITLE_BADGE, SECTION_HEADER_ACTIONS } from './engine/extensions/points'
export type { PanelTitleHost, SectionActionHost }    from './engine/extensions/points'
// CommandBus — typed platform command dispatch
export type { PlatformCommandMap, CommandType, Command } from './engine/commands/commands'
export type { CommandBus, CommandHandler, CommandMiddleware } from './engine/commands/CommandBus'
// NOTE: DefaultCommandBus is intentionally NOT exported — consumers use ctx.bus (injection).
// Test harnesses import DefaultCommandBus from the internal path directly.