// @vitest-environment jsdom
//
// ── Hidden param with an options source resolves a span default in EVERY mode ──
//
//  Regression for the regional current-mode CAGR KPI showing 0.0%. The headline
//  "average annual growth (2010–2023)" KPI is mode:'year' but read its from/to
//  from fromYear/toYear — range-only ctx dims that the mode≠range effect CLEARS
//  and that bar-visibility gating denies a default in year mode. Result: empty
//  endpoints → degenerate range → CAGR 0.
//
//  The fix: spanFrom/spanTo are HIDDEN params carrying an `options` source (the
//  data span), present in the year bar, NEVER cleared. getOptions must resolve a
//  hidden param's options exactly like a select so its Tier 3 OptionsDefault
//  pick:'first' (asc → min year) / pick:'last' equivalent (desc → max year)
//  lands on a real member. This test pins that a hidden+options param's default
//  reaches ctx.dims in year mode — the value the CAGR reads.

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createElement, type ReactNode } from 'react'
import type { DataStore, FilterSchemaInput } from '@statdash/engine'
import { FilterProvider } from '../context/FilterContext'
import { useFilterState } from './useFilterState'

// A live-style store exposing a 'time' dimension. The inline {$d:'time'} source
// resolves through resolveDisplayRef: with no classifier it falls back to the
// display map's keys (id → {code:id}). Years 2010..2023, deliberately unsorted so
// the asc/desc pipe — not insertion order — decides the min/max pick.
const YEARS = ['2015', '2023', '2010', '2018']
const STORE: DataStore = {
  caps:        { queryTypes: ['obs'], batching: false, streaming: false, sync: false },
  classifiers: {},
  display:     { time: Object.fromEntries(YEARS.map((y) => [y, {}])) },
  querySync:   () => [],
} as unknown as DataStore

const spanOptions = (dir: 'asc' | 'desc') => ({
  type: 'inline' as const,
  items: { $d: 'time' },
  valueField: 'code',
  labelField: 'code',
  pipe: [{ op: 'sort', by: 'code', dir }],
})

const SCHEMA: FilterSchemaInput = {
  bars: {
    yearBar: {
      position: 'sticky',
      showWhen: { mode: { neq: 'range' } },
      filters: {
        mode: { type: 'hidden', default: 'year' },
        // spanFrom: asc-sorted, pick first → min year (2010)
        spanFrom: { type: 'hidden', default: { from: 'options', pick: 'first' }, options: spanOptions('asc') },
        // spanTo: desc-sorted, pick first → max year (2023)
        spanTo:   { type: 'hidden', default: { from: 'options', pick: 'first' }, options: spanOptions('desc') },
      },
    },
  },
  context: { dims: { spanFrom: 'spanFrom', spanTo: 'spanTo' } },
} as unknown as FilterSchemaInput

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, createElement(FilterProvider, null, children))
}

describe('hidden+options span default — current-mode CAGR endpoints', () => {
  it('resolves spanFrom → min year and spanTo → max year into ctx.dims (year mode)', () => {
    const { result } = renderHook(() => useFilterState(SCHEMA, STORE), { wrapper })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.ctx.dims['spanFrom']).toBe('2010')
    expect(result.current.ctx.dims['spanTo']).toBe('2023')
  })

  it('to > from over the full span — CAGR denominator (to-from) is the real 13y, not 0', () => {
    const { result } = renderHook(() => useFilterState(SCHEMA, STORE), { wrapper })
    const from = Number(result.current.ctx.dims['spanFrom'])
    const to   = Number(result.current.ctx.dims['spanTo'])
    expect(to - from).toBe(13)
    expect(to).toBeGreaterThan(from)
  })
})
