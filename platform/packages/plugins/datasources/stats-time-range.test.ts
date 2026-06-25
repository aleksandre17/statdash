// @vitest-environment node
//
// ── FF-TIME-RANGE-LOADS — store-builder folds time coverage into classifiers ──
//
//  ADR adr_time_range_readiness_seam (T2). The 'stats' store-builder reads the
//  dataset's TIME RANGE from the cube profile (timeCoverage.periods, ascending)
//  and folds it into store.classifiers[<timeDim>] so a year-select
//  {from:'options',pick:'last'} resolves to the real latest period synchronously.
//
//  Both branches are pinned:
//    • WITH timeCoverage  → classifiers['time'] non-empty + ascending (codes).
//    • WITHOUT timeCoverage (degraded) → store still builds, time classifier
//      absent/empty, NO throw (graceful degradation, never hangs).
//
//  Law 1: the time-dim KEY is read from the profile's DSD (dimensions[].isTime),
//  never a hardcoded 'time'. The fixtures mark 'time' as the time dim so the
//  builder folds under exactly that generic key.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildStoreManifest } from '@statdash/react/engine'
import type { DatasourceInstanceConfig } from '@statdash/engine'
import { registerStoreBuilders } from './index'

const DS: DatasourceInstanceConfig = {
  id:     'gdp',
  kind:   'stats',
  url:    'http://stub',
  params: { datasetCode: 'NAT', nonTimeDims: ['geo'] },
} as unknown as DatasourceInstanceConfig

/**
 * Stub fetch over the three reads the builder issues: /classifiers/:dim,
 * /datasets/:code (meta) and /cube/:code/profile. `coverage` lets each test
 * choose the profile's timeCoverage (or undefined for the degraded branch).
 */
function stubFetch(coverage: { min: string | null; max: string | null; periods: string[] } | undefined): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input)
    let data: unknown
    if (url.includes('/api/stats/classifiers/')) {
      data = [{ id: 1, code: 'GE', label: 'Georgia', color: null, parent_id: null, ord: 0, metadata: null }]
    } else if (url.includes('/api/stats/datasets/')) {
      data = { code: 'NAT', label: 'National Accounts', version: 'v1', preliminary: false, dimensions: [] }
    } else if (url.includes('/api/cube/') && url.includes('/profile')) {
      data = {
        datasetCode: 'NAT',
        dimensions:  [
          { code: 'geo',  conceptRole: 'REF_AREA', isTime: false },
          { code: 'time', conceptRole: null,        isTime: true  },
        ],
        measures:   [{ code: 'GDP', label: { en: 'GDP' } }],
        ...(coverage !== undefined ? { timeCoverage: coverage } : {}),
      }
    } else {
      throw new Error(`unexpected url ${url}`)
    }
    return Promise.resolve({
      ok:      true,
      status:  200,
      json:    () => Promise.resolve({ data }),
      headers: { get: () => null },
    } as unknown as Response)
  })
}

describe('FF-TIME-RANGE-LOADS — stats store-builder folds time coverage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('WITH timeCoverage → classifiers[<timeDim>] is non-empty + ascending', async () => {
    registerStoreBuilders()
    stubFetch({ min: '2015', max: '2025', periods: ['2015', '2016', '2017', '2024', '2025'] })

    const manifest = await buildStoreManifest([DS])
    const store    = manifest['gdp']
    const timeCl   = store.classifiers?.['time']

    expect(timeCl).toBeDefined()
    expect(timeCl).toEqual([
      { code: '2015' }, { code: '2016' }, { code: '2017' }, { code: '2024' }, { code: '2025' },
    ])
    // Ascending: last code is the MAX — what pick:'last' will select.
    const codes = (timeCl as { code: string }[]).map((e) => e.code)
    expect(codes[codes.length - 1]).toBe('2025')
  })

  it('WITHOUT timeCoverage (degraded) → store still builds, time classifier absent, no throw', async () => {
    registerStoreBuilders()
    stubFetch(undefined)

    const manifest = await buildStoreManifest([DS])
    const store    = manifest['gdp']

    expect(store).toBeDefined()
    // Non-time classifiers still present; time classifier absent (or empty).
    expect(store.classifiers?.['geo']).toBeDefined()
    const timeCl = store.classifiers?.['time']
    expect(timeCl === undefined || timeCl.length === 0).toBe(true)
  })

  it('a failed profile fetch never blocks construction (graceful degradation)', async () => {
    registerStoreBuilders()
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/cube/') && url.includes('/profile')) {
        return Promise.reject(new Error('profile 500'))
      }
      let data: unknown
      if (url.includes('/api/stats/classifiers/')) {
        data = [{ id: 1, code: 'GE', label: 'Georgia', color: null, parent_id: null, ord: 0, metadata: null }]
      } else if (url.includes('/api/stats/datasets/')) {
        data = { code: 'NAT', label: 'NA', version: null, preliminary: false, dimensions: [] }
      } else {
        throw new Error(`unexpected url ${url}`)
      }
      return Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve({ data }), headers: { get: () => null },
      } as unknown as Response)
    })

    const manifest = await buildStoreManifest([DS])
    expect(manifest['gdp']).toBeDefined()
    expect(manifest['gdp'].classifiers?.['time']).toBeUndefined()
  })
})
