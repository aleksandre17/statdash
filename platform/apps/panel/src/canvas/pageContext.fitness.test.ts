// ── FF-PAGE-CTX-PROJECTED — the workbench preview evaluates under the page ctx (0112 R1) ──
//
//  The Data workbench preview used to hard-code `ctx.dims = {}`, so a section `query` with
//  a `$ctx` ref resolved empty → 0 preview rows while the canvas (which renders under the
//  page's real default dims) showed full data. The panel now adapts
//  `deriveDefaultFilterState` — the provider-FREE zoom of the SAME `filterCtxCore` the
//  renderer's `useFilterState` composes (@statdash/react) — so the divergence class dies
//  STRUCTURALLY (one core, two zooms, no copied rule):
//    • context.dims maps a param's resolved DEFAULT onto its ctx dim (folded per-type).
//    • Tier-1 literal / Tier-2 ExprVal defaults resolve outside the FilterProvider.
//    • Tier-3 (options-first) defaults resolve off the given PAGE STORE — the tier the
//      first cut dropped (the live-recheck FAIL: gdp's options-first `time` default).
//    • no store ⇒ Tier-3 is honestly PENDING (isLoading), never a fake ''-match.
//    • no `context.dims` ⇒ `{}` (the pre-fix behaviour — zero regression).
//
import { describe, it, expect } from 'vitest'
import type { FilterSchemaInput, DataStore } from '@statdash/engine'
import { deriveDefaultFilterState } from '@statdash/react'

describe('FF-PAGE-CTX-PROJECTED — the ONE derivation folds page defaults into ctx.dims', () => {
  it('maps a context dim to its param DEFAULT, folded per-type (year-select → number)', () => {
    const schema: FilterSchemaInput = {
      bars: { main: { filters: { year: { type: 'year-select', default: 2024 } } } },
      context: { dims: { time: 'year' } },
    }
    // The canvas resolves ctx.dims.time = 2024 (year-select → number via toCtxValue); the
    // preview now derives the SAME — never the old empty `{}` that starved a `$ctx.time` ref.
    expect(deriveDefaultFilterState(schema).ctx.dims).toEqual({ time: 2024 })
  })

  it('resolves multiple dims across bars and drops an UNSET (no-default) dim honestly', () => {
    const schema: FilterSchemaInput = {
      bars: {
        main:  { filters: { year:   { type: 'year-select', default: 2020 } } },
        extra: { filters: { region: { type: 'select', default: 'R1', options: { source: [] } } as never } },
        empty: { filters: { measure: { type: 'select', options: { source: [] } } as never } },
      },
      context: { dims: { time: 'year', geo: 'region', measure: 'measure' } },
    }
    const { ctx } = deriveDefaultFilterState(schema)
    expect(ctx.dims.time).toBe(2020)
    expect(ctx.dims.geo).toBe('R1')
    // measure has NO default and no options rows → ABSENT, never a spurious
    // match-nothing value (Law 11 — honest empty, not a fake).
    expect('measure' in ctx.dims).toBe(false)
  })

  it('a Tier-3 options-first default resolves off the PAGE STORE (the live-recheck gap)', () => {
    const schema: FilterSchemaInput = {
      bars: {
        main: {
          filters: {
            year: {
              type: 'select',
              options: { type: 'static', items: [{ value: '2019', label: '2019' }, { value: '2024', label: '2024' }] },
              default: { from: 'options', pick: 'last' },
            } as never,
          },
        },
      },
      context: { dims: { time: 'year' } },
    }
    // A static options source ignores store reads (the STUB-ctx guarantee) — the stub
    // store's presence is what UNLOCKS the Tier-3 getter (no store → pending, below).
    const store = {} as DataStore
    const derived = deriveDefaultFilterState(schema, store)
    expect(derived.ctx.dims.time).toBe('2024')    // pick:'last' off the resolved options
    expect(derived.isLoading).toBe(false)
  })

  it('with NO store a Tier-3 default is honestly PENDING — never a fake empty match', () => {
    const schema: FilterSchemaInput = {
      bars: {
        main: {
          filters: {
            year: { type: 'year-select', years: { from: 2019, to: 2024 }, default: { from: 'options', pick: 'last' } } as never,
          },
        },
      },
      context: { dims: { time: 'year' } },
    }
    const derived = deriveDefaultFilterState(schema)
    expect('time' in derived.ctx.dims).toBe(false)
    expect(derived.isLoading).toBe(true)
  })

  it('a page with NO context.dims yields `{}` — the pre-fix behaviour, zero regression', () => {
    const schema: FilterSchemaInput = {
      bars: { main: { filters: { year: { type: 'year-select', default: 2024 } } } },
    }
    expect(deriveDefaultFilterState(schema).ctx.dims).toEqual({})
    expect(deriveDefaultFilterState(undefined).ctx.dims).toEqual({})
  })
})
