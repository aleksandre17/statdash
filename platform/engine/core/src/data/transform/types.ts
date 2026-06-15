import type { DimVal, FilterValue, CtxRef }   from '../../sdmx'
import type { EngineRow }                       from '../encoding'

// ── RawRow — typed data row (Phase 2.1: alias to EngineRow) ──────────
export type RawRow = EngineRow

// ── DeriveExpr — JSON-serializable expression tree ────────────────────
//
//  Used by the 'derive' TransformStep to compute new fields without
//  writing functions. Analogous to Vega-Lite calculate transform.
//  100% JSON-serializable — config-compatible.
//
//  Arithmetic example — compute share %:
//    { op: 'mul',
//      a: { op: 'div', a: { op: 'field', field: 'value' },
//                      b: { op: 'field', field: 'total' } },
//      b: { op: 'literal', value: 100 } }
//
//  Boolean/conditional example — flag carry-forward rows:
//    { op: 'if',
//      cond: { op: 'and',
//        a: { op: 'eq',  a: { op: 'field', field: 'side'   }, b: { op: 'literal', value: 'R' } },
//        b: { op: 'gt',  a: { op: 'field', field: 'seqPos' }, b: { op: 'literal', value: 0  } } },
//      then: { op: 'literal', value: 1 },
//      else: { op: 'literal', value: 0 } }
//
//  String form (Vega-Lite calculate analogue):
//    "side == 'R' && seqPos > 0 ? 1 : 0"
//    "value / total * 100"
//    "!isClosing && order < 3 ? value : 0"
//
export type DeriveExpr =
  | { op: 'field';                        field: string              }  // row[field] — string or number
  | { op: 'literal';                      value: number | string     }  // constant
  | { op: 'add' | 'sub' | 'mul' | 'div'; a: DeriveExpr; b: DeriveExpr }  // arithmetic; div by 0 → 0
  | { op: 'abs' | 'neg';                  a: DeriveExpr              }  // unary arithmetic
  | { op: 'eq'  | 'neq';                  a: DeriveExpr; b: DeriveExpr }  // equality; compares raw (string-safe)
  | { op: 'gt'  | 'gte' | 'lt' | 'lte';  a: DeriveExpr; b: DeriveExpr }  // numeric ordering
  | { op: 'and' | 'or';                   a: DeriveExpr; b: DeriveExpr }  // logical; 0 = false
  | { op: 'not';                           a: DeriveExpr              }  // logical not; 0 = false
  | { op: 'if'; cond: DeriveExpr; then: DeriveExpr; else: DeriveExpr }  // ternary; cond 0 = false

// ── TransformStep — discriminated union of pipeline operations ────────
export type TransformStep =
  /**
   * melt — Wide → Long transform (pandas pivot_longer / Vega-Lite fold).
   * idFields stay as dimension columns.
   * valueFields become rows: { ...idDims, [seriesKey]: fieldName, [valueKey]: fieldValue }
   */
  | { op: 'melt';     idFields: string[]; valueFields: string[];
      seriesKey?: string; valueKey?: string }
  /** rename — Normalize field names (e.g. YEAR → time, REGION → geo). */
  | { op: 'rename';   fields: Record<string, string> }
  /** cast — Coerce field types. Most common: string years/values → numbers. */
  | { op: 'cast';     fields: Partial<Record<string, 'number' | 'string'>> }
  /**
   * filter — Keep rows where every condition holds (AND). Each condition is:
   *   - literal:   `time: 2024`           — exact match
   *   - array:     `geo: ['tbilisi', …]`  — IN
   *   - CtxRef:    `time: { $ctx: 'time' }` — resolved at apply-time from
   *                SectionContext; empty/missing context value = wildcard.
   */
  | { op: 'filter';   where: Record<string, FilterValue> }
  /**
   * sort — Sort rows by one or more fields (stable, multi-key).
   *
   * Single-field form (backward compatible):
   *   { op: 'sort', by: 'accountOrder', dir: 'asc' }
   *   { op: 'sort', by: 'side', using: ['R', 'U'] }     — explicit order, unlisted → last
   *
   * Multi-key form (array `by`):
   *   { op: 'sort', by: [
   *     { field: 'accountOrder', dir: 'asc' },
   *     { field: 'side',         using: ['R', 'U'] },
   *     { field: 'seqPos',       dir: 'asc', last: -1 },  — treat -1 as max (last)
   *     { field: 'isClosing',    dir: 'asc' },
   *   ] }
   *
   * `last` — value(s) sorted after everything else, regardless of dir.
   *          Useful for sentinel values like -1, 'other', 'total'.
   */
  | { op:     'sort'
      by:     string | ReadonlyArray<{
        field:  string
        dir?:   'asc' | 'desc'
        using?: readonly DimVal[]
        last?:  DimVal | readonly DimVal[]
      }>
      dir?:   'asc' | 'desc'    // single-field form only
      using?: readonly DimVal[] // single-field form only
    }
  /**
   * concat — Join multiple field values into a new string field.
   * Useful for stable composite keys or display labels.
   *
   *   Example: { op: 'concat', fields: ['account', 'measure', 'side'], as: '_id' }
   *   Result:  row._id = 'production-P1-R'
   */
  | { op: 'concat'; fields: string[]; as: string; sep?: string }
  /**
   * template — Render a string template into a new field.
   * {fieldName} is replaced by the row's field value. Literal braces: {{ }}.
   * Vega-Lite calculate / Grafana field rename analogue.
   *
   *   Example: { op: 'template', as: 'label', tpl: '{label} ({measure})' }
   *   Result:  row.label = 'გამოშვება (P1)'
   */
  | { op: 'template'; as: string; tpl: string }
  /** addField — Add a constant dimension field to every row. */
  | { op: 'addField'; name: string; value: DimVal }
  /** select — Keep only the listed fields (projection). */
  | { op: 'select';   fields: string[] }
  /**
   * derive — Compute a new field per row.
   *   expr — either a JSON expression tree (DeriveExpr) or a string formula
   *          like `'value / total * 100'`. String form supports field names,
   *          numeric literals, `+ - * /`, and parentheses.
   *   as / name — output field; `as` preferred (matches new pipe shape).
   */
  | { op: 'derive';   as?: string; name?: string; expr: DeriveExpr | string }
  /**
   * aggregate — GROUP BY + reduce. Two equivalent shapes:
   *
   *   Short form (one measure, common case):
   *     { op: 'aggregate', by: ['time', 'sector'], measure: 'value', agg: 'sum' }
   *
   *   Multi-measure form:
   *     { op: 'aggregate', groupBy: ['time'],
   *       aggregations: [{ field: 'value', op: 'sum' }, { field: 'pop', op: 'avg' }] }
   *
   * Rows are grouped by `by` (or `groupBy`); listed measures are reduced;
   * unlisted dims are aggregated over (collapsed). Vega-Lite analogue.
   */
  | { op: 'aggregate'
      by:      string[]
      measure: string
      agg:     'sum' | 'avg' | 'min' | 'max' | 'count'
      as?:     string
    }
  | { op: 'aggregate'
      groupBy:      string[]
      aggregations: { field: string; op: 'sum' | 'avg' | 'min' | 'max' | 'count'; as?: string }[]
    }
  /**
   * rollup — APPEND aggregate rows along one dim, preserving the original rows.
   * Cube.dev / OLAP "totals row" pattern. For each group (= unique values of
   * all dims except `dim` and `field`), emit one new row with the aggregated
   * `field` value and `dim` = `as`. Original rows are kept (unlike `aggregate`
   * which collapses).
   *
   *   dim   — which dimension column receives the rollup code
   *   as    — rollup code value to inject (e.g. 'total')
   *   of    — members included in the rollup ('*' = all distinct dim values)
   *   agg   — reduction operator
   *   field — measure column to aggregate (default: 'value')
   *
   * Example — add a 'total' row per (time, sector) summing all geos:
   *   { op: 'rollup', dim: 'geo', as: 'total', of: '*', agg: 'sum' }
   */
  | { op: 'rollup'
      dim:    string
      as:     DimVal
      of:     '*' | readonly DimVal[]
      agg:    'sum' | 'avg' | 'min' | 'max' | 'count'
      field?: string
    }
  /**
   * lookup — JOIN a codelist. Vega-Lite 'lookup' transform analogue
   * (SQL LEFT JOIN). For each row, look up row[key] in the codelist;
   * copy picked fields onto the row.
   *
   *   from: code-keyed dict — one of:
   *     - inline map: `{ tbilisi: { label, color }, … }`
   *     - display ref: `{ $d: 'geo' }`        (UI fields: label, color, …)
   *     - classifier ref: `{ $cl: 'geo' }`    (structural fields: code, parent)
   *     Refs are engine-resolved at apply time.
   */
  | { op: 'lookup'
      key:     string
      from:    DimRef | Record<string, Record<string, DimVal | undefined>>
      fields:  string[]
      rename?: Record<string, string>
    }
  /**
   * join — SQL LEFT JOIN against an array source. For each left row, find
   * the right row where right[onRight] === left[on]; merge fields onto left.
   *
   *   with     — right-hand source: dim ref (`{ $cl: 'geo' }` or `{ $d: 'geo' }`)
   *              or inline rows
   *   on       — column on the LEFT row carrying the join key
   *   onRight  — column on the RIGHT row carrying the join key. Default:
   *              'code' for dim refs; same as `on` for inline rows.
   *   fields   — fields to copy (default: all except the join key)
   *   rename   — optional source→target field rename
   *
   * Use `lookup` when the right side is already a code-keyed dict; use `join`
   * when you have an array (classifier items, display items, inline rows) and
   * want generic key-based merging without listing fields.
   */
  | { op: 'join'
      with:     DimRef | readonly Record<string, unknown>[]
      on:       string
      onRight?: string
      fields?:  string[]
      rename?:  Record<string, string>
    }
  /**
   * group — N-level hierarchy materializer. Pure tabular transform: agnostic
   * to the downstream renderer (chart, table, tree, map — does not matter).
   *
   * Scans already-sorted rows and injects a synthetic header row before each
   * new group at every dimension level. The op knows nothing about rendering;
   * it only materialises hierarchy metadata into the row stream.
   *
   * Analogues: pandas groupby + apply · AG Grid row grouping ·
   *            Observable Plot group transform · dbt ROLLUP.
   *
   * ⚠  Rows MUST be pre-sorted (outermost dimension first).
   *    Compose `sort` steps before `group` when needed.
   *
   * Fields added to EVERY output row:
   *   _level    — integer depth: injected headers 0…N-1, leaf data rows = N
   *               (rename via `levelField`)
   *   _parentId — id of the nearest injected ancestor row; undefined on roots
   *               (rename via `parentField`)
   *
   * Fields added to injected HEADER rows only:
   *   _isGroup  — 1 (truthy sentinel; downstream encodes to whatever it needs)
   *   _id       — deterministic composite key, stable across re-renders;
   *               source for child rows' _parentId
   *
   * inject.from — copy fields from the first member of the group onto the header
   *               { targetField: sourceField } — any fields, any names
   * inject.set  — literal overrides applied last (highest priority)
   *               booleans are stored as 1/0 to stay within RawRow (string|number)
   * inject.idFrom — which row field to use as the unique id source (default: field value)
   *
   * Example — 1-level (group products by category, inject category header):
   *   { op: 'group',
   *     by: [{ field: 'category',
   *             inject: { from: { name: 'categoryName', badge: 'categoryBadge' },
   *                       set:  { _isHeader: 1 } } }] }
   *
   * Example — 2-level (country → region → leaf row):
   *   { op: 'group',
   *     by: [
   *       { field: 'country', inject: { from: { name: 'countryName' } } },
   *       { field: 'region',  inject: { from: { name: 'regionName'  } } },
   *     ] }
   *
   * The injected _level / _parentId / _id fields are generic coordinates.
   * Encoding decides what to do with them — e.g. map _level → indent depth
   * in a table, or _isGroup → separator row in a chart. The pipe doesn't care.
   */
  | { op:          'group'
      by:          Array<{
        field:    string
        inject?:  {
          from?:   Record<string, string>            // { targetField: sourceField } copied from first member
          set?:    Record<string, DimVal | boolean>  // literal overrides; booleans stored as 1/0 in RawRow
          idFrom?: string                            // field to use for id generation (default: field value)
        }
      }>
      levelField?:  string   // output field name for depth (default: '_level')
      parentField?: string   // output field name for parent id (default: '_parentId')
      idPrefix?:    string   // prefix for generated ids (default: '_grp')
    }

// ── PipelineContext — services injected into pipe steps ───────────────
//
//  Placed here with the types it depends on.
//  Imported by both steps.ts and pipeline.ts.
//

import type { Classifier, DisplayMap } from '../../sdmx'
import type { DimRef }                 from '../../sdmx'
import type { SectionContext }         from '../../core/context'

/**
 * PipelineContext — services injected into pipe steps that need runtime
 * resolution. Opt-in: callers without these can still use steps that only
 * consume inline data.
 *
 *   classifiers — registry consulted by `lookup`/`join` `{ $cl }` refs.
 *   display     — UI overlay merged onto classifier entries at ref resolution.
 *   section     — SectionContext consulted by `filter` CtxRefs ({ $ctx: '…' }).
 */
export interface PipelineContext {
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
  section?:     SectionContext
}
