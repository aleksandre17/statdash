import type { CtxRef, DimVal, FilterValue }  from '../../sdmx'
import { isDimRef }                           from '../codelist'
import { composeLocale, tagLocaleString }      from '../../i18n/types'
import type { LocaleString }                   from '../../i18n/types'
import { resolveRef }                         from '../../ref/ref'
import { roundAgg }                           from '../round'
import type { RawRow, TransformStep, PipelineContext } from './types'

// ── tagCell — brand an AUTHORED object-valued cell as an i18n carrier ──────────
//
//  A transform op that INJECTS an authored value into a row (lookup `from` map,
//  group `inject.from`/`inject.set`, addField `value`) may inject a bilingual
//  LocaleString bag `{ ka, en }` — e.g. a chart `series` name or a total-row label
//  override. The engine is locale-agnostic (it holds no user locale here), so it must
//  TAG the carrier (non-enumerable Symbol brand) exactly as the `$d` display join does
//  (codelist.tagLocaleString), so resolveRowLocales at the React boundary resolves it
//  to the active locale. Without the tag a `{ ka, en }` series/label leaks as
//  "[object Object]" or a raw Georgian arm on non-Georgian locales (the F3 leak class).
//
//  Scalars (string/number/null) pass through untouched — tagLocaleString is a no-op —
//  so a single-locale authored literal is byte-identical. Idempotent on already-tagged
//  values (the $d-ref lookup path re-tag is a no-op).
//
//  Takes `unknown`: a RawRow cell is TYPED `DimVal` (scalar) but at RUNTIME carries
//  LocaleString objects (the label $d-join type-lie, documented across the pipeline),
//  so the object branch is reachable at runtime though narrowed away at compile time.
function tagCell(v: unknown): DimVal {
  return typeof v === 'object' && v !== null
    ? (tagLocaleString(v as LocaleString) as unknown as DimVal)
    : (v as DimVal)
}

// ── Individual step implementations ───────────────────────────────────

export function applyMelt(rows: RawRow[], step: Extract<TransformStep, { op: 'melt' }>): RawRow[] {
  const { idFields, valueFields, seriesKey = 'series', valueKey = 'value' } = step
  return rows.flatMap((row) => {
    const idPart = Object.fromEntries(idFields.map((f) => [f, row[f]]))
    return valueFields.map((field) => ({ ...idPart, [seriesKey]: field, [valueKey]: row[field] ?? 0 }))
  })
}

export function applyRename(rows: RawRow[], step: Extract<TransformStep, { op: 'rename' }>): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = {}
    for (const [k, v] of Object.entries(row)) out[step.fields[k] ?? k] = v
    return out
  })
}

export function applyCast(rows: RawRow[], step: Extract<TransformStep, { op: 'cast' }>): RawRow[] {
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

export function applyFilter(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'filter' }>,
  ctx?: PipelineContext,
): RawRow[] {
  return rows.filter((row) =>
    Object.entries(step.where).every(([field, condition]) => {
      const val = row[field]
      // Resolve a ctx-scope ref against SectionContext.dims via the one dispatcher (../ref).
      let resolved: FilterValue | DimVal | undefined = condition
      if (isCtxRef(condition)) {
        const cv = resolveRef(condition as CtxRef, { dims: ctx?.section?.dims }) as DimVal | undefined
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

export function applySort(rows: RawRow[], step: Extract<TransformStep, { op: 'sort' }>): RawRow[] {
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

export function applyConcat(rows: RawRow[], step: Extract<TransformStep, { op: 'concat' }>): RawRow[] {
  const sep = step.sep ?? '-'
  return rows.map(row => {
    const operands = step.fields.map(f => row[f])
    // i18n boundary [GAP 5b]: a tagged LocaleString operand is composed PER LOCALE
    // and re-tagged — never String()-flattened to "[object Object]" before the React
    // resolve boundary. All-scalar operands → a plain string (byte-identical).
    return { ...row, [step.as]: composeLocale(operands, pick => operands.map(pick).join(sep)) as DimVal }
  })
}

export function applyTemplate(rows: RawRow[], step: Extract<TransformStep, { op: 'template' }>): RawRow[] {
  return rows.map(row => {
    // Operands are the fields referenced by the template's `{field}` tokens.
    const fields = [...step.tpl.matchAll(/\{(\w+)\}/g)].map(m => m[1])
    const operands = fields.map(f => row[f])
    // i18n boundary [GAP 5b]: compose the template PER LOCALE when any referenced
    // field is a tagged LocaleString (so `{label} ({code})` over a bilingual label
    // yields a bilingual result), re-tagged for resolveRowLocales. All-scalar → string.
    const value = composeLocale(operands, pick => {
      let i = 0
      return step.tpl.replace(/\{(\w+)\}/g, () => pick(operands[i++]))
    })
    return { ...row, [step.as]: value as DimVal }
  })
}

export function applyAddField(rows: RawRow[], step: Extract<TransformStep, { op: 'addField' }>): RawRow[] {
  return rows.map((row) => ({ ...row, [step.name]: tagCell(step.value) }))
}

export function applySelect(rows: RawRow[], step: Extract<TransformStep, { op: 'select' }>): RawRow[] {
  return rows.map((row) => Object.fromEntries(step.fields.map((f) => [f, row[f]])))
}

// ── derive step — delegated to ./derive ──────────────────────────────
export { applyDerive } from './derive'

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

export function applyAggregate(rows: RawRow[], step: Extract<TransformStep, { op: 'aggregate' }>): RawRow[] {
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
      out[field]  = roundAgg(aggFn(a.op, buckets[field]))
    }
    return out
  })
}

export function applyGroup(rows: RawRow[], step: Extract<TransformStep, { op: 'group' }>): RawRow[] {
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

      // Field copies from first member (e.g. labelFrom, colorFrom) — a copied cell may
      // already be a tagged LocaleString (tagCell is an idempotent no-op then).
      if (inject.from) {
        for (const [target, source] of Object.entries(inject.from)) {
          const v = row[source]
          if (v !== undefined) header[target] = tagCell(v)
        }
      }
      // Literal overrides — highest priority; booleans coerced to 1/0 (DimVal). An
      // authored object override (e.g. a bilingual `series` header) is TAGGED so the
      // React boundary resolves it to the active locale.
      if (inject.set) {
        for (const [k, v] of Object.entries(inject.set)) {
          header[k] = typeof v === 'boolean' ? (v ? 1 : 0) : tagCell(v)
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

export function applyJoin(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'join' }>,
  ctx?: PipelineContext,
): RawRow[] {
  const right = isDimRef(step.with)
    ? (resolveRef(step.with, { classifiers: ctx?.classifiers, display: ctx?.display, defaultView: 'items' }) as readonly Record<string, unknown>[])
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

export function applyRollup(rows: RawRow[], step: Extract<TransformStep, { op: 'rollup' }>): RawRow[] {
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
    rollupRow[field] = roundAgg(aggFn(step.agg, values))
    out.push(rollupRow)
  }
  return out
}

export function applyLookup(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'lookup' }>,
  ctx?: PipelineContext,
): RawRow[] {
  const from: Record<string, Record<string, DimVal | undefined>> =
    isDimRef(step.from)
      ? (resolveRef(step.from, { classifiers: ctx?.classifiers, display: ctx?.display, defaultView: 'byCode' }) as Record<string, Record<string, DimVal | undefined>>)
      : step.from
  return rows.map((row) => {
    const entry = from[String(row[step.key] ?? '')]
    if (!entry) return row
    const out: RawRow = { ...row }
    for (const f of step.fields) {
      const v = entry[f]
      // An authored `from` map may carry a bilingual value (e.g. side → { series } as a
      // LocaleString) — TAG it so resolveRowLocales resolves it at the React boundary.
      // A $d-ref lookup value is already tagged (idempotent); a scalar is untouched.
      if (v !== undefined) out[step.rename?.[f] ?? f] = tagCell(v)
    }
    return out
  })
}
