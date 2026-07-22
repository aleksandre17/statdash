// ── FF-PAGE-CTX-PROJECTED — the workbench preview evaluates under the page ctx (0112 R1) ──
//
//  The Data workbench preview used to hard-code `ctx.dims = {}`, so a section `query` with
//  a `$ctx` ref resolved empty → 0 preview rows while the canvas (which renders under the
//  page's real default dims) showed full data. `deriveDefaultDims` is the panel-side
//  PROJECTION of the engine's default-dims derivation — the SAME `resolveDefaults` +
//  `toCtxValue` primitives `useFilterState` uses — so the divergence class dies:
//    • context.dims maps a param's resolved DEFAULT onto its ctx dim (folded per-type).
//    • a Tier-1 literal / Tier-2 ExprVal default resolves outside the FilterProvider.
//    • no `context.dims` ⇒ `{}` (the pre-fix behaviour — zero regression).
//
import { describe, it, expect } from 'vitest'
import type { FilterSchemaInput } from '@statdash/engine'
import { deriveDefaultDims } from './pageContext'

describe('FF-PAGE-CTX-PROJECTED — deriveDefaultDims folds page defaults into ctx.dims', () => {
  it('maps a context dim to its param DEFAULT, folded per-type (year-select → number)', () => {
    const schema: FilterSchemaInput = {
      bars: { main: { filters: { year: { type: 'year-select', default: 2024 } } } },
      context: { dims: { time: 'year' } },
    }
    // The canvas resolves ctx.dims.time = 2024 (year-select → number via toCtxValue); the
    // preview now derives the SAME — never the old empty `{}` that starved a `$ctx.time` ref.
    expect(deriveDefaultDims(schema)).toEqual({ time: 2024 })
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
    const dims = deriveDefaultDims(schema)
    expect(dims.time).toBe(2020)
    expect(dims.geo).toBe('R1')
    // measure has NO default and no reachable options outside the provider → ABSENT, never a
    // spurious match-nothing value (Law 11 — honest empty, not a fake).
    expect('measure' in dims).toBe(false)
  })

  it('a page with NO context.dims yields `{}` — the pre-fix behaviour, zero regression', () => {
    const schema: FilterSchemaInput = {
      bars: { main: { filters: { year: { type: 'year-select', default: 2024 } } } },
    }
    expect(deriveDefaultDims(schema)).toEqual({})
    expect(deriveDefaultDims(undefined)).toEqual({})
  })
})
