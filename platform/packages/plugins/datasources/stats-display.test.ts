// @vitest-environment node
//
// ── FF-DISPLAY-WIRED — every stats store carries a non-empty display overlay ──
//
//  GAP 5: the `stats` store-builder must construct a `display` overlay from the
//  SAME classifier rows it fetched, so resolveDisplayRef joins label/color/order
//  at every `{ $d:'<dim>' }` ref. Before the fix the builder passed NO display →
//  CachedStore.display === undefined → every $d ref returned `{ code }` only
//  (labels/colors vanished on every chart). This pins:
//    • the overlay is present + non-empty for EVERY classifierDims (nonTimeDims)
//      entry, keyed by `code` (matching resolveDisplayRef's array-form join), and
//    • carries label (LocaleString {en,ka}, carried intact) + color + order.
//
//  buildDisplayOverlay is also unit-tested directly (pure projection, no network).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildStoreManifest } from '@statdash/react/engine'
import type { DatasourceInstanceConfig } from '@statdash/engine'
import { registerStoreBuilders } from './index'
import { buildDisplayOverlay } from './stats-display'

const DS: DatasourceInstanceConfig = {
  id:     'gdp',
  kind:   'stats',
  url:    'http://stub',
  params: { datasetCode: 'NAT', nonTimeDims: ['geo', 'account'] },
} as unknown as DatasourceInstanceConfig

function stubFetch(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input)
    let data: unknown
    if (url.includes('/api/stats/classifiers/geo')) {
      data = [
        { id: 1, code: 'GE', label: { en: 'Georgia', ka: 'საქართველო' }, color: '#5470c6', parent_code: null, ord: 0, metadata: null },
        { id: 2, code: 'TB', label: { en: 'Tbilisi', ka: 'თბილისი' },    color: '#3ba272', parent_code: 'GE', ord: 1, metadata: null },
      ]
    } else if (url.includes('/api/stats/classifiers/account')) {
      data = [
        { id: 5, code: 'production', label: { en: 'Production', ka: 'წარმოება' }, color: '#fac858', parent_code: null, ord: 0, metadata: null },
      ]
    } else if (url.includes('/api/stats/datasets/')) {
      data = { code: 'NAT', label: 'NA', version: 'v1', preliminary: false, dimensions: [] }
    } else if (url.includes('/api/cube/') && url.includes('/profile')) {
      data = {
        datasetCode: 'NAT',
        dimensions:  [{ code: 'geo', conceptRole: 'REF_AREA', isTime: false }],
        measures:    [{ code: 'GDP', label: { en: 'GDP' } }],
      }
    } else {
      throw new Error(`unexpected url ${url}`)
    }
    return Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ data }), headers: { get: () => null },
    } as unknown as Response)
  })
}

describe('FF-DISPLAY-WIRED — stats store has non-empty display per classifierDim', () => {
  afterEach(() => vi.restoreAllMocks())

  it('builds a non-empty display overlay for every nonTimeDim', async () => {
    registerStoreBuilders()
    stubFetch()

    const manifest = await buildStoreManifest([DS])
    const store    = manifest['gdp']

    for (const dim of ['geo', 'account']) {
      const overlay = store.display?.[dim]
      expect(overlay, `display['${dim}'] must be present`).toBeDefined()
      expect(Object.keys(overlay!).length, `display['${dim}'] must be non-empty`).toBeGreaterThan(0)
    }
  })

  it('keys the overlay by code and carries label{en,ka}/color/order', async () => {
    registerStoreBuilders()
    stubFetch()

    const manifest = await buildStoreManifest([DS])
    const geo = manifest['gdp'].display?.['geo']

    expect(geo?.['GE']).toMatchObject({
      label: { en: 'Georgia', ka: 'საქართველო' },
      color: '#5470c6',
      order: 0,
    })
    expect(geo?.['TB']?.order).toBe(1)
  })
})

describe('buildDisplayOverlay — pure projection (Classifier → DisplayMap)', () => {
  it('projects label/color/order keyed by code; drops undefined attrs', () => {
    const overlay = buildDisplayOverlay([
      { code: 'A', label: { en: 'Alpha' }, color: '#111' },
      { code: 'B', label: 'Beta' },   // no color → color attr absent
    ])
    expect(overlay['A']).toEqual({ label: { en: 'Alpha' }, color: '#111', order: 0 })
    expect(overlay['B']).toEqual({ label: 'Beta', order: 1 })
    expect('color' in overlay['B']).toBe(false)
  })

  it('preserves $cl/$d separation — structural attrs are NOT carried into display', () => {
    const overlay = buildDisplayOverlay([
      { code: 'A', label: 'Alpha', parent: 'ROOT', isClosing: 1 } as never,
    ])
    expect('parent' in overlay['A']).toBe(false)
    expect('isClosing' in overlay['A']).toBe(false)
  })
})
