import type { CtxRef, DimVal, FilterValue }  from '../../sdmx'
import { isDimRef, resolveDimRef }            from '../codelist'
import { roundAgg }                           from '../round'
import type { RawRow, TransformStep, PipelineContext } from './types'

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
  return rows.map(row => ({
    ...row,
    [step.as]: step.fields.map(f => String(row[f] ?? '')).join(sep),
  }))
}

export function applyTemplate(rows: RawRow[], step: Extract<TransformStep, { op: 'template' }>): RawRow[] {
  return rows.map(row => ({
    ...row,
    [step.as]: step.tpl.replace(/\{(\w+)\}/g, (_, f: string) => String(row[f] ?? '')),
  }))
}

export function applyAddField(rows: RawRow[], step: Extract<TransformStep, { op: 'addField' }>): RawRow[] {
  return rows.map((row) => ({ ...row, [step.name]: step.value }))
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

export function applyJoin(
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
