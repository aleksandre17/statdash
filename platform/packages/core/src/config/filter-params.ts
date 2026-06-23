// ── Filter Param Types ────────────────────────────────────────────────────────
//
//  Discriminated union of all filter control types, bar configuration,
//  and NodeDef-based variants (Constructor-ready).
//
//  Commercial platform references:
//    Grafana   — template variables (query · custom · textbox · constant)
//    AppSmith  — widget properties (show/hide · enable/disable · options)
//    Retool    — component config (options · validation · effects)
//    Builder.io — component visibility conditions + data bindings
//
//  Every new control type: add interface here → add renderer in FilterRenderers.tsx.
//  Zero other changes needed (registry pattern).
//

import type { WhenMap }                                from './filter-condition'
import type { LocaleString }                            from '../i18n/types'
import type { Validator }                              from './filter-validator'
import type { OptionsSource, ChipSource, YearsSource } from '../data/source'
import type { DimVal }                                 from '../sdmx'

// ── DefaultSpec — three-tier default value ────────────────────────────────────

/**
 * Tier 3 default: pick a value from this param's own options/years at runtime.
 * Resolves after options are loaded; `isLoading: true` while pending.
 */
export interface OptionsDefault {
  from:   'options'
  pick:   'first' | 'last'
  /** Which row field to use as value. Default: param's valueField ?? 'code'. */
  field?: string
}

/**
 * DefaultSpec — three-tier default value for any ParamDef.
 *
 * Runtime discrimination:
 *   null | string | number | boolean  → Tier 1 DimVal literal (backward-compatible)
 *   { from: 'options', pick }         → Tier 3 OptionsDefault
 *   any other object                  → Tier 2 ExprVal (evaluated via evalExpr)
 *
 * All three tiers are JSON-serializable. Constructor stores all three in DB.
 */
export type DefaultSpec = DimVal | OptionsDefault | Record<string, unknown>

// ── ParamMeta — shared base for every param type ─────────────────────────────

type ParamMeta = {
  /** Label shown before the control. */
  label?:       LocaleString
  /** Short text shown after the control (e.g. suffix annotation). */
  suffix?:      LocaleString
  /**
   * URL-serialised default value.
   *
   * Tier 1 (DimVal): literal string/number/boolean — backward-compatible.
   * Tier 2 (ExprVal): { op, left, right, … } — resolved via evalExpr at runtime.
   * Tier 3 (OptionsDefault): { from: 'options', pick: 'first'|'last' } — resolved
   *   after the param's options list is loaded.
   */
  default:      DefaultSpec
  hint?:        LocaleString
  description?: string
  /** Hide this control when the condition is false. */
  showWhen?:    WhenMap
  /** Disable this control when the condition is false. */
  enableWhen?:  WhenMap
  /** Fail validation when the value is empty. String = custom message. */
  required?:    boolean | string
  validate?:    Validator[]
}

// ── ParamDef discriminated union ──────────────────────────────────────────────

/** Hidden parameter — carries URL state, never rendered. */
export type ParamHidden = ParamMeta & {
  type: 'hidden'
}

/**
 * Year selector with optional year ↔ range toggle.
 *
 * Grafana: time range variable (from/to with quick ranges).
 * rangeKey references the hidden 'mode' param; when mode='range' the
 * selector renders as a range chip instead of a dropdown.
 * years: YearsSource — static list, DataStore query, or REST API.
 */
export type ParamYearSelect = ParamMeta & {
  type:        'year-select'
  /** Key of the hidden 'mode' param that controls year ↔ range toggle. */
  rangeKey?:   string
  /** Label shown when mode = 'range'. */
  rangeLabel?: string
  years?:      YearsSource
}

/**
 * Two-level hierarchical cascade select.
 *
 * Grafana: chained dependent variables (${level1} → ${level2}).
 * Serialised as comma-joined id path: "parentId,childId".
 * tree: CascadeNode[] — static only (Phase 1); Phase 2: query or api.
 */
export interface CascadeNode {
  id:        number
  value:     string
  children?: CascadeNode[]
}

export type ParamCascade = ParamMeta & {
  type:          'cascade'
  label:         string
  tree:          CascadeNode[]
  /** Placeholder labels for [level1, level2] dropdowns. */
  placeholders?: [string, string]
  /** Label for the "no selection / all" option. Tenant content — config-supplied. */
  allLabel?:     string
  /** If set, deepest selected node's code field → ctx.dims[dim]. Empty selection → '' (wildcard). */
  dim?:          string
  /** Field to read from node as the dim value. Defaults to 'code'. */
  dimField?:     string
}

/**
 * Single-value dropdown select.
 *
 * Grafana: custom variable (static) or query variable (DataStore / HTTP).
 * Retool/AppSmith: Select component.
 * options: OptionsSource — static · DataStore query · REST API.
 */
export type ParamSelect = ParamMeta & {
  type:       'select'
  label?:     string
  options:    OptionsSource
  /** Prepend an "all / none selected" option with value='' at the top of the list. */
  emptyLabel?: string
}

/**
 * Numeric range control (two inputs: from–to).
 *
 * Grafana: Slider variable (min / max / step).
 * Retool: NumberInput range pair.
 * Serialised as "from,to" string in URL state.
 */
export type ParamRange = ParamMeta & {
  type:  'range'
  label: string
  min?:  number
  max?:  number
  step?: number
  /** Unit suffix rendered after the inputs. */
  unit?: string
  /** Accessible labels for the from/to inputs. Tenant content — config-supplied. */
  fromLabel?: string
  toLabel?:   string
}

/**
 * Multi-value checkbox group.
 *
 * Grafana: multi-value template variable.
 * AppSmith: CHECKBOX_GROUP widget.
 * options: OptionsSource — same as ParamSelect.
 * Serialised as comma-joined values: "a,b,c" in URL state.
 */
export type ParamMultiSelect = ParamMeta & {
  type:    'multi-select'
  label:   string
  options: OptionsSource
}

/**
 * Horizontal chip strip — single-select with colored region badges.
 *
 * Grafana: ad-hoc filter variable (clickable tag chips).
 * Builder.io: Tag selector component.
 * options: ChipSource — supports colorField for per-option accent colors.
 * Phase 2 Constructor: always query or api — no hardcoded static arrays.
 */
export type ParamChipSelect = ParamMeta & {
  type:    'chip-select'
  options: ChipSource
  /** When true, clicking chips toggles inclusion in a comma-separated list instead of replacing the value. */
  multi?:  boolean
}

/** Discriminated union of all filter param types. */
export type ParamDef =
  | ParamHidden
  | ParamYearSelect
  | ParamCascade
  | ParamSelect
  | ParamRange
  | ParamMultiSelect
  | ParamChipSelect

// ── BarDef — one filter bar row ───────────────────────────────────────────────
//
//  A page may have multiple bars (e.g. time bar + dimension bar).
//  Each bar has its own position, layout, and filter controls.
//  Bars are ordered by `order`; rendered by FilterBar.tsx.
//
//  Grafana: each variable is placed in a row at top of the dashboard.
//  AppSmith: filter widgets are placed in a header container.
//

export interface TimeModeItem {
  id:    string
  label: string
}

export interface BarDef {
  /** CSS positioning of the filter-bar element. Default: 'sticky'. */
  position?:   'sticky' | 'float'
  /** Render order — lower numbers appear first. Default: 0. */
  order?:      number
  /**
   * Layout variant for this bar.
   * 'bar'   — fixed-height row (default, Grafana-style).
   * 'strip' — auto-height wrapping row (AppSmith header-style).
   */
  layout?:     'bar' | 'strip'
  /** Attach the year ↔ range time-mode toggle to this bar. */
  timeToggle?: boolean
  /** Custom time-mode labels — overrides default year/range. */
  timeModes?:  TimeModeItem[]
  /** Hide this bar when the condition is false — evaluated against raw filter state. */
  showWhen?:   WhenMap
  /** Filter controls belonging to this bar, keyed by param name. */
  filters:     Record<string, ParamDef>
}

/** Map of bar key → BarDef — top-level bar configuration. */
export type BarsConfig = Record<string, BarDef>

// ── FilterSchemaInput — page-level filter schema (canonical) ─────────────────
//
//  Source of truth for filter state. Owned by PageConfig, NOT by FilterBarNode.
//  FilterBarNode is a display-only placeholder that reads from FilterProvider.
//
//  Grafana: templating.list — variables live at dashboard level, not in panels.
//  Retool:  global variables — components bind to page-level state.
//

import type { CrossValidator, Effect } from './filter-validator'

export interface FilterSchemaInput {
  bars:           Record<string, BarDef>
  context?:       ContextMapping
  effects?:       Effect[]
  crossValidate?: CrossValidator[]
}

// ── ContextMapping — URL State → SectionContext bridge ────────────────────────
//
//  Declares which flat param keys populate the SectionContext used by
//  interpretSpec, interpretChart, interpretKpis.
//
//  timeMode → the param key whose value is 'year' | 'range'.
//  dims     → { dimName: paramKey } — maps context dimensions to param values.
//
//  Example: { timeMode: 'mode', dims: { time: 'year', geo: 'region' } }
//    raw['mode']   → ctx.timeMode
//    raw['year']   → ctx.dims['time']  (auto-parsed to number for year-select)
//    raw['region'] → ctx.dims['geo']
//

export interface ContextMapping<P = Record<string, unknown>> {
  timeMode: keyof P & string
  dims?:    Record<string, keyof P & string>
}

// ── NodeDef-based param types (Constructor-ready) ─────────────────────────────
//
//  Each variant = corresponding ParamDef + explicit `key: string`.
//  `key` was previously implicit (Record<string, ParamDef> map key).
//  Now explicit so each node is self-contained and portable in the tree.
//

export type ParamHiddenNode      = { type: 'hidden';       key: string } & Omit<ParamHidden,      'type'>
export type ParamYearSelectNode  = { type: 'year-select';  key: string } & Omit<ParamYearSelect,  'type'>
export type ParamCascadeNode     = { type: 'cascade';      key: string } & Omit<ParamCascade,     'type'>
export type ParamSelectNode      = { type: 'select';       key: string } & Omit<ParamSelect,      'type'>
export type ParamRangeNode       = { type: 'range';        key: string } & Omit<ParamRange,       'type'>
export type ParamMultiSelectNode = { type: 'multi-select'; key: string } & Omit<ParamMultiSelect, 'type'>
export type ParamChipSelectNode  = { type: 'chip-select';  key: string } & Omit<ParamChipSelect,  'type'>

export type ParamNode =
  | ParamHiddenNode
  | ParamYearSelectNode
  | ParamCascadeNode
  | ParamSelectNode
  | ParamRangeNode
  | ParamMultiSelectNode
  | ParamChipSelectNode

// ── BarNode — NodeDef-based bar row ──────────────────────────────────────────
//
//  Engine manifest: 'bar' → children: ['items']
//  Renderer: BarRenderer — renders one sticky/float filter bar row.
//  order controls sticky stacking: top = header + pageHeader + order * barHeight.
//

export interface BarNode {
  type:        'bar'
  id?:         string
  /** Hide this bar when the condition is false — evaluated against raw filter state. */
  showWhen?:   WhenMap
  position?:   'sticky' | 'float'
  order?:      number
  layout?:     'bar' | 'strip'
  timeToggle?: boolean
  /** When set, overrides the default year/range tab list. JSON-serializable. */
  timeModes?:  TimeModeItem[]
  items:       ParamNode[]
}
