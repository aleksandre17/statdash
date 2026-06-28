// ── FF — metric DELIVERY: manifest → boot → registry → binding seam ───────────
//
//  The engine side (registerMetrics / resolveMeasureRef / withMetricProvenance) is
//  unit-locked in packages/core (metric-binding.fitness.test.ts). THIS suite locks
//  the DELIVERY half — the geostat boot seam that flows a tenant's semantic layer
//  as config-data through the manifest into that engine registry, mirroring how
//  `manifest.datasources` flows into the store-builder registry:
//
//    FF-METRICS-DELIVERED      — registerManifestMetrics(manifest.metrics) primes
//                                the registry so a metric-id resolves to its code.
//    FF-METRIC-PROVENANCE-FLOWS — the delivered unit/methodology reach the
//                                withMetricProvenance seam by underlying code (the
//                                Law-9 badge data is flow-ready post-delivery).
//    FF-RAW-CODE-IDENTICAL      — delivery is purely additive: an unregistered raw
//                                code resolves byte-identically; an empty/absent
//                                catalog is a no-op (Postel).
//
//  resolveMeasureRef mutates a process-global registry; every fixture id is
//  prefixed `dlv:` so it can never collide with a raw SDMX code or a real catalog id.
//
import { describe, it, expect } from 'vitest'
import { registerManifestMetrics } from './site-manifest'
import type { SiteManifest }       from './site-manifest'
import type { ManifestMetric }     from '@statdash/contracts'
import {
  resolveMeasureRef, getMetric, withMetricProvenance,
  resolveMetricValue, isCalculatedMetric, ExternalStore,
} from '@statdash/engine'
import type { MetadataPort, SectionContext, Observation } from '@statdash/engine'

const ctx: SectionContext = { dims: { time: 2024, geo: 'GE' } }
const emptyPort: MetadataPort = { provenance: () => undefined }

const FIXTURE: ManifestMetric[] = [
  {
    id:         'dlv:gdp',
    code:       'GDP_FIX',
    label:      { ka: 'მშპ', en: 'GDP' },
    unit:       { ka: 'მლნ ლარი', en: 'Million Georgian Lari' },
    methodology: 'https://example.org/methodology/gdp',
    dataSource: 'gdpStore',
  },
  {
    id:    'dlv:multi',
    code:  ['A_FIX', 'B_FIX'],
    label: { ka: 'ორი', en: 'Two' },
    unit:  { ka: 'პროცენტი', en: 'Percent' },
  },
]

describe('FF-METRICS-DELIVERED — manifest metrics reach the engine registry', () => {
  it('registerManifestMetrics primes the registry so a metric-id resolves to its code', () => {
    registerManifestMetrics(FIXTURE)
    expect(getMetric('dlv:gdp')?.code).toBe('GDP_FIX')
    expect(resolveMeasureRef('dlv:gdp').codes).toEqual(['GDP_FIX'])
    // multi-code metric concatenates its underlying codes in order.
    expect(resolveMeasureRef('dlv:multi').codes).toEqual(['A_FIX', 'B_FIX'])
  })

  it('the delivered dataSource flows onto the resolved measure (Cube.dev routing)', () => {
    registerManifestMetrics(FIXTURE)
    expect(resolveMeasureRef('dlv:gdp').dataSource).toBe('gdpStore')
    // a metric with no dataSource contributes none (the node falls through to page/default).
    expect(resolveMeasureRef('dlv:multi').dataSource).toBeUndefined()
  })

  it('a full SiteManifest.metrics blob registers end-to-end (the boot-path type)', () => {
    const manifest = { metrics: FIXTURE } as unknown as SiteManifest
    registerManifestMetrics(manifest.metrics)
    expect(resolveMeasureRef('dlv:gdp').unit).toEqual({ ka: 'მლნ ლარი', en: 'Million Georgian Lari' })
  })
})

describe('FF-METRIC-PROVENANCE-FLOWS — delivered governance reaches the badge seam', () => {
  it('the delivered unit + methodology flow through withMetricProvenance by underlying code', () => {
    registerManifestMetrics(FIXTURE)
    // Provenance is keyed by the UNDERLYING code (GDP_FIX), not the metric-id — so a
    // KPI/panel reading the raw code lights up the Law-9 badge once the catalog is
    // delivered, with NO config change to the reader.
    const prov = withMetricProvenance(emptyPort).provenance('GDP_FIX', ctx)
    expect(prov?.unit).toEqual({ ka: 'მლნ ლარი', en: 'Million Georgian Lari' })
    expect(prov?.methodology).toBe('https://example.org/methodology/gdp')
  })
})

// ── FF-CALC-METRIC-DELIVERED — a CALCULATED metric flows manifest→boot→registry→render ──
//
//  The calc-metric ENGINE (resolveMetricValue) + its byte-identical KPI consumer are
//  unit-locked in packages/core (metric-calc.fitness.test.ts: FF-CALC-METRIC-EQUALS-SHARE).
//  THIS locks the DELIVERY half for a calc metric — that a ManifestMetric carrying the
//  zero-dep `calc` blob, delivered through registerManifestMetrics, refines into an
//  engine MetricDef whose `calc` the runtime can EVALUATE. The full congregation:
//  manifest (wire) → boot (registerManifestMetrics) → registry (getMetric().calc) →
//  binding seam (resolveMeasureRef expands to components) → render (resolveMetricValue).
//
//  The labour-share shape (ratio × 100), `dlv:`-prefixed so it never collides.
const CALC_FIXTURE: ManifestMetric = {
  id:         'dlv:labor-share',
  label:      { ka: 'შრომის წილი', en: 'Labour share in value added' },
  unit:       { ka: '%', en: '%' },
  dataSource: 'accountsStore',
  calc: {
    inputs: {
      num:   { measure: 'D1_FIX',  at: { account: 'gen-income', side: 'U' } },
      denom: { measure: 'B1G_FIX', at: { account: 'prod',       side: 'U' } },
    },
    // mul(div($num, $denom), 100) — the EXACT wire shape the provisioning catalog
    // authors; `expr` is opaque JsonValue on the wire, refined into Expr at boot.
    expr: { op: 'mul', left: { op: 'div', left: { $derived: 'num' }, right: { $derived: 'denom' } }, right: 100 },
  },
}

// D1 under the generation-of-income slice; B1G under production — the (account,side)
// coordinates the calc inputs pin. A decoy D1 under production proves the pin bites.
const calcObs: Observation[] = [
  { measure: 'D1_FIX',  value: 480,  time: 2024, geo: 'GE', account: 'gen-income', side: 'U' },
  { measure: 'D1_FIX',  value: 999,  time: 2024, geo: 'GE', account: 'prod',       side: 'U' },
  { measure: 'B1G_FIX', value: 1200, time: 2024, geo: 'GE', account: 'prod',       side: 'U' },
]
const calcStore = new ExternalStore(calcObs)
const calcCtx: SectionContext = { dims: { time: 2024, geo: 'GE' } }

describe('FF-CALC-METRIC-DELIVERED — a calc metric flows manifest→boot→registry→render', () => {
  it('the delivered calc blob refines into an engine MetricDef.calc (registry)', () => {
    registerManifestMetrics([CALC_FIXTURE])
    expect(getMetric('dlv:labor-share')?.calc).toBeDefined()
    expect(isCalculatedMetric('dlv:labor-share')).toBe(true)
  })

  it('stays consumable via the one binding seam — expands to its component codes (no orphan)', () => {
    registerManifestMetrics([CALC_FIXTURE])
    // resolveMeasureRef expands a calc metric to its inputs’ underlying codes, so
    // no-capability-without-consumer (part C) stays green and warming reaches them.
    expect(resolveMeasureRef('dlv:labor-share').codes).toEqual(['D1_FIX', 'B1G_FIX'])
    expect(resolveMeasureRef('dlv:labor-share').dataSource).toBe('accountsStore')
  })

  it('RENDERS end-to-end — the refined expr evaluates over its components at the coordinate', () => {
    registerManifestMetrics([CALC_FIXTURE])
    // 480 / 1200 × 100 = 40 — the production-account D1 decoy (999) is NOT picked up
    // (the input `at` pin survived the wire round-trip and the boot refinement).
    expect(resolveMetricValue('dlv:labor-share', calcCtx, calcStore)).toBe(40)
  })
})

describe('FF-RAW-CODE-IDENTICAL — delivery is purely additive (Postel)', () => {
  it('an unregistered raw code resolves byte-identically', () => {
    registerManifestMetrics(FIXTURE)
    // RAW_FIX is not a metric-id ⇒ passes through unchanged, no governance attached.
    expect(resolveMeasureRef('RAW_FIX')).toEqual({ codes: ['RAW_FIX'] })
  })

  it('an empty / absent catalog is a no-op', () => {
    // Neither call may throw, and neither registers anything new.
    expect(() => registerManifestMetrics([])).not.toThrow()
    expect(() => registerManifestMetrics(undefined)).not.toThrow()
    expect(getMetric('dlv:never')).toBeUndefined()
  })
})
