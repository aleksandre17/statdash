// ── livePreview.test — session DataSources → live store descriptors ──────────
//
//  Pins the KEYED multi-store derivation: one 'stats' descriptor per cube-bound
//  source, keyed by source NAME, config forwarded verbatim (parity with the
//  runner's toSourceDescriptor). Pure unit (no React, no network).
//
import { describe, it, expect } from 'vitest'
import { deriveLiveDescriptors } from './livePreview'
import type { DataSourceDef } from '../types/constructor'

const src = (over: Partial<DataSourceDef>): DataSourceDef => ({
  id: 'ds', name: 'DS', type: 'sdmx-json', url: undefined, config: {}, status: 'connected',
  ...over,
})

describe('deriveLiveDescriptors', () => {
  it('returns [] when no source is cube-bound (no datasetCode)', () => {
    expect(deriveLiveDescriptors([])).toEqual([])
    expect(deriveLiveDescriptors([src({ config: {} })])).toEqual([])
  })

  it('emits one stats descriptor per cube-bound source, keyed by source NAME', () => {
    const out = deriveLiveDescriptors([
      src({ name: 'a', config: {} }),                                                   // not cube-bound → skipped
      src({ name: 'gdp', url: 'http://x', config: { datasetCode: 'GDP', nonTimeDims: ['measure', 'geo'] } }),
      src({ name: 'cpi', config: { datasetCode: 'CPI' } }),
    ])
    expect(out).toEqual([
      {
        id:   'gdp',                     // source name = the storeKey page nodes reference
        kind: 'stats',
        url:  'http://x',
        params: { datasetCode: 'GDP', nonTimeDims: ['measure', 'geo'] },
      },
      {
        id:   'cpi',
        kind: 'stats',
        params: { datasetCode: 'CPI' },
      },
    ])
  })

  it('keys each cube by its own name — a multi-cube page resolves per-node stores', () => {
    const out = deriveLiveDescriptors([
      src({ name: 'accounts', config: { datasetCode: 'ACCOUNTS_SEQUENCE' } }),
      src({ name: 'regional', config: { datasetCode: 'REGIONAL_GVA' } }),
    ])
    expect(out.map((d) => d.id)).toEqual(['accounts', 'regional'])
    expect(out.map((d) => d.params?.datasetCode)).toEqual(['ACCOUNTS_SEQUENCE', 'REGIONAL_GVA'])
  })

  it('forwards config VERBATIM — classifierDims (the $cl/$d superset) is never dropped', () => {
    const out = deriveLiveDescriptors([
      src({ name: 'regional', config: { datasetCode: 'REGIONAL_GVA', nonTimeDims: ['measure', 'geo', 'sector'], classifierDims: ['measure', 'geo', 'sector', 'aggregates'] } }),
    ])
    expect(out[0].params).toEqual({
      datasetCode:    'REGIONAL_GVA',
      nonTimeDims:    ['measure', 'geo', 'sector'],
      classifierDims: ['measure', 'geo', 'sector', 'aggregates'],
    })
  })

  it('omits url when the source has none (builder defaults the base)', () => {
    const out = deriveLiveDescriptors([src({ url: undefined, config: { datasetCode: 'X' } })])
    expect(out[0]).not.toHaveProperty('url')
  })
})
