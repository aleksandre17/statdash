export type { KpiDef }                                           from './kpi'
export type {
  ColumnDef,
  RowSpec,
  DataSpec,
  TableConfig,
}                                                                from './data-spec'
export type { VisibilityExpr }              from './visibility'
export type { LinkIconKey, LinkDef }        from './links'
export { evalVisibility }                   from './visibility'
export { resolveTemplate }                  from './template'

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
  TimeModeItem,
  BarNode,
  ParamHiddenNode, ParamYearSelectNode, ParamCascadeNode, ParamSelectNode,
  ParamRangeNode, ParamMultiSelectNode, ParamChipSelectNode, ParamNode,
  FilterDerive,
  VarMap,
  FilterBarNode,
  OptionsDefault, DefaultSpec,
}                                                                from './filter'
export { evalCondition, evalWhen, evalValidatorPredicate, validators,
         autoParse, isVisible, isEnabled,
         validateField, applyCrossValidation, applyEffects,
         evalFilterDerive,
         resolveDefaults, validateCascadeValues }                from './filter'

// ── ParamDef authoring-schema registry [V0] ───────────────────────────────────
//  The Constructor's page-level FilterSchema control vocabulary: each ParamDef
//  type CARRIES its authoring PropSchema (registered via the param-schemas
//  module-init side-effect below), resolved through the generic Inspector. The
//  registry mirrors the transform-step schema registry, one rung down (a ParamDef
//  instead of a TransformStep). The registration side-effect (import of
//  './param-schemas') is owned by the package index (src/index.ts), mirroring how
//  the transform-step registry's built-ins are registered from data/transform.
export { registerParamSchema, getParamSchema, listParamSchemas } from './param-schema-registry'