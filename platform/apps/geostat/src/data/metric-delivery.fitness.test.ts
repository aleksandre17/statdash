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
} from '@statdash/engine'
import type { MetadataPort, SectionContext } from '@statdash/engine'

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
