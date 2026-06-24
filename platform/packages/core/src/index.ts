// ── @statdash/engine — Public API ──────────────────────────────────────
//
//  Pure TypeScript — zero React, zero side effects, fully testable.
//  Hexagonal Architecture: this is the "core" hexagon (domain + ports).
//
//  Import everything from this single entry point:
//    import { interpretSpec, type DataSpec } from '@statdash/engine'
//
//  Module structure:
//    core/         — error types + SectionContext + primitive types
//    sdmx.ts       — SDMX observation model (ISO 17369, leaf node)
//    data/         — DataStore, DataRow, interpretSpec, transform pipeline
//    field/        — FieldConfig display system (Grafana equivalent)
//    config/       — DataSpec, TableConfig, VisibilityExpr, KpiDef
//    validation/   — self-validating configs (Constructor-facing)
//    registry/     — EngineRegistry, SpecResolver (plugin system)
//

// ── Core ──────────────────────────────────────────────────────────────
export type { EngineErrorCode }                                          from './core/error'
export { EngineError }                                                   from './core/error'
// ── Diagnostic + Result<T> — typed error contract [N17] ───────────────
export type { DiagnosticLevel, Diagnostic, Result }                      from './core/diagnostic'
export { diagError, diagWarning, diagInfo, ok, err }                     from './core/diagnostic'
// ── Provenance — data quality + lineage record [N14] ──────────────────
export type { ObsStatus, ProvenanceRecord, MetadataPort }                from './core/provenance'
export { OBS_STATUS_LABELS }                                             from './core/provenance'
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
export type { FieldMeta, FieldType, FieldRole, FieldSchema }            from './data/fieldSchema'
export { deriveFieldSchema, toFieldMeta, schemasToFieldMeta,
         suggestEncodings }                                            from './data/fieldSchema'
export type { NodeDataFrame }                                           from './data/nodeDataFrame'

// ── Standard 1: Tidy Data + Transform Pipeline ────────────────────────
export type { RawRow, DeriveExpr, TransformStep, PipelineContext }      from './data/transform'
export { applyPipeline, applyStep, getFormatter, FORMATTERS, fmtNum }   from './data/transform'
// Transform-step registry — the Constructor's transform-op catalog (listTransformOps)
// + the plugin extension seam (registerTransformStep). Built-in ops registered via
// the './data/transform' side-effect above.
export type { StepFn }                                                  from './data/transform/step-registry'
export { registerTransformStep, getTransformStep, listTransformOps }   from './data/transform/step-registry'

// ── FieldConfig — Grafana-equivalent display configuration ────────────
export type { Threshold, ColorMode, FieldOverride, FieldConfig }        from './field/config'
export { formatFieldValue, resolveThresholdColor, resolveFieldConfig }  from './field/utils'

// ── Config Types ──────────────────────────────────────────────────────
export type { KpiDef }                                                   from './config/kpi'
export type {
  ColumnDef,
  RowSpec,
  DataSpec,
  TableConfig,
}                                                                        from './config/data-spec'
export type { VisibilityExpr }              from './config/visibility'
export type { LinkIconKey, LinkDef }        from './config/links'
export { evalVisibility }                   from './config/visibility'
export { resolveTemplate }                  from './config/template'

// ── Config Schema Versioning [N19 / P3-3] ────────────────────────────
//  Stored page configs carry a `schemaVersion`. migratePageConfig() forward-
//  migrates a raw JSONB blob from its stored version to CURRENT_SCHEMA_VERSION
//  before the renderer sees it (lazy migration on read). registerMigration()
//  is the extension seam: bump CURRENT_SCHEMA_VERSION + register a step.
export type { MigrationFn }                                              from './config/migration'
export { CURRENT_SCHEMA_VERSION, migratePageConfig, isCurrentSchema,
         registerMigration, highestMigrationVersion }                   from './config/migration'

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
export type { DataStore, Requirement, StoreQuery, StoreCaps,
              QueryResult, ResultMeta, Unsubscribe }                   from './data/store'
export { staticStore, storeVal, storeObs, storeSchema, runBatch, asyncFromSync }    from './data/store'
export type { ExternalStoreOptions }                                   from './data/store-impl'
export { ExternalStore, CachedStore }                                  from './data/store-impl'
export type { RawObsRow }                                              from './data/store-api'
export { ApiStore }                                                    from './data/store-api'
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
export { validateDataSpec }                                             from './validation/pipeline'
// ── Structural config validator — wire-contract floor (P-1, ADR §7) ───
//  The SAME structural validator apps/api (save) + packages/react (render)
//  share. Returns ValidationError[] ([] === valid); never throws.
export type { StructuralNode, StructuralPageConfig }                    from './validation/config'
export { validateConfig }                                              from './validation/config'
// ── Shared accept/reject corpus (fitness F1 SSOT, ADR §7.8) ────────────
//  The labelled VALID/INVALID config corpus. Exported from the engine so the
//  apps/api save-guard contract test and the react pre-render gate reuse the
//  SAME samples that pin validateConfig here — one corpus, three faces, no
//  copy-drift (they all run one validator).
export type { ValidCase, InvalidCase }                                 from './validation/config-corpus'
export { VALID_CONFIGS, INVALID_CONFIGS, CORPUS_KNOWN_TYPES,
         corpusAllTypes }                                              from './validation/config-corpus'

// ── Registry — Strategy + Plugin Pattern ─────────────────────────────
export type { SpecResolver }                                           from './registry/engine'
export { EngineRegistry, defaultRegistry }                             from './registry/engine'
// ── Node-type registry — derived placeable-type SET (ADR §7.3) ────────
//  Fail-open when empty; populated at startup by react's register-all so
//  validateConfig can enforce `type ∈ known set`. Core holds NO hardcoded list.
export { registerNodeType, knownNodeTypes, hasNodeType,
         _resetNodeTypes }                                             from './registry/nodeTypes'
export type { DiagnosticObserver }                                     from './registry/diagnostics'
export { setDiagnosticObserver, emitDiagnostic }                       from './registry/diagnostics'

// ── Scope Override — per-panel context override + merge [N37] ────────
export type { ScopeOverride }                                           from './data/scopeOverride'
export { mergeScope }                                                   from './data/mergeScope'

// ── Core Resolvers ────────────────────────────────────────────────────
export type { SpecResolveObserver }                                     from './data/spec'
export { interpretSpec, extractRequirements, setSpecResolveObserver }  from './data/spec'
export { interpretKpis }                                                from './data/kpi'
export type { KpiSpec, KpiValueSpec, KpiTrendSpec }                     from './data/kpi'

// ── Metric registry [N26] — Constructor metric vocabulary + extension seam ──
export type { MetricDef }                                               from './data/metric'
export { registerMetric, getMetric, listMetrics, listMetricDefs,
         withMetricProvenance }                                         from './data/metric'

// ── Export formats [N16] — registry + built-ins (csv, sdmx-json) ──────
//  Re-exporting the barrel also runs its side-effect: the csv / sdmx-json
//  formats register themselves on import, so listExportFormats() is non-empty.
export type { ExportMeta, SerializeFn, ExportFormat, ExportFormatId }   from './data/export'
export { registerExport, getExportFormat, listExportFormats }          from './data/export'

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

// ── FilterDerive ops → @statdash/expr plugin registration ─────────────
//
//  FilterDerive ops (find, breadcrumbs, join-labels, …) are domain-specific.
//  Registering them here keeps @statdash/expr zero-dep while making them
//  available in any VarMap evaluated via evalExpr().
//  scope.ctx carries { classifiers, display, raw } injected by SiteRenderer.
//
import { registerExprOp }  from '@statdash/expr'
import type { ExprScope }  from '@statdash/expr'
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