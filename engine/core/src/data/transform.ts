// ── Standard 1: Tidy Data (Hadley Wickham, 2014) ─────────────────────
//
//  Core rule: one observation = one row. Wide format is only acceptable
//  as external input — transform via 'melt' before any encoding.
//
//  TransformStep — declarative, JSON-serializable pipeline step.
//  A pipeline of steps mirrors Vega-Lite's 'transform' array.
//  100% plain objects — constructor/admin panel can generate these without code.
//
//  Implemented: applyStep() / applyPipeline() below.
//

import type { Classifier, CtxRef, DimRef, DimVal, DisplayMap, FilterValue } from '../sdmx'
import type { SectionContext }                                              from '../core/context'
import { isDimRef, resolveDimRef }                                          from './codelist'

// No trailing zeros, max `max` decimals, space thousands separator
export const fmtNum = (n: number, max = 1): string => {
  const abs = Math.abs(n), neg = n < 0 ? '-' : ''
  const s = abs.toFixed(max).replace(/\.?0+$/, '')
  const [i, d] = s.split('.')
  return neg + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + (d ? '.' + d : '')
}
const fmtMlnGel = (n: number) => fmtNum(n, 0)
const fmtSign   = (n: number) => `${n > 0 ? '+' : ''}${fmtNum(Math.abs(n), 1)}%`
const fmtPct    = (n: number) => `${fmtNum(Math.abs(n), 1)}%`
const fmtUSD    = (n: number) => `$\u00A0${fmtMlnGel(n)}`

// ── RawRow — untyped data row before encoding ─────────────────────────
export type RawRow = Record<string, DimVal>

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

// ── Formatter Registry ────────────────────────────────────────────────
//
//  JSON-serializable names → runtime functions.
//  EncodingSpec.seriesFormat references these by name.
//
export const FORMATTERS: Record<string, (n: number) => string> = {
  mln_gel:  fmtMlnGel,
  sign_pct: fmtSign,
  pct:      fmtPct,
  usd:      fmtUSD,
  number:   (n) => String(n),
  decimal1: (n) => fmtNum(n, 1),
  decimal2: (n) => fmtNum(n, 2),
  default:  (n) => fmtNum(n, 0),
}

export function getFormatter(name: string): (n: number) => string {
  return FORMATTERS[name] ?? FORMATTERS['default']
}

// ── Individual step implementations ───────────────────────────────────

function applyMelt(rows: RawRow[], step: Extract<TransformStep, { op: 'melt' }>): RawRow[] {
  const { idFields, valueFields, seriesKey = 'series', valueKey = 'value' } = step
  return rows.flatMap((row) => {
    const idPart = Object.fromEntries(idFields.map((f) => [f, row[f]]))
    return valueFields.map((field) => ({ ...idPart, [seriesKey]: field, [valueKey]: row[field] ?? 0 }))
  })
}

function applyRename(rows: RawRow[], step: Extract<TransformStep, { op: 'rename' }>): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = {}
    for (const [k, v] of Object.entries(row)) out[step.fields[k] ?? k] = v
    return out
  })
}

function applyCast(rows: RawRow[], step: Extract<TransformStep, { op: 'cast' }>): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = { ...row }
    for (const [field, targetType] of Object.entries(step.fields)) {
      if (!(field in out)) continue
      out[field] = targetType === 'number' ? Number(out[field]) : String(out[field])
    }
    return out
  })
}

function isCtxRef(v: unknown): v is CtxRef {
  return typeof v === 'object' && v !== null && '$ctx' in (v as object)
}

function applyFilter(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'filter' }>,
  ctx?: PipelineContext,
): RawRow[] {
  return rows.filter((row) =>
    Object.entries(step.where).every(([field, condition]) => {
      const val = row[field]
      // Resolve CtxRef against SectionContext.dims
      let resolved: FilterValue | DimVal | undefined = condition
      if (isCtxRef(condition)) {
        const cv = ctx?.section?.dims[(condition as CtxRef).$ctx]
        if (cv === '' || cv === null || cv === undefined) return true   // wildcard
        resolved = cv
      }
      if (typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved) && '$ne' in resolved)
        return val !== (resolved as { $ne: unknown }).$ne
      return Array.isArray(resolved)
        ? (resolved as DimVal[]).includes(val)
        : val === resolved
    }),
  )
}

type SortKey = { field: string; dir?: 'asc' | 'desc'; using?: readonly DimVal[]; last?: DimVal | readonly DimVal[] }

function applySort(rows: RawRow[], step: Extract<TransformStep, { op: 'sort' }>): RawRow[] {
  const keys: SortKey[] = typeof step.by === 'string'
    ? [{ field: step.by, dir: step.dir, using: step.using }]
    : step.by as SortKey[]

  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const av = a[key.field]
      const bv = b[key.field]

      // `last` sentinel — sorted unconditionally after all real values
      if (key.last !== undefined) {
        const lastVals = Array.isArray(key.last) ? key.last : [key.last]
        const aLast    = lastVals.some(l => String(l) === String(av))
        const bLast    = lastVals.some(l => String(l) === String(bv))
        if (aLast !== bLast) return aLast ? 1 : -1
      }

      // Explicit order via `using` (unlisted → last)
      if (key.using && key.using.length > 0) {
        const order = new Map(key.using.map((v, i) => [String(v), i]))
        const ai    = order.get(String(av)) ?? Infinity
        const bi    = order.get(String(bv)) ?? Infinity
        if (ai !== bi) return key.dir === 'desc' ? bi - ai : ai - bi
        continue
      }

      // Numeric comparison
      if (typeof av === 'number' && typeof bv === 'number') {
        if (av !== bv) return key.dir === 'desc' ? bv - av : av - bv
        continue
      }

      // String comparison
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      if (cmp !== 0) return key.dir === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

function applyConcat(rows: RawRow[], step: Extract<TransformStep, { op: 'concat' }>): RawRow[] {
  const sep = step.sep ?? '-'
  return rows.map(row => ({
    ...row,
    [step.as]: step.fields.map(f => String(row[f] ?? '')).join(sep),
  }))
}

function applyTemplate(rows: RawRow[], step: Extract<TransformStep, { op: 'template' }>): RawRow[] {
  return rows.map(row => ({
    ...row,
    [step.as]: step.tpl.replace(/\{(\w+)\}/g, (_, f: string) => String(row[f] ?? '')),
  }))
}

function applyAddField(rows: RawRow[], step: Extract<TransformStep, { op: 'addField' }>): RawRow[] {
  return rows.map((row) => ({ ...row, [step.name]: step.value }))
}

function applySelect(rows: RawRow[], step: Extract<TransformStep, { op: 'select' }>): RawRow[] {
  return rows.map((row) => Object.fromEntries(step.fields.map((f) => [f, row[f]])))
}

// ── Expression evaluator ──────────────────────────────────────────────

function evalExpr(expr: DeriveExpr, row: RawRow): number | string {
  // num: coerce branch result to number for arithmetic / ordering / logical ops
  const num = (e: DeriveExpr): number => { const v = evalExpr(e, row); return typeof v === 'number' ? v : Number(v) || 0 }
  const bool = (e: DeriveExpr): boolean => num(e) !== 0

  switch (expr.op) {
    case 'field':   return (row[expr.field] ?? 0) as number | string
    case 'literal': return expr.value
    case 'add':     return num(expr.a) + num(expr.b)
    case 'sub':     return num(expr.a) - num(expr.b)
    case 'mul':     return num(expr.a) * num(expr.b)
    case 'div': {   const d = num(expr.b); return d !== 0 ? num(expr.a) / d : 0 }
    case 'abs':     return Math.abs(num(expr.a))
    case 'neg':     return -num(expr.a)
    case 'eq':      return evalExpr(expr.a, row) === evalExpr(expr.b, row) ? 1 : 0
    case 'neq':     return evalExpr(expr.a, row) !== evalExpr(expr.b, row) ? 1 : 0
    case 'gt':      return num(expr.a) >  num(expr.b) ? 1 : 0
    case 'gte':     return num(expr.a) >= num(expr.b) ? 1 : 0
    case 'lt':      return num(expr.a) <  num(expr.b) ? 1 : 0
    case 'lte':     return num(expr.a) <= num(expr.b) ? 1 : 0
    case 'and':     return bool(expr.a) && bool(expr.b) ? 1 : 0
    case 'or':      return bool(expr.a) || bool(expr.b) ? 1 : 0
    case 'not':     return bool(expr.a) ? 0 : 1
    case 'if':      return bool(expr.cond) ? evalExpr(expr.then, row) : evalExpr(expr.else, row)
  }
}

// ── String expression parser — recursive descent ──────────────────────
//
//  Grammar (precedence low → high):
//    ternary    := or ('?' ternary ':' ternary)?
//    or         := and ('||' and)*
//    and        := comparison ('&&' comparison)*
//    comparison := additive (('==' | '!=' | '<' | '<=' | '>' | '>=') additive)?
//    additive   := unary (('+' | '-') unary)*
//    multiplicative := unary (('*' | '/') unary)*
//    unary      := ('!' | '-') unary | primary
//    primary    := '(' ternary ')' | field | number | 'string'
//
class ExprParser {
  private readonly tokens: string[]
  private pos = 0

  constructor(input: string) {
    // Tokenize: multi-char ops first, then string literals, numbers, identifiers, single chars
    this.tokens = input.match(/==|!=|<=|>=|&&|\|\||'[^']*'|\d+(?:\.\d+)?|[a-zA-Z_]\w*|[<>+\-*/()!?:]/g) ?? []
  }

  private peek(): string | undefined { return this.tokens[this.pos] }
  private consume(): string          { return this.tokens[this.pos++] }
  private expect(t: string): void {
    if (this.peek() !== t) throw new Error(`derive: expected '${t}', got '${this.peek() ?? 'end'}'`)
    this.consume()
  }

  parse(): DeriveExpr {
    const e = this.ternary()
    if (this.pos < this.tokens.length) throw new Error(`derive: unexpected '${this.peek()}'`)
    return e
  }

  private ternary(): DeriveExpr {
    const cond = this.or()
    if (this.peek() !== '?') return cond
    this.consume()
    const then = this.ternary()
    this.expect(':')
    return { op: 'if', cond, then, else: this.ternary() }
  }

  private or(): DeriveExpr {
    let l = this.and()
    while (this.peek() === '||') { this.consume(); l = { op: 'or', a: l, b: this.and() } }
    return l
  }

  private and(): DeriveExpr {
    let l = this.comparison()
    while (this.peek() === '&&') { this.consume(); l = { op: 'and', a: l, b: this.comparison() } }
    return l
  }

  private comparison(): DeriveExpr {
    const l = this.additive()
    const t = this.peek()
    if (t !== '==' && t !== '!=' && t !== '<' && t !== '<=' && t !== '>' && t !== '>=') return l
    this.consume()
    const r = this.additive()
    const op = t === '==' ? 'eq' as const : t === '!=' ? 'neq' as const
             : t === '<'  ? 'lt' as const : t === '<=' ? 'lte' as const
             : t === '>'  ? 'gt' as const :              'gte' as const
    return { op, a: l, b: r }
  }

  private additive(): DeriveExpr {
    let l = this.multiplicative()
    for (let t = this.peek(); t === '+' || t === '-'; t = this.peek()) {
      this.consume()
      l = { op: t === '+' ? 'add' : 'sub', a: l, b: this.multiplicative() }
    }
    return l
  }

  private multiplicative(): DeriveExpr {
    let l = this.unary()
    for (let t = this.peek(); t === '*' || t === '/'; t = this.peek()) {
      this.consume()
      l = { op: t === '*' ? 'mul' : 'div', a: l, b: this.unary() }
    }
    return l
  }

  private unary(): DeriveExpr {
    if (this.peek() === '!') { this.consume(); return { op: 'not', a: this.unary() } }
    if (this.peek() === '-') { this.consume(); return { op: 'neg', a: this.unary() } }
    return this.primary()
  }

  private primary(): DeriveExpr {
    const t = this.peek()
    if (t === undefined) throw new Error('derive: unexpected end of expression')
    if (t === '(') {
      this.consume()
      const e = this.ternary()
      this.expect(')')
      return e
    }
    if (/^\d/.test(t))    { this.consume(); return { op: 'literal', value: Number(t) } }
    if (t.startsWith("'")){ this.consume(); return { op: 'literal', value: t.slice(1, -1) } }
    if (/^[a-zA-Z_]/.test(t)) { this.consume(); return { op: 'field', field: t } }
    throw new Error(`derive: unexpected token '${t}'`)
  }
}

function parseDeriveExpr(input: string): DeriveExpr {
  return new ExprParser(input).parse()
}

function applyDerive(rows: RawRow[], step: Extract<TransformStep, { op: 'derive' }>): RawRow[] {
  const target = step.as ?? step.name
  if (!target) throw new Error("derive: missing 'as' (or legacy 'name') field")
  const tree: DeriveExpr = typeof step.expr === 'string' ? parseDeriveExpr(step.expr) : step.expr
  return rows.map((row) => ({ ...row, [target]: evalExpr(tree, row) }))
}

function aggFn(op: 'sum' | 'avg' | 'min' | 'max' | 'count', values: number[]): number {
  if (values.length === 0) return 0
  switch (op) {
    case 'sum':   return values.reduce((a, b) => a + b, 0)
    case 'avg':   return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':   return Math.min(...values)
    case 'max':   return Math.max(...values)
    case 'count': return values.length
  }
}

type AggSpec = { field: string; op: 'sum' | 'avg' | 'min' | 'max' | 'count'; as?: string }

function normalizeAggregate(step: Extract<TransformStep, { op: 'aggregate' }>): { groupBy: string[]; aggregations: AggSpec[] } {
  if ('by' in step) {
    return {
      groupBy:      step.by,
      aggregations: [{ field: step.measure, op: step.agg, as: step.as }],
    }
  }
  return { groupBy: step.groupBy, aggregations: step.aggregations }
}

function applyAggregate(rows: RawRow[], step: Extract<TransformStep, { op: 'aggregate' }>): RawRow[] {
  const { groupBy, aggregations } = normalizeAggregate(step)
  const groups = new Map<string, { key: RawRow; buckets: Record<string, number[]> }>()

  for (const row of rows) {
    const keyStr = groupBy.map((k) => `${k}=${String(row[k] ?? '')}`).join('|')
    let entry    = groups.get(keyStr)
    if (!entry) {
      const key: RawRow = {}
      for (const g of groupBy) key[g] = row[g]
      const buckets: Record<string, number[]> = {}
      for (const a of aggregations) buckets[a.as ?? a.field] = []
      entry = { key, buckets }
      groups.set(keyStr, entry)
    }
    for (const a of aggregations) {
      const v = Number(row[a.field] ?? 0)
      if (!isNaN(v)) entry.buckets[a.as ?? a.field].push(v)
    }
  }

  return [...groups.values()].map(({ key, buckets }) => {
    const out: RawRow = { ...key }
    for (const a of aggregations) {
      const field = a.as ?? a.field
      out[field]  = Math.round(aggFn(a.op, buckets[field]) * 100) / 100
    }
    return out
  })
}

function applyGroup(rows: RawRow[], step: Extract<TransformStep, { op: 'group' }>): RawRow[] {
  const LF = step.levelField  ?? '_level'
  const PF = step.parentField ?? '_parentId'
  const PX = step.idPrefix    ?? '_grp'

  const currentKeys = new Array<DimVal | undefined>(step.by.length).fill(undefined)
  const parentIds   = new Array<string | undefined>(step.by.length).fill(undefined)
  const result:  RawRow[] = []

  for (const row of rows) {
    // Find outermost level whose key changed
    let firstChange = step.by.length
    for (let lvl = 0; lvl < step.by.length; lvl++) {
      if (row[step.by[lvl].field] !== currentKeys[lvl]) { firstChange = lvl; break }
    }

    // Inject headers for every level starting from firstChange
    for (let lvl = firstChange; lvl < step.by.length; lvl++) {
      const { field, inject } = step.by[lvl]
      currentKeys[lvl] = row[field]

      if (!inject) continue

      const idSrc    = inject.idFrom ? String(row[inject.idFrom] ?? row[field]) : String(row[field] ?? lvl)
      const headerId = `${PX}-${lvl}-${idSrc}`

      // Header = all fields from first member (carries dimension context)
      const header: RawRow = { ...row, _isGroup: 1, _id: headerId, [LF]: lvl }
      if (lvl > 0 && parentIds[lvl - 1] !== undefined) header[PF] = parentIds[lvl - 1]!

      // Field copies from first member (e.g. labelFrom, colorFrom)
      if (inject.from) {
        for (const [target, source] of Object.entries(inject.from)) {
          const v = row[source]
          if (v !== undefined) header[target] = v
        }
      }
      // Literal overrides — highest priority; booleans coerced to 1/0 (DimVal)
      if (inject.set) {
        for (const [k, v] of Object.entries(inject.set)) {
          header[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v
        }
      }

      parentIds[lvl] = headerId
      for (let j = lvl + 1; j < step.by.length; j++) parentIds[j] = undefined

      result.push(header)
    }

    // Data row: level = depth + nearest parent
    const dataRow: RawRow = { ...row, [LF]: step.by.length }
    const nearestParent   = [...parentIds].reverse().find(p => p !== undefined)
    if (nearestParent !== undefined) dataRow[PF] = nearestParent
    result.push(dataRow)
  }

  return result
}

function applyJoin(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'join' }>,
  ctx?: PipelineContext,
): RawRow[] {
  const right = isDimRef(step.with)
    ? (resolveDimRef(step.with, ctx?.classifiers, ctx?.display, 'items') as readonly Record<string, unknown>[])
    : step.with
  const onLeft  = step.on
  const onRight = step.onRight ?? (isDimRef(step.with) ? 'code' : step.on)

  const index = new Map<string, Record<string, unknown>>()
  for (const r of right) index.set(String(r[onRight]), r)

  return rows.map((row) => {
    const match = index.get(String(row[onLeft] ?? ''))
    if (!match) return row
    const out: RawRow = { ...row }
    const fields = step.fields ?? Object.keys(match).filter((k) => k !== onRight)
    for (const f of fields) {
      const v = match[f]
      if (v !== undefined) out[step.rename?.[f] ?? f] = v as DimVal
    }
    return out
  })
}

function applyRollup(rows: RawRow[], step: Extract<TransformStep, { op: 'rollup' }>): RawRow[] {
  const field   = step.field ?? 'value'
  const include = step.of === '*'
    ? null  // include every distinct dim value present in rows
    : new Set((step.of as readonly DimVal[]).map(String))

  // Group key = all fields except the rollup dim and the value field.
  const groups = new Map<string, { key: RawRow; values: number[] }>()

  for (const row of rows) {
    if (include && !include.has(String(row[step.dim]))) continue
    const key: RawRow = {}
    for (const [k, v] of Object.entries(row)) {
      if (k !== step.dim && k !== field) key[k] = v
    }
    const keyStr = Object.entries(key)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('|')
    let g = groups.get(keyStr)
    if (!g) { g = { key, values: [] }; groups.set(keyStr, g) }
    const v = Number(row[field] ?? 0)
    if (!isNaN(v)) g.values.push(v)
  }

  const out: RawRow[] = [...rows]
  for (const { key, values } of groups.values()) {
    const rollupRow: RawRow = { ...key, [step.dim]: step.as }
    rollupRow[field] = Math.round(aggFn(step.agg, values) * 100) / 100
    out.push(rollupRow)
  }
  return out
}

function applyLookup(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'lookup' }>,
  ctx?: PipelineContext,
): RawRow[] {
  const from: Record<string, Record<string, DimVal | undefined>> =
    isDimRef(step.from)
      ? (resolveDimRef(step.from, ctx?.classifiers, ctx?.display, 'byCode') as Record<string, Record<string, DimVal | undefined>>)
      : step.from
  return rows.map((row) => {
    const entry = from[String(row[step.key] ?? '')]
    if (!entry) return row
    const out: RawRow = { ...row }
    for (const f of step.fields) {
      const v = entry[f]
      if (v !== undefined) out[step.rename?.[f] ?? f] = v
    }
    return out
  })
}

// ── Public API ────────────────────────────────────────────────────────

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

/** applyStep — Execute one TransformStep against a row array. */
export function applyStep(rows: RawRow[], step: TransformStep, ctx?: PipelineContext): RawRow[] {
  switch (step.op) {
    case 'melt':      return applyMelt(rows, step)
    case 'rename':    return applyRename(rows, step)
    case 'cast':      return applyCast(rows, step)
    case 'filter':    return applyFilter(rows, step, ctx)
    case 'sort':      return applySort(rows, step)
    case 'addField':  return applyAddField(rows, step)
    case 'select':    return applySelect(rows, step)
    case 'derive':    return applyDerive(rows, step)
    case 'aggregate': return applyAggregate(rows, step)
    case 'rollup':    return applyRollup(rows, step)
    case 'lookup':    return applyLookup(rows, step, ctx)
    case 'join':      return applyJoin(rows, step, ctx)
    case 'group':     return applyGroup(rows, step)
    case 'concat':    return applyConcat(rows, step)
    case 'template':  return applyTemplate(rows, step)
  }
}

/** applyPipeline — Execute an ordered list of TransformSteps in sequence. */
export function applyPipeline(rows: RawRow[], steps: TransformStep[], ctx?: PipelineContext): RawRow[] {
  return steps.reduce((acc, step) => applyStep(acc, step, ctx), rows)
}