// ── Filter Schema — public barrel ────────────────────────────────────────────
//
//  Re-exports from focused sub-modules. All external imports of './config/filter'
//  (engine index.ts, tests, plugins) continue to work unchanged.
//
//  Sub-modules:
//    filter-condition.ts  — Condition, WhenMap, evalCondition, evalWhen
//    filter-validator.ts  — Validator, validators, CrossValidator, Effect,
//                           applyCrossValidation, applyEffects
//    filter-params.ts     — CascadeNode, ParamDef union, BarDef, FilterSchemaInput,
//                           ContextMapping, NodeDef-based types
//    filter-derive.ts     — FilterDerive, DeriveContext, evalFilterDerive,
//                           VarMap, FilterBarNode
//    filter-eval.ts       — autoParse, isVisible, isEnabled, validateField
//

export type { Condition, WhenMap }                    from './filter-condition'
export { evalCondition, evalWhen }                    from './filter-condition'

export type { ValidatorPredicate, Validator, CrossValidator, Effect } from './filter-validator'
export { evalValidatorPredicate, validators,
         applyCrossValidation, applyEffects }         from './filter-validator'

export type {
  CascadeNode,
  ParamHidden, ParamYearSelect, ParamCascade, ParamSelect,
  ParamRange, ParamMultiSelect, ParamChipSelect, ParamDef,
  BarDef, BarsConfig,
  FilterSchemaInput, ContextMapping,
  ParamHiddenNode, ParamYearSelectNode, ParamCascadeNode, ParamSelectNode,
  ParamRangeNode, ParamMultiSelectNode, ParamChipSelectNode, ParamNode,
  BarNode,
  OptionsDefault, DefaultSpec,
}                                                     from './filter-params'

export type { FilterDerive, DeriveContext,
              VarMap, FilterBarNode,
              FilterDeriveObserver }                  from './filter-derive'
export { evalFilterDerive,
         setFilterDeriveObserver }                    from './filter-derive'

export { autoParse, isVisible, isEnabled,
         validateField, resolveDefaults,
         validateCascadeValues }                      from './filter-eval'
