// ── metricCalc — the measure-algebra builder lowers to a valid, LIVE-resolving calc ─
//
//  AR-49 M3.0 (spec §3 / §7). Proves the calc editor's pure core:
//   • a template shape lowers to a valid @statdash/expr tree (ratio a ÷ b);
//   • the authored ManifestMetric{calc} round-trips byte-identically (Law 2 /
//     FF-CALC-AUTHORING-SERIALIZABLE);
//   • a self-reference / cycle is detected (FF-CALC-EDIT-SAFE);
//   • an authored per-capita-style calc metric RESOLVES through the LIVE engine
//     runtime (registerManifestMetrics → resolveMetricValue) to the expected value —
//     the "prove it computes, not just serializes" gate.
//
import { describe, it, expect } from 'vitest'
import type { ManifestMetric } from '@statdash/contracts'
import type { DataStore, SectionContext, StoreQuery } from '@statdash/engine'
import { registerManifestMetrics, resolveMetricValue } from '@statdash/engine'
import {
  buildTemplateExpr, exprToFormula, collectInputRefs, nextInputName,
  calcCreatesCycle, CALC_TEMPLATES,
} from './metricCalc'

describe('metricCalc — template shapes lower to a valid @statdash/expr tree', () => {
  it('ratio a ÷ b → div($a, $b)', () => {
    const expr = buildTemplateExpr('ratio', ['a', 'b'])
    expect(expr).toEqual({ op: 'div', left: { $derived: 'a' }, right: { $derived: 'b' } })
  })

  it('percentage a ÷ b × 100 → mul(div($a,$b), 100)', () => {
    const expr = buildTemplateExpr('percentage', ['a', 'b'])
    expect(expr).toEqual({ op: 'mul', left: { op: 'div', left: { $derived: 'a' }, right: { $derived: 'b' } }, right: 100 })
  })

  it('weighted a × k folds in the literal factor', () => {
    expect(buildTemplateExpr('scale', ['a'], 3)).toEqual({ op: 'mul', left: { $derived: 'a' }, right: 3 })
  })

  it('returns null when there are too few operands for the shape', () => {
    expect(buildTemplateExpr('ratio', ['a'])).toBeNull()
  })

  it('every registered template builds a serializable tree (Law 2)', () => {
    for (const t of CALC_TEMPLATES) {
      const names = Array.from({ length: t.operands }, (_, i) => String.fromCharCode(97 + i))
      const expr = buildTemplateExpr(t.id, names, 2)
      expect(expr).not.toBeNull()
      expect(JSON.parse(JSON.stringify(expr))).toEqual(expr)
    }
  })
})

describe('metricCalc — pure helpers', () => {
  it('exprToFormula renders a bracketed human formula (the WCAG text alternative)', () => {
    const expr = buildTemplateExpr('ratio', ['a', 'b'])!
    expect(exprToFormula(expr, (n) => (n === 'a' ? 'GDP' : 'population'))).toBe('(GDP ÷ population)')
  })

  it('collectInputRefs finds every referenced $derived operand', () => {
    const expr = buildTemplateExpr('percentage', ['a', 'b'])!
    expect(collectInputRefs(expr).sort()).toEqual(['a', 'b'])
  })

  it('nextInputName yields sequential letters, skipping used', () => {
    expect(nextInputName([])).toBe('a')
    expect(nextInputName(['a', 'b'])).toBe('c')
  })
})

describe('metricCalc — cycle detection (FF-CALC-EDIT-SAFE)', () => {
  const catalog: ManifestMetric[] = [
    { id: 'gdp', code: 'B1GQ', label: { en: 'GDP' } },
    { id: 'pop', code: 'POP', label: { en: 'Population' } },
    { id: 'per_capita', label: { en: 'GDP per capita' }, calc: { inputs: { a: { measure: 'gdp' }, b: { measure: 'pop' } }, expr: { op: 'div', left: { $derived: 'a' }, right: { $derived: 'b' } } } },
  ]

  it('detects a direct self-reference', () => {
    expect(calcCreatesCycle('loop', ['loop'], catalog)).toBe(true)
  })

  it('detects a transitive loop (per_capita → x → per_capita)', () => {
    // A new metric x that depends on per_capita, while per_capita is edited to depend on x.
    const withX: ManifestMetric[] = [
      ...catalog,
      { id: 'x', label: { en: 'X' }, calc: { inputs: { a: { measure: 'per_capita' } }, expr: { $derived: 'a' } } },
    ]
    // Editing per_capita to reference x closes the loop.
    expect(calcCreatesCycle('per_capita', ['x'], withX)).toBe(true)
  })

  it('accepts an acyclic derivation', () => {
    expect(calcCreatesCycle('per_capita', ['gdp', 'pop'], catalog)).toBe(false)
  })
})

// ── LIVE-COMPUTE PROOF — the authored calc metric resolves through the real runtime ─
describe('metricCalc — an authored per-capita calc metric computes LIVE (spec §12)', () => {
  it('registers via registerManifestMetrics and resolveMetricValue yields gdp ÷ pop', () => {
    // Cell values keyed by SDMX code — the store a KPI would read at a coordinate.
    const CELLS: Record<string, number> = { B1GQ_LIVE: 60000, POP_LIVE: 3.75 }
    const store: DataStore = {
      querySync: (q: StoreQuery) => {
        const code = (q as { code?: string }).code ?? ''
        return [{ value: CELLS[code] ?? 0 }] as unknown as ReturnType<DataStore['querySync']>
      },
    }
    const ctx: SectionContext = { timeMode: 'year', dims: {} } as SectionContext

    // The exact wire an authored calc metric ships (base operands + the derived metric).
    const authored: ManifestMetric[] = [
      { id: 'gdp_live', code: 'B1GQ_LIVE', label: { en: 'GDP' } },
      { id: 'pop_live', code: 'POP_LIVE', label: { en: 'Population' } },
      {
        id: 'gdp_per_capita_live',
        label: { en: 'GDP per capita', ka: 'მშპ ერთ სულზე' },
        unit: { en: 'thousand GEL / person' },
        calc: {
          inputs: { a: { measure: 'gdp_live' }, b: { measure: 'pop_live' } },
          expr: buildTemplateExpr('ratio', ['a', 'b'])!,
        },
      },
    ]

    // Byte-identity: the authored calc metric survives the site_config → bootstrap JSON round-trip.
    const delivered = JSON.parse(JSON.stringify(authored)) as ManifestMetric[]
    expect(delivered).toEqual(authored)

    registerManifestMetrics(delivered)

    const value = resolveMetricValue('gdp_per_capita_live', ctx, store)
    expect(value).toBe(60000 / 3.75) // 16000 — computed, not merely serialized
  })
})
