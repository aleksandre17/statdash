// @vitest-environment jsdom
//
// ── Render order is authored `order`, NOT the config object's key order ────────
//
//  A published page config round-trips through Postgres jsonb, which does NOT
//  preserve object-key insertion order — it reorders keys by length, then
//  bytewise. So `toYear` (6 chars) is served BEFORE `fromYear` (8 chars) even
//  though the authored provisioning lists fromYear first. The bar builds its
//  render items from `Record<string, ParamDef>`, so relying on key order silently
//  renders the from→to year window REVERSED ("2025 მდე  2010 დან").
//
//  The fix: a param-level `order` (mirroring BarDef.order), stably sorted at the
//  render-items builder. This fitness pins the invariant DIRECTLY: a bar whose
//  `filters` object lists toYear BEFORE fromYear (the jsonb scramble) must STILL
//  render fromYear (order:10) before toYear (order:20). It also pins no-regression:
//  params with equal/absent `order` keep their incoming relative position.

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createElement, type ReactNode } from 'react'
import type { FilterSchemaInput } from '@statdash/engine'
import { FilterProvider } from '../context/FilterContext'
import { useFilterState } from './useFilterState'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, createElement(FilterProvider, null, children))
}

// The jsonb-scrambled bar: toYear is listed FIRST (as Postgres would serve it),
// fromYear SECOND — but `order` declares from(10) before to(20).
const SCRAMBLED_SCHEMA: FilterSchemaInput = {
  bars: {
    bar: {
      position: 'sticky',
      filters: {
        // NOTE: authored key order here is deliberately REVERSED vs intent.
        toYear:   { type: 'hidden', default: null, order: 20 },
        fromYear: { type: 'hidden', default: null, order: 10 },
      },
    },
  },
} as unknown as FilterSchemaInput

// A bar with NO `order` anywhere — items must keep their incoming (key) order,
// proving the sort is a no-op for existing bars (stable-sort no-regression).
const UNORDERED_SCHEMA: FilterSchemaInput = {
  bars: {
    bar: {
      position: 'sticky',
      filters: {
        alpha: { type: 'hidden', default: null },
        bravo: { type: 'hidden', default: null },
        gamma: { type: 'hidden', default: null },
      },
    },
  },
} as unknown as FilterSchemaInput

describe('filter render order — jsonb key-order independence', () => {
  it('renders fromYear(order:10) before toYear(order:20) even when keys are scrambled to-first', () => {
    const { result } = renderHook(() => useFilterState(SCRAMBLED_SCHEMA), { wrapper })
    const keys = result.current.bars[0].items.map((i) => i.key)
    // Intent order, NOT the config key order (which is [toYear, fromYear]).
    expect(keys).toEqual(['fromYear', 'toYear'])
  })

  it('leaves bars without `order` in their incoming key order (stable-sort, no regression)', () => {
    const { result } = renderHook(() => useFilterState(UNORDERED_SCHEMA), { wrapper })
    const keys = result.current.bars[0].items.map((i) => i.key)
    expect(keys).toEqual(['alpha', 'bravo', 'gamma'])
  })
})
