// ── Generic group-aggregate utility ──────────────────────────────────
//
//  SQL GROUP BY + aggregate equivalent. Dataset-agnostic.
//  Caller passes AggregationRule[]; engine knows nothing about sectors, geos, etc.
//
//  metaFrom — optional codelist join for enriching computed rows with
//  display metadata (label, color, …). CL is passed by the caller; the
//  engine only reads fields listed in `pick`.
//

import type { DimVal } from '../sdmx'
import { roundAgg }    from './round'

export type AggOp = 'sum' | 'avg' | 'min' | 'max'

export interface AggregationRule {
  groupBy:   string[]
  op:        AggOp
  field:     string
  emit:      Record<string, DimVal>           // dim overrides + optional literal metadata
  metaFrom?: {                                // join CL metadata onto computed rows
    dim:     string                           // which grouped dim is the CL key
    cl:      Record<string, Record<string, DimVal>>
    pick:    string[]                         // which CL fields to copy
    rename?: Record<string, string>           // optional source→target field rename
  }
}

export function groupAggregate(
  rows:  readonly Readonly<Record<string, DimVal>>[],
  rules: AggregationRule[],
): Record<string, DimVal>[] {
  const result: Record<string, DimVal>[] = []

  for (const rule of rules) {
    const groups = new Map<string, { key: Record<string, DimVal>; values: number[] }>()

    for (const row of rows) {
      const keyStr = rule.groupBy.map(k => `${k}=${String(row[k] ?? '')}`).join('|')
      if (!groups.has(keyStr)) {
        const k: Record<string, DimVal> = {}
        for (const g of rule.groupBy) k[g] = row[g]
        groups.set(keyStr, { key: k, values: [] })
      }
      const v = Number(row[rule.field] ?? 0)
      if (!isNaN(v)) groups.get(keyStr)!.values.push(v)
    }

    for (const { key, values } of groups.values()) {
      const agg = applyOp(rule.op, values)
      const row: Record<string, DimVal> = {
        ...key,
        ...rule.emit,
        [rule.field]: roundAgg(agg),
      }
      if (rule.metaFrom) {
        const { dim, cl, pick, rename } = rule.metaFrom
        const entry = cl[String(key[dim])]
        if (entry) {
          for (const f of pick) {
            const v = entry[f]
            if (v !== undefined) row[rename?.[f] ?? f] = v
          }
        }
      }
      result.push(row)
    }
  }

  return result
}

function applyOp(op: AggOp, values: number[]): number {
  if (values.length === 0) return 0
  switch (op) {
    case 'sum': return values.reduce((a, b) => a + b, 0)
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length
    case 'min': return Math.min(...values)
    case 'max': return Math.max(...values)
  }
}