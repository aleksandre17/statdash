// @vitest-environment jsdom
//
// ── FF-NO-HANG — useFilterState settles when classifiers['time'] is absent ────
//
//  ADR adr_time_range_readiness_seam (T5). The year-select default
//  {from:'options',pick:'last'} reads its options from store.classifiers['time']
//  via the inline {$cl:'time'} ref. When that classifier is ABSENT (coverage
//  degraded / never loaded), resolveYears returns [] (an array, NOT null) — so
//  resolveDefaults sets dims['year']='' and never adds 'year' to pendingKeys.
//
//  Therefore isLoading RESOLVES (never pends forever) and ctx.dims carries no
//  '0' year (it degrades to unbounded via the core guards). NO production change
//  is needed here — this test pins that the synchronous path STAYS synchronous.

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createElement, type ReactNode } from 'react'
import type { DataStore, FilterSchemaInput } from '@statdash/engine'
import { FilterProvider } from '../context/FilterContext'
import { useFilterState } from './useFilterState'

// A live-style store with NO time classifier (the degraded boot state). caps.sync
// false mirrors ApiStore; classifiers carries only a non-time dim.
const STORE_NO_TIME: DataStore = {
  caps:        { queryTypes: ['obs'], batching: false, streaming: false, sync: false },
  classifiers: { geo: [{ code: 'GE', label: 'Georgia' }] },
  querySync:   () => { throw new Error('cold') },
} as unknown as DataStore

// The GDP year-bar schema shape: a year-select whose options come from the time
// classifier via the inline {$cl:'time'} ref, defaulting to pick:'last'.
const SCHEMA: FilterSchemaInput = {
  bars: {
    yearBar: {
      position: 'sticky',
      filters: {
        mode: { type: 'hidden', default: 'year' },
        year: {
          type:    'year-select',
          default: { from: 'options', pick: 'last' },
          years:   { type: 'inline', items: { $cl: 'time' }, field: 'code' },
        },
      },
    },
  },
  context: { timeMode: 'mode', dims: { time: 'year' } },
} as unknown as FilterSchemaInput

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, createElement(FilterProvider, null, children))
}

describe('FF-NO-HANG — useFilterState settles with absent time classifier', () => {
  it('isLoading resolves (never pends) when classifiers[time] is absent', () => {
    const { result } = renderHook(() => useFilterState(SCHEMA, STORE_NO_TIME), { wrapper })
    expect(result.current.isLoading).toBe(false)
  })

  it('ctx.dims carries no 0 year — degrades to unbounded', () => {
    const { result } = renderHook(() => useFilterState(SCHEMA, STORE_NO_TIME), { wrapper })
    const { dims } = result.current.ctx
    // The year dim is mapped to ctx.dims['time'] (context.dims). It must be
    // ABSENT — not 0, not '0' — so toObsParams omits from/to (all years).
    expect(dims['time']).toBeUndefined()
    expect(dims['time']).not.toBe(0)
    expect(dims['time']).not.toBe('0')
  })

  it('raw.year is the "" sentinel, never 0', () => {
    const { result } = renderHook(() => useFilterState(SCHEMA, STORE_NO_TIME), { wrapper })
    expect(result.current.raw['year']).toBe('')
    expect(result.current.raw['year']).not.toBe('0')
  })
})
