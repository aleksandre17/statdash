// ── FF-TREND-HAS-PROJECTION — a trend is authorable through the Inspector (ADR-049 P2a) ─
//
//  The coverage promise (mirrors thresholdAuthorable / valueMappingAuthorable): the KPI /
//  featured `trend` — a KpiTrendSpec discriminated union — MUST have an authoring surface,
//  not a raw-JSON blob. This gate proves the PANEL half:
//    • a PropField of `type:'trend'` resolves to the TrendField control (NOT the JSON
//      fallback) — so every re-declared trend SITE projects through it;
//    • the variant schemas are governed (a measure is an enum-ref source:'metrics' — the
//      author binds a GOVERNED noun, never a raw code, Law 2), and the discriminant model
//      round-trips (retypeTrend carries `measure` across a kind switch, `none` clears).
//
//  The PLUGINS half — "no trend site is left a raw `type:'object'`" — is enforced by
//  packages/plugins schema-completeness.fitness (the OPAQUE_BY_DESIGN stale-check: a
//  re-opaqued `items.trend` reds the build), the consuming-suite gate this lane also runs.
//
import { describe, it, expect } from 'vitest'
import type { PropField } from '@statdash/react/engine'
import { fieldControlRegistry } from '../../FieldControlRegistry'
import { JsonControl } from '../primitives'
import { TrendField } from './TrendField'
import { TREND_FIELD_TYPE, registerTrendControl } from './register'
import {
  TREND_VARIANT_SCHEMAS, TREND_TYPES, retypeTrend, makeTrendDefault,
} from './trendVariantSchemas'

registerTrendControl()

describe('FF-TREND-HAS-PROJECTION — trend is authorable through the Inspector (ADR-049 P2a)', () => {
  it('a `trend` PropField resolves to the TrendField control, not raw JSON', () => {
    const field = { field: 'trend', type: TREND_FIELD_TYPE, label: { ka: 'ტრენდი', en: 'Trend' } } as unknown as PropField
    const control = fieldControlRegistry.resolve(field)
    expect(control).toBe(TrendField)
    expect(control).not.toBe(JsonControl)
  })

  it('every discriminant declares a variant schema (the selector maps 1:1 to a form)', () => {
    for (const t of TREND_TYPES) {
      expect(TREND_VARIANT_SCHEMAS[t].length).toBeGreaterThan(0)
    }
  })

  it('the yoy/cagr measure is a GOVERNED metric-ref (enum-ref source:metrics — Law 2)', () => {
    for (const t of ['yoy', 'cagr'] as const) {
      const measure = TREND_VARIANT_SCHEMAS[t].find((f) => f.field === 'measure')
      expect(measure?.type).toBe('enum-ref')
      expect(measure?.source).toBe('metrics')
    }
  })

  it('the static variant authors a localized caption + a direction glyph', () => {
    const s = TREND_VARIANT_SCHEMAS.static
    const value = s.find((f) => f.field === 'value')
    const dir   = s.find((f) => f.field === 'dir')
    expect(value?.type).toBe('LocaleString')
    expect(value?.coverage).toBe('localized')
    expect(dir?.options?.map((o) => o.value)).toEqual(['up', 'down', 'flat', 'none'])
  })

  it('retypeTrend seeds a valid shell and CARRIES the measure across a yoy↔cagr switch', () => {
    const yoy = { type: 'yoy', measure: 'm.gdp' } as Record<string, unknown>
    const cagr = retypeTrend(yoy, 'cagr')
    expect(cagr).toMatchObject({ type: 'cagr', measure: 'm.gdp' })
    // a fresh pick with no prior value is just the default shell
    expect(retypeTrend(undefined, 'static')).toEqual(makeTrendDefault('static'))
  })

  it("retypeTrend to 'none' CLEARS the trend (a card may have no trend line)", () => {
    expect(retypeTrend({ type: 'yoy', measure: 'm.gdp' }, 'none')).toBeUndefined()
  })
})
