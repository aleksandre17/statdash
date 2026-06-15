// ── Component styles ──────────────────────────────────────────────────
//  Imported here so any app using @geostat/react gets the component CSS
//  automatically — no separate CSS import needed in the app entry.
import './styles/index.css'

// ── @geostat/react — Public API ───────────────────────────────────────
//
//  React adapter — headless components consuming @geostat/engine.
//  Hexagonal Architecture: this is the "adapter" layer (ports → React).
//
//  Import everything from this single entry point:
//    import { Page, defineFilters, type PageDef } from '@geostat/react'
//

// ── Engine config vocabulary — re-exported so app layer imports from ONE place ─
//
//  App layer (src/features/**) should import everything from '@geostat/react'.
//  Direct '@geostat/engine' imports in feature configs are an anti-pattern:
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
  KpiDef, ChartDef, FieldConfig,
  // Methodology-link primitives (live: consumed by the `links` panel plugin)
  LinkDef, LinkIconKey,
  // Data types
  DataRow, DataStore,
}                                                                        from '@geostat/engine'
export type { KpiSpec }                                                  from '@geostat/engine'

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
}                                                              from '@geostat/engine'
export { validators, evalFilterDerive }                        from '@geostat/engine'

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
  useLocale, useI18n, useFmt, useResolveLocale, useT,
  useChromeConfig,
}                                                                  from './context/SiteContext'
export type {
  SiteProviderProps, NavEntry, I18nConfig,
  ChromeConfig, SocialLinkDef, FooterLinkDef,
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

// ── Filter input components ────────────────────────────────────────────
export { default as CascadeSelect }      from './components/filters/CascadeSelect'

// ── Shared UI primitives ──────────────────────────────────────────────
export { LINK_ICONS, InfoIcon, ChevronIcon } from './components/icons'