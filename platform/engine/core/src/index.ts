// ── @geostat/engine — Public API ──────────────────────────────────────
//
//  Pure TypeScript — zero React, zero side effects, fully testable.
//  Hexagonal Architecture: this is the "core" hexagon (domain + ports).
//
//  Import everything from this single entry point:
//    import { interpretSpec, type DataSpec } from '@geostat/engine'
//
//  Module structure:
//    core/         — error types + SectionContext + primitive types
//    sdmx.ts       — SDMX observation model (ISO 17369, leaf node)
//    data/         — DataStore, DataRow, interpretSpec, transform pipeline
//    field/        — FieldConfig display system (Grafana equivalent)
//    chart/        — ChartDef, ChartOutput neutral format, interpretChart
//    config/       — DataSpec, TableConfig, VisibilityExpr, KpiDef
//    validation/   — self-validating configs (Constructor-facing)
//    registry/     — EngineRegistry, SpecResolver, ChartInterpreter (plugin system)
//

// ── Core ──────────────────────────────────────────────────────────────
export type { EngineErrorCode }                                          from './core/error'
export { EngineError }                                                   from './core/error'
export type { ModeId, TimeMode, Unit, ChartType, Indicator, SectionContext } from './core/context'
export { groupBySpan }                                                   from './core/layout'
export type { DataLookupOp, DeriveEntry, NodeDeriveMap }                from './core/types'
export { evalNodeDerive }                                                from './core/evalNodeDerive'

// ── Mode System ───────────────────────────────────────────────────────
export type { ModeDef, ModeContext }                                     from './mode/types'
export { modeRegistry }                                                  from './mode/registry'

// ── Standard 2: SDMX Observation Model (ISO 17369) ───────────────────
export type { DimVal, CtxRef, FilterValue, NeRef, NeCtxRef, Observation, ObsQuery } from './sdmx'

// ── Kimball Classifier — per-dim surrogate-key codelist + hierarchy edges ──
export type { ClassifierEntry, Classifier, ClassifierRef, ClassifierView,
              DisplayMap, DisplayRef, DimRef, DataBundle } from './sdmx'
export { codelistOf, itemsOf, leavesOf, rollupsOf, codesOf,
         isClassifierRef, isDisplayRef, isDimRef,
         resolveClassifierRef, resolveDisplayRef, resolveDimRef } from './data/codelist'

// ── DataSource — universal options/years/chips abstraction ───────────
export type {
  SelectOption, ChipOption,
  StaticSource, QuerySource, ApiSource, RemoteSource,
  SelectFieldMap, ChipFieldMap, YearsFieldMap,
  OptionsSource, ChipSource, YearsSource,
}                                                                        from './data/source'
export { resolveYears, resolveOptions, resolveChips }                    from './data/resolve'

// ── Standard 3: Grammar of Graphics — Vega-Lite Encoding ─────────────
export type { EngineRow, EncodingSpec, DataRow }                         from './data/encoding'
export { applyEncoding }                                                 from './data/encoding'

// ── Standard 1: Tidy Data + Transform Pipeline ────────────────────────
export type { RawRow, DeriveExpr, TransformStep, PipelineContext }      from './data/transform'
export { applyPipeline, applyStep, getFormatter, FORMATTERS, fmtNum }   from './data/transform'

// ── FieldConfig — Grafana-equivalent display configuration ────────────
export type { Threshold, ColorMode, FieldOverride, FieldConfig }        from './field/config'
export { formatFieldValue, resolveThresholdColor, resolveFieldConfig }  from './field/utils'

// ── Chart System — neutral rendering format ───────────────────────────
export type {
  ChartDef,
  AxisConfig,
  LegendConfig,
  TooltipConfig,
  ChartOutput,
  ChartGroup,
  ChartSeries,
  ChartDataPoint,
  AxisOutput,
  LegendOutput,
  TooltipOutput,
  AnnotationOutput,
}                                                                        from './chart/types'
export { interpretChart, placeholderOutput, setChartRegistry }          from './chart/engine'

// ── Config Types ──────────────────────────────────────────────────────
export type { KpiDef }                                                   from './config/kpi'
export type {
  ColumnDef,
  RowSpec,
  DataSpec,
  TableConfig,
  VisibilityExpr,
  LinkIconKey,
  LinkDef,
}                                                                        from './config/section'
export { resolveTemplate, evalVisibility } from './config/section'

// ── Filter Schema — declarative filter config types + evaluators ──────
export type {
  CascadeNode,
  Condition, WhenMap,
  ValidatorPredicate, Validator, CrossValidator,
  Effect,
  ParamHidden, ParamYearSelect, ParamCascade, ParamSelect,
  ParamRange, ParamMultiSelect, ParamChipSelect, ParamDef,
  BarDef, BarsConfig,
  ContextMapping,
  FilterSchemaInput,
  // NodeDef-based filter types
  TimeModeItem,
  BarNode,
  ParamHiddenNode, ParamYearSelectNode, ParamCascadeNode, ParamSelectNode,
  ParamRangeNode, ParamMultiSelectNode, ParamChipSelectNode, ParamNode,
  FilterDerive,
  VarMap,
  FilterBarNode,
  // DefaultSpec — three-tier default value
  OptionsDefault, DefaultSpec,
  // Observability seam
  FilterDeriveObserver,
}                                                                        from './config/filter'
export { evalCondition, evalWhen, evalValidatorPredicate, validators,
         autoParse, isVisible, isEnabled,
         validateField, applyCrossValidation, applyEffects,
         evalFilterDerive, setFilterDeriveObserver,
         resolveDefaults, validateCascadeValues }                        from './config/filter'

// ── Repository Pattern — DataStore ────────────────────────────────────
export type { DataStore, Requirement, ExternalStoreOptions,
              StoreQuery, StoreCaps }                                    from './data/store'
export { staticStore, ExternalStore, ApiStore, CachedStore,
         storeVal, storeObs, runBatch }                                 from './data/store'
export type { DatasourceInstanceConfig }                                from './data/datasource'
export type { AggOp, AggregationRule }                                  from './data/aggregate'
export { groupAggregate }                                               from './data/aggregate'

// ── Validation Pipeline ───────────────────────────────────────────────
export type {
  ValidationSeverity,
  ValidationCode,
  ValidationError,
  ValidationResult,
}                                                                        from './validation/types'
export { validateDataSpec, validateChartDef }                           from './validation/pipeline'

// ── Registry — Strategy + Plugin Pattern ─────────────────────────────
export type { SpecResolver, ChartInterpreter }                         from './registry/engine'
export { EngineRegistry, defaultRegistry }                             from './registry/engine'
export type { DiagnosticObserver }                                     from './registry/diagnostics'
export { setDiagnosticObserver }                                       from './registry/diagnostics'

// ── Core Resolvers ────────────────────────────────────────────────────
export type { SpecResolveObserver }                                     from './data/spec'
export { interpretSpec, extractRequirements, setSpecResolveObserver }  from './data/spec'
export { interpretKpis }                                                from './data/kpi'
export type { KpiSpec, KpiValueSpec, KpiTrendSpec }                     from './data/kpi'

// ── DataLinks — declarative drill-down / navigation ───────────────────
export type { DataLinkDef, DataLinkParam, ResolvedLink }                from './links'
export { resolveDataLinks }                                              from './links'

// ── I18n Primitives ───────────────────────────────────────────────────
export type { LocaleString }                                             from './i18n/types'
export { resolveLocaleString, resolveLabel }                             from './i18n/types'
export type { LocaleFormatter }                                          from './i18n/format'
export { formatterRegistry }                                             from './i18n/format'

// ── Spec Capability Catalog — Self-Describing Module (Panel / Constructor) ─
export type { SpecField, SpecDescriptor }  from './spec-catalog'
export { SPEC_CATALOG }                    from './spec-catalog'

// ── Engine Bootstrap ──────────────────────────────────────────────────
//
//  Wires defaultRegistry to interpretChart — must run after all modules load.
//  The side effect imports in data/spec.ts handle resolver/interpreter registration.
//
import { setChartRegistry } from './chart/engine'
import { defaultRegistry as _reg } from './registry/engine'
setChartRegistry(_reg)

// ── FilterDerive ops → @geostat/expr plugin registration ─────────────
//
//  FilterDerive ops (find, breadcrumbs, join-labels, …) are domain-specific.
//  Registering them here keeps @geostat/expr zero-dep while making them
//  available in any VarMap evaluated via evalExpr().
//  scope.ctx carries { classifiers, display, raw } injected by SiteRenderer.
//
import { registerExprOp }  from '@geostat/expr'
import type { ExprScope }  from '@geostat/expr'
import type { FilterDerive, DeriveContext } from './config/filter'
import { evalFilterDerive } from './config/filter'

type _SiteCtx = { classifiers?: DeriveContext['classifiers']; display?: DeriveContext['display']; raw?: Record<string, string> }

const _FILTER_DERIVE_OPS = ['lookup', 'find', 'tree-field', 'if-else', 'breadcrumbs', 'contains', 'join-labels'] as const

for (const op of _FILTER_DERIVE_OPS) {
  registerExprOp(op, (expr: Record<string, unknown>, scope: ExprScope): unknown => {
    const siteCtx = scope.ctx as _SiteCtx | undefined
    return evalFilterDerive(
      expr as unknown as FilterDerive,
      scope.dims,
      siteCtx?.raw ?? {},
      { classifiers: siteCtx?.classifiers, display: siteCtx?.display },
    )
  })
}