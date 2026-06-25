// ── FF-TIMEDIMENSION — R5 first-class time equivalence net ────────────
//
//  Locks the ADR R5 (adr_data_reference_render_vision) invariant: the THREE
//  legacy time forms — `YearsSpec` (years on timeseries/growth), `fromDim`/
//  `toDim` (range clamp), and time in ObsQuery.filter — and an EQUIVALENT
//  canonical `timeDimension { dim, range, granularity? }` produce ROW-IDENTICAL
//  resolved output. ADDITIVE + Postel: every legacy spec resolves byte-identically
//  whether or not it carries a timeDimension.
//
//  Plus the Law-1 guard: time is always resolved through the TIME_DIM SSOT —
//  no hardcoded 'time' literal was introduced by R5.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { interpretSpec }        from '../data/spec'
import { ExternalStore }        from '../data/store-impl'
import { TIME_DIM }             from './context'
import { resolveTimeDimension, effectiveYears } from './time-dimension'
import type { DataSpec }        from '../config/data-spec'
import type { SectionContext }  from './context'
import type { Observation }     from '../sdmx'

const obs: Observation[] = [
  { measure: 'B1G', value: 1000, time: 2023, geo: 'GE', label: 'GDP', isCarryForward: 0 },
  { measure: 'B1G', value:  900, time: 2022, geo: 'GE', label: 'GDP', isCarryForward: 0 },
  { measure: 'B1G', value:  800, time: 2021, geo: 'GE', label: 'GDP', isCarryForward: 0 },
  { measure: 'B1G', value:  700, time: 2020, geo: 'GE', label: 'GDP', isCarryForward: 0 },
]
const store = new ExternalStore(obs)
const ctx: SectionContext = { timeMode: 'year', dims: { time: 2023, geo: 'GE' } }

describe('FF-TIMEDIMENSION — YearsSpec ↔ timeDimension.range (years list)', () => {
  it('timeseries: legacy years == timeDimension range (YearsSpec)', () => {
    const legacy: DataSpec = { type: 'timeseries', code: 'B1G', years: [2021, 2022, 2023] }
    // Equivalent canonical form — years moved into timeDimension.range. `years`
    // stays required by type; the canonical author still supplies it, so this
    // exercises the additive coexistence (both present, legacy wins identically).
    const canonical: DataSpec = {
      type: 'timeseries', code: 'B1G', years: [2021, 2022, 2023],
      timeDimension: { dim: TIME_DIM, range: [2021, 2022, 2023] },
    }
    expect(interpretSpec(canonical, ctx, store)).toEqual(interpretSpec(legacy, ctx, store))
  })

  it('growth: legacy years == timeDimension range (YearsSpec)', () => {
    const legacy: DataSpec = { type: 'growth', code: 'B1G', years: [2021, 2022, 2023] }
    const canonical: DataSpec = {
      type: 'growth', code: 'B1G', years: [2021, 2022, 2023],
      timeDimension: { dim: TIME_DIM, range: [2021, 2022, 2023] },
    }
    expect(interpretSpec(canonical, ctx, store)).toEqual(interpretSpec(legacy, ctx, store))
  })

  it('effectiveYears: timeDimension.range supplies years when legacy years absent', () => {
    // The only path where timeDimension drives the year selection alone.
    const td = { dim: TIME_DIM, range: [2020, 2021] as readonly number[] }
    expect(effectiveYears({ timeDimension: td })).toEqual([2020, 2021])
    // Legacy years ALWAYS wins on overlap (Postel).
    expect(effectiveYears({ years: [2022], timeDimension: td })).toEqual([2022])
  })
})

describe('FF-TIMEDIMENSION — fromDim/toDim ↔ timeDimension.range ([from,to] ctx refs)', () => {
  const clampCtx: SectionContext = { ...ctx, dims: { ...ctx.dims, from: 2022, to: 2023 } }

  it('timeseries: fromDim/toDim folds byte-identically into [{$ctx},{$ctx}]', () => {
    const legacy: DataSpec = {
      type: 'timeseries', code: 'B1G', years: [2020, 2021, 2022, 2023],
      fromDim: 'from', toDim: 'to',
    }
    const canonical: DataSpec = {
      type: 'timeseries', code: 'B1G', years: [2020, 2021, 2022, 2023],
      timeDimension: { dim: TIME_DIM, range: [{ $ctx: 'from' }, { $ctx: 'to' }] },
    }
    const legacyRows    = interpretSpec(legacy, clampCtx, store)
    const canonicalRows = interpretSpec(canonical, clampCtx, store)
    expect(legacyRows.map((r) => r.label)).toEqual(['2022', '2023'])
    expect(canonicalRows).toEqual(legacyRows)
  })

  it('timeseries: a 2-literal range is a YearsSpec (explicit list), not a clamp', () => {
    // DISAMBIGUATION CONTRACT: a tuple of two LITERALS is a YearsSpec (selects
    // those years), reserving the [from,to] CLAMP form for ctx-ref bounds (the
    // fold target of fromDim/toDim). Here legacy `years` is omitted so the range
    // alone drives selection via effectiveYears.
    const literal = {
      type: 'timeseries' as const, code: 'B1G',
      years: undefined as unknown as readonly number[],
      timeDimension: { dim: TIME_DIM, range: [2022, 2023] as readonly number[] },
    } as unknown as DataSpec
    expect(interpretSpec(literal, clampCtx, store).map((r) => r.label)).toEqual(['2022', '2023'])
  })

  it('query: fromDim/toDim folds byte-identically into [{$ctx},{$ctx}]', () => {
    const legacy: DataSpec = {
      type: 'query', query: { measure: 'B1G' },
      encoding: { label: 'time', value: 'value' },
      fromDim: 'from', toDim: 'to',
    }
    const canonical: DataSpec = {
      type: 'query', query: { measure: 'B1G' },
      encoding: { label: 'time', value: 'value' },
      timeDimension: { dim: TIME_DIM, range: [{ $ctx: 'from' }, { $ctx: 'to' }] },
    }
    const legacyRows    = interpretSpec(legacy, clampCtx, store)
    const canonicalRows = interpretSpec(canonical, clampCtx, store)
    expect(legacyRows.map((r) => Number(r['time']))).toEqual([2023, 2022])
    expect(canonicalRows).toEqual(legacyRows)
  })

  it('query: empty ctx-ref bounds reproduce the legacy "no bound" outcome', () => {
    // ctx has no from/to → both bounds resolve to falsy → no clamp (all rows).
    const legacyNoBound: DataSpec = {
      type: 'query', query: { measure: 'B1G' },
      encoding: { label: 'time', value: 'value' },
      fromDim: 'missingFrom', toDim: 'missingTo',
    }
    const canonicalNoBound: DataSpec = {
      type: 'query', query: { measure: 'B1G' },
      encoding: { label: 'time', value: 'value' },
      timeDimension: { dim: TIME_DIM, range: [{ $ctx: 'missingFrom' }, { $ctx: 'missingTo' }] },
    }
    expect(interpretSpec(canonicalNoBound, ctx, store)).toEqual(interpretSpec(legacyNoBound, ctx, store))
  })
})

describe('FF-TIMEDIMENSION — Postel: legacy specs unchanged + granularity inert', () => {
  it('legacy spec with NO timeDimension resolves exactly as before', () => {
    const legacy: DataSpec = { type: 'timeseries', code: 'B1G', years: [2021, 2022, 2023] }
    const rows = interpretSpec(legacy, ctx, store)
    expect(rows.map((r) => r.value)).toEqual([800, 900, 1000])
  })

  it('granularity is carried metadata only — does not alter resolution', () => {
    const withGrain: DataSpec = {
      type: 'timeseries', code: 'B1G', years: [2022, 2023],
      timeDimension: { dim: TIME_DIM, granularity: 'year' },
    }
    const without: DataSpec = { type: 'timeseries', code: 'B1G', years: [2022, 2023] }
    expect(interpretSpec(withGrain, ctx, store)).toEqual(interpretSpec(without, ctx, store))
  })

  it('resolveTimeDimension: range absent ⇒ no constraint', () => {
    expect(resolveTimeDimension({ dim: TIME_DIM }, ctx)).toEqual({ from: 0, to: Infinity })
  })

  it('legacy fromDim/toDim WINS over timeDimension on overlap (Postel)', () => {
    const clampCtx: SectionContext = { ...ctx, dims: { ...ctx.dims, from: 2022, to: 2023, other: 2099 } }
    const spec: DataSpec = {
      type: 'timeseries', code: 'B1G', years: [2020, 2021, 2022, 2023],
      fromDim: 'from', toDim: 'to',
      // timeDimension would clamp to a different window — but legacy wins.
      timeDimension: { dim: TIME_DIM, range: [{ $ctx: 'other' }, { $ctx: 'other' }] },
    }
    expect(interpretSpec(spec, clampCtx, store).map((r) => r.label)).toEqual(['2022', '2023'])
  })
})

describe('FF-TIMEDIMENSION — Law 1: no hardcoded time literal introduced by R5', () => {
  it('time-dimension.ts resolves the axis via TIME_DIM, never a raw time literal', () => {
    const src = readFileSync(
      fileURLToPath(new URL('./time-dimension.ts', import.meta.url)), 'utf8',
    )
    // Strip comments/strings-in-docs: assert no quoted 'time' / "time" literal is
    // used as a dimension key. The module reads bounds from ctx.dims via author-
    // supplied generic keys + the Ref dispatcher; it must not pin 'time' itself.
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/['"]time['"]/)
  })
})
