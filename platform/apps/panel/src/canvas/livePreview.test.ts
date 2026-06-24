// ── livePreview.test — session DataSources → live store descriptors ──────────
//
//  Pins the first-cube-bound-wins derivation + the Postel-liberal nonTimeDims
//  read. Pure unit (no React, no network).
//
import { describe, it, expect } from 'vitest'
import { deriveLiveDescriptors, LIVE_STORE_KEY } from './livePreview'
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

  it('emits one stats descriptor keyed `default` for the first cube-bound source', () => {
    const out = deriveLiveDescriptors([
      src({ id: 'a', config: {} }),
      src({ id: 'b', url: 'http://x', config: { datasetCode: 'GDP', nonTimeDims: ['measure', 'geo'] } }),
      src({ id: 'c', config: { datasetCode: 'CPI' } }),
    ])
    expect(out).toEqual([
      {
        id:   LIVE_STORE_KEY,           // 'default' — slots into the existing key
        kind: 'stats',
        url:  'http://x',
        params: { datasetCode: 'GDP', nonTimeDims: ['measure', 'geo'] },
      },
    ])
  })

  it('first-cube-bound-wins — a later cube-bound source is ignored', () => {
    const out = deriveLiveDescriptors([
      src({ id: 'first',  config: { datasetCode: 'FIRST' } }),
      src({ id: 'second', config: { datasetCode: 'SECOND' } }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].params?.datasetCode).toBe('FIRST')
  })

  it('degrades nonTimeDims to [] when missing or not an array (Postel)', () => {
    expect(
      deriveLiveDescriptors([src({ config: { datasetCode: 'X' } })])[0].params?.nonTimeDims,
    ).toEqual([])
    expect(
      deriveLiveDescriptors([src({ config: { datasetCode: 'X', nonTimeDims: 'oops' } })])[0].params?.nonTimeDims,
    ).toEqual([])
  })

  it('omits url when the source has none (builder defaults the base)', () => {
    const out = deriveLiveDescriptors([src({ url: undefined, config: { datasetCode: 'X' } })])
    expect(out[0]).not.toHaveProperty('url')
  })
})
