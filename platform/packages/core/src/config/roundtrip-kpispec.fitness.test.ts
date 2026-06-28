// ── P3-1: Constructor round-trip — KpiSpec (all value + trend variants) ───────
//
//  Covers: all KpiValueSpec branches (point, yoy, cagr, share, expr) ·
//          all KpiTrendSpec branches (yoy, cagr, static) ·
//          $ctx refs as literal objects · all optional KpiSpec fields.
//
//  WHY: KpiSpec is the most data-rich primitive the Constructor authors.
//  A single missing field (preliminary, methodologyUrl, trendSub template) causes
//  a silent data-integrity regression — the KPI card renders stale/empty data.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { KpiSpec }         from '../data/kpi'

function roundTrip<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }

function expectRoundTrip<T>(v: T): void { expect(roundTrip(v)).toEqual(v) }

// ── KpiValueSpec ──────────────────────────────────────────────────────────────

describe('KpiSpec — KpiValueSpec round-trip', () => {

  it('point — minimal', () => expectRoundTrip<KpiSpec>({
    id:    'gdp',
    label: 'მშპ',
    unit:  'მლნ ₾',
    color: '#1f77b4',
    when:  { op: 'perspective-is', perspective: 'year' },
    value: { type: 'point', measure: 'B1G', format: 'mln_gel' },
  }))

  it('point — $ctx time ref preserved as literal object (not resolved)', () => {
    const spec: KpiSpec = {
      id:    'gdp-point',
      label: { ka: 'მშპ', en: 'GDP' },
      unit:  'მლნ ₾',
      color: '#1f77b4',
      when:  { op: 'perspective-is', perspective: 'year' },
      value: { type: 'point', measure: 'B1G', time: { $ctx: 'time' }, format: 'mln_gel', abs: false },
    }
    expectRoundTrip(spec)
    const v = roundTrip(spec).value as Extract<typeof spec.value, { type: 'point' }>
    expect(v.time).toEqual({ $ctx: 'time' })
  })

  it('point — dim filter preserved', () => expectRoundTrip<KpiSpec>({
    id:    'gdp-ge',
    label: 'GDP (GE)',
    unit:  'მლნ ₾',
    color: '#1f77b4',
    when:  { op: 'perspective-is', perspective: 'year' },
    value: { type: 'point', measure: 'B1G', filter: { geo: 'GE' }, format: 'mln_gel' },
  }))

  it('yoy value', () => expectRoundTrip<KpiSpec>({
    id:    'gdp-growth',
    label: 'მშპ ზრდა',
    unit:  '%',
    color: '#2ca02c',
    when:  { op: 'perspective-is', perspective: 'year' },
    value: { type: 'yoy', measure: 'B1G' },
    trend: { type: 'yoy', measure: 'B1G' },
  }))

  it('cagr — numeric from/to', () => expectRoundTrip<KpiSpec>({
    id:    'gdp-cagr',
    label: 'CAGR 2018–2023',
    unit:  '%',
    color: '#d62728',
    when:  { op: 'perspective-is', perspective: 'range' },
    value: { type: 'cagr', measure: 'B1G', from: 2018, to: 2023 },
  }))

  it('cagr — $ctx from/to refs preserved', () => {
    const spec: KpiSpec = {
      id:    'gdp-cagr-ctx',
      label: 'CAGR',
      unit:  '%',
      color: '#9467bd',
      when:  { op: 'perspective-is', perspective: 'range' },
      value: { type: 'cagr', measure: 'B1G', from: { $ctx: 'startYear' }, to: { $ctx: 'endYear' } },
    }
    expectRoundTrip(spec)
    const v = roundTrip(spec).value as Extract<typeof spec.value, { type: 'cagr' }>
    expect(v.from).toEqual({ $ctx: 'startYear' })
    expect(v.to).toEqual({ $ctx: 'endYear' })
  })

  it('share — num/denom ObsRef', () => expectRoundTrip<KpiSpec>({
    id:    'wage-share',
    label: 'Wage Share',
    unit:  '%',
    color: '#8c564b',
    value: {
      type:  'share',
      num:   { measure: 'D1',  filter: { geo: 'GE' } },
      denom: { measure: 'B1G', filter: { geo: 'GE' } },
    },
  }))

  it('expr — subtract with format', () => expectRoundTrip<KpiSpec>({
    id:    'net-surplus',
    label: 'Net Surplus',
    unit:  'მლნ ₾',
    color: '#e377c2',
    when:  { op: 'perspective-is', perspective: 'year' },
    value: { type: 'expr', op: 'subtract', codes: ['B1G', 'D1'], format: 'mln_gel' },
  }))

  it('expr — add op', () => expectRoundTrip<KpiSpec>({
    id:    'combined',
    label: 'Combined',
    unit:  'მლნ ₾',
    color: '#7f7f7f',
    when:  { op: 'perspective-is', perspective: 'year' },
    value: { type: 'expr', op: 'add', codes: ['B2A3G', 'D1'], format: 'decimal1' },
  }))

  it('metric — calc-metric ref (DC-01), $ctx time preserved', () => {
    const spec: KpiSpec = {
      id:    'labour-share',
      label: 'Labour share',
      unit:  '%',
      color: '#4ECDC4',
      when:  { op: 'perspective-is', perspective: 'range' },
      value: { type: 'metric', metric: 'accounts.laborShare', time: { $ctx: 'toYear' } },
    }
    expectRoundTrip(spec)
    const v = roundTrip(spec).value as Extract<typeof spec.value, { type: 'metric' }>
    expect(v.metric).toBe('accounts.laborShare')
    expect(v.time).toEqual({ $ctx: 'toYear' })
  })

})

// ── KpiTrendSpec ──────────────────────────────────────────────────────────────

describe('KpiSpec — KpiTrendSpec round-trip', () => {

  const base: Omit<KpiSpec, 'value' | 'trend'> = {
    id:    't',
    label: 'T',
    unit:  '%',
    color: '#7f7f7f',
    when:  { op: 'perspective-is', perspective: 'year' },
  }

  it('trend yoy', () => expectRoundTrip<KpiSpec>({
    ...base,
    value: { type: 'point', measure: 'B1G', format: 'mln_gel' },
    trend: { type: 'yoy', measure: 'B1G' },
  }))

  it('trend cagr', () => expectRoundTrip<KpiSpec>({
    ...base,
    value: { type: 'point', measure: 'B1G', format: 'mln_gel' },
    trend: { type: 'cagr', measure: 'B1G', from: 2018, to: 2023 },
  }))

  it('trend static', () => expectRoundTrip<KpiSpec>({
    ...base,
    value: { type: 'point', measure: 'B1G', format: 'pct' },
    trend: { type: 'static', value: '+1.2%', dir: 'up' },
  }))

})

// ── Optional KpiSpec fields ───────────────────────────────────────────────────

describe('KpiSpec — all optional fields preserved', () => {

  it('trendSub template literal preserved as-is (not resolved at serialize time)', () => {
    const spec: KpiSpec = {
      id:             'full-kpi',
      label:          { ka: 'სრული', en: 'Full' },
      unit:           '%',
      color:          '#17becf',
      value:          { type: 'point', measure: 'B1G', format: 'sign_pct' },
      trend:          { type: 'yoy', measure: 'B1G' },
      trendSub:       '{time} წ.',
      preliminary:    true,
      note:           'Subject to revision',
      methodologyUrl: 'https://geostat.ge/methodology/gdp',
    }
    expectRoundTrip(spec)
    const r = roundTrip(spec)
    expect(r.trendSub).toBe('{time} წ.')
    expect(r.preliminary).toBe(true)
    expect(r.methodologyUrl).toBe('https://geostat.ge/methodology/gdp')
    expect(r.note).toBe('Subject to revision')
  })

})
