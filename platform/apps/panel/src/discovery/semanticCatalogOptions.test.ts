// ── semanticCatalogOptions — governed-catalog enum-ref options resolve purely ────
//
//  FF-CATALOG-DISCOVERY-PURE (AR-49 M0): metricOptions/dimensionOptions are pure
//  catalog→options (plain inputs, off network/store), mirroring cubeEnumOptions.test.
//  Pins the M0 declarative-authoring core: a governed field offers GOVERNED nouns
//  (label + unit) so the author picks a metric-id, never types a raw code (Law 2).
//
import { describe, it, expect } from 'vitest'
import {
  metricOptions, dimensionOptions, isSemanticSource, readCatalogLabel,
  type CatalogDimension,
} from './semanticCatalogOptions'
import type { MetricDef } from '@statdash/engine'

const metrics: Record<string, MetricDef> = {
  'gdp.realGrowth': {
    code: 'B1GQ_GR',
    label: { en: 'GDP · real growth', ka: 'მშპ · რეალური ზრდა' },
    unit:  { en: '% change', ka: '% ცვლილება' },
  },
  'gdp.level': {
    code: 'B1GQ',
    label: { en: 'GDP', ka: 'მშპ' },
    unit:  { en: 'mln GEL', ka: 'მლნ ₾' },
  },
  'pop.total': {
    // no unit — label-only option
    code: 'POP',
    label: { en: 'Population', ka: 'მოსახლეობა' },
  },
}

const dimensions: Record<string, CatalogDimension> = {
  region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' }, conceptRole: 'geo' },
  sector: { code: 'NACE2',  label: { en: 'Sector', ka: 'სექტორი'  }, conceptRole: 'sector' },
}

describe('semanticCatalogOptions — metricOptions', () => {
  it('resolves metric-ids with a governed label + unit hint, locale-aware', () => {
    const opts = metricOptions(metrics, 'ka')
    expect(opts).toContainEqual({ value: 'gdp.level', label: 'მშპ · მლნ ₾' })
    expect(metricOptions(metrics, 'en')).toContainEqual({
      value: 'gdp.realGrowth', label: 'GDP · real growth · % change',
    })
  })

  it('omits the unit hint when the metric declares no unit', () => {
    expect(metricOptions(metrics, 'en')).toContainEqual({ value: 'pop.total', label: 'Population' })
  })

  it('emits the registry id as the option value (a metric-id, never a raw code)', () => {
    expect(metricOptions(metrics, 'en').map((o) => o.value))
      .toEqual(['gdp.level', 'gdp.realGrowth', 'pop.total']) // sorted by id, deterministic
  })

  it('is empty for an empty catalog (fail-soft)', () => {
    expect(metricOptions({}, 'en')).toEqual([])
  })
})

describe('semanticCatalogOptions — dimensionOptions', () => {
  it('resolves dimension-ids with the governed label, locale-aware', () => {
    expect(dimensionOptions(dimensions, 'ka')).toEqual([
      { value: 'region', label: 'რეგიონი' },
      { value: 'sector', label: 'სექტორი' },
    ])
  })

  it('falls back to the SDMX code when a governed label is missing', () => {
    const bare: Record<string, CatalogDimension> = { adj: { code: 'ADJUSTMENT', label: {} } }
    expect(dimensionOptions(bare, 'en')).toEqual([{ value: 'adj', label: 'ADJUSTMENT' }])
  })

  it('is empty for an empty catalog (fail-soft)', () => {
    expect(dimensionOptions({}, 'en')).toEqual([])
  })
})

describe('semanticCatalogOptions — readCatalogLabel', () => {
  it('resolves active → en → any → fallback, never blank', () => {
    expect(readCatalogLabel({ ka: 'x' }, 'en', 'F')).toBe('x')   // en missing → first available
    expect(readCatalogLabel({}, 'en', 'F')).toBe('F')            // no entries → fallback
    expect(readCatalogLabel(undefined, 'en', 'F')).toBe('F')     // absent → fallback
  })

  it('honours the LocaleString plain-string legacy branch', () => {
    expect(readCatalogLabel('მშპ', 'en', 'F')).toBe('მშპ')
    expect(readCatalogLabel('', 'en', 'F')).toBe('F')            // empty string → fallback (never blank)
  })
})

describe('semanticCatalogOptions — isSemanticSource', () => {
  it('recognises only the two governed-catalog discriminants', () => {
    expect(isSemanticSource('metrics')).toBe(true)
    expect(isSemanticSource('dimensions')).toBe(true)
    expect(isSemanticSource('cube.measures')).toBe(false)
    expect(isSemanticSource('dataSpecs')).toBe(false)
    expect(isSemanticSource(undefined)).toBe(false)
  })
})
