// ── FF-RELATIVE-COORD — MDX Lag/ParallelPeriod member navigation [ADR-045] ───────
//
//  Locks the relative-coordinate grammar AND its honest edge:
//
//    FF-RELATIVE-COORD          — `{ $prev: n }` navigates the ORDERED MEMBER SET of a
//                                 dimension (MDX Lag), so a YoY growth metric evaluates
//                                 current/prior over that member set — NOT `value - n`
//                                 arithmetic (a member GAP is skipped, never read as 0).
//    FF-RELATIVE-EDGE-NO-DATA   — the first-period edge (no prior member) resolves to
//                                 the honest no-data state (Law 11): resolveMetricValue
//                                 → null, and the KPI renders `state:'no-data'`, NEVER a
//                                 fabricated 0 and never a crash.
//    FF-RELATIVE-GENERIC        — the token addresses ANY ordered dimension (Law 1) —
//                                 exercised over a NON-time coded axis via classifier
//                                 member order; time is merely the first consumer.
//    FF-RELATIVE-WARM-COVERS    — calcMetricRequirements DROPS a relative-token dim (warms
//                                 the whole axis) so member enumeration + the prior-member
//                                 read resolve from one superset slice; a token-FREE input
//                                 is byte-identical (FF-BIND-PARITY holds).
//
import { describe, it, expect } from 'vitest'

import { registerMetric } from './metric'
import { resolveMetricValue, calcMetricRequirements } from './metric-calc'
import { orderedMembers, navigateRelative } from './relative-coord'
import { interpretKpi } from './kpi'
import type { KpiSpec } from './kpi'
import { ExternalStore } from './store-impl'
import type { Observation, Classifier } from '../sdmx'

// growth-YoY expr: (cur / prev − 1) × 100 — REUSES @statdash/expr, no second dialect.
const YOY_EXPR = {
  op: 'mul',
  left:  { op: 'sub', left: { op: 'div', left: { $derived: 'cur' }, right: { $derived: 'prev' } }, right: 1 },
  right: 100,
} as const

// ── A GDP time series (contiguous) + a GAP series (2021 missing) ─────────────────
const obs: Observation[] = [
  { measure: 'GDP', value: 1000, time: 2021, geo: 'GE' },
  { measure: 'GDP', value: 1100, time: 2022, geo: 'GE' },
  { measure: 'GDP', value: 1210, time: 2023, geo: 'GE' },
  // GAP: only 2020 and 2022 — 2021 is absent (proves member-set nav ≠ arithmetic).
  { measure: 'GAP', value: 500,  time: 2020, geo: 'GE' },
  { measure: 'GAP', value: 600,  time: 2022, geo: 'GE' },
]
const store = new ExternalStore(obs)

registerMetric('metric:gdp-yoy', {
  label: { en: 'GDP growth YoY' },
  format: 'sign_pct',
  additivity: 'non-additive',      // a growth rate is NEVER summed (FF-NO-SUM-OF-RATIO class)
  calc: {
    inputs: {
      cur:  { measure: 'GDP' },                          // current coordinate (ctx.dims)
      prev: { measure: 'GDP', at: { time: { $prev: 1 } } }, // one member BACK over time
    },
    expr: YOY_EXPR,
  },
})

registerMetric('metric:gap-yoy', {
  label: { en: 'Gap growth YoY' },
  additivity: 'non-additive',
  calc: {
    inputs: {
      cur:  { measure: 'GAP' },
      prev: { measure: 'GAP', at: { time: { $prev: 1 } } },
    },
    expr: YOY_EXPR,
  },
})

// ── FF-RELATIVE-COORD ────────────────────────────────────────────────────────────

describe('FF-RELATIVE-COORD — $prev navigates the ordered member set (MDX Lag)', () => {
  it('a YoY growth metric evaluates cur/prev over consecutive members', () => {
    // 2023: (1210 / 1100 − 1) × 100 = 10
    expect(resolveMetricValue('metric:gdp-yoy', { dims: { time: 2023, geo: 'GE' } }, store)).toBeCloseTo(10)
    // 2022: (1100 / 1000 − 1) × 100 = 10
    expect(resolveMetricValue('metric:gdp-yoy', { dims: { time: 2022, geo: 'GE' } }, store)).toBeCloseTo(10)
  })

  it('navigation is over MEMBERS, not arithmetic — a gap year is SKIPPED', () => {
    // GAP members present = [2020, 2022] (2021 absent). $prev:1 from 2022 is the PRIOR
    // MEMBER (2020), so growth = (600/500 − 1)×100 = 20. Arithmetic (2022−1=2021) would
    // read an empty cell (0) and fabricate a wrong growth — the exact bug this fixes.
    expect(resolveMetricValue('metric:gap-yoy', { dims: { time: 2022, geo: 'GE' } }, store)).toBeCloseTo(20)
  })

  it('orderedMembers returns the ordered member set present at the slice', () => {
    expect(orderedMembers(store, 'GDP', 'time', { dims: { geo: 'GE' } })).toEqual([2021, 2022, 2023])
    expect(orderedMembers(store, 'GAP', 'time', { dims: { geo: 'GE' } })).toEqual([2020, 2022])
  })

  it('navigateRelative is off-the-edge below index 0 (never wraps or clamps)', () => {
    expect(navigateRelative([2021, 2022, 2023], 2023, { $prev: 1 })).toBe(2022)
    expect(navigateRelative([2021, 2022, 2023], 2023, { $prev: 2 })).toBe(2021)
    expect(navigateRelative([2021, 2022, 2023], 2021, { $prev: 1 })).toBeUndefined()  // off-edge
    expect(navigateRelative([2021, 2022, 2023], 1999, { $prev: 1 })).toBeUndefined()  // absent
  })
})

// ── FF-RELATIVE-EDGE-NO-DATA ──────────────────────────────────────────────────────

describe('FF-RELATIVE-EDGE-NO-DATA — the first period is honest no-data, never a fake 0', () => {
  it('resolveMetricValue returns null (no-data), not 0, at the first period', () => {
    // 2021 is the FIRST GDP member — $prev:1 is off-the-edge. The read must NOT be a
    // fabricated 0 (the div-by-zero lie); it is the honest no-data signal (null).
    expect(resolveMetricValue('metric:gdp-yoy', { dims: { time: 2021, geo: 'GE' } }, store)).toBeNull()
  })

  it('the KPI renders state:no-data at the first period (the canvas never lies)', () => {
    const spec: KpiSpec = {
      id: 'gdp-yoy', label: { en: 'GDP growth' }, color: '#4ECDC4',
      value: { type: 'metric', metric: 'metric:gdp-yoy', time: { $ctx: 'time' } },
    }
    const edge = interpretKpi(spec, { dims: { time: 2021, geo: 'GE' } }, store)
    expect(edge.state).toBe('no-data')      // honest declared state (KpiStateCard, not a number)

    const live = interpretKpi(spec, { dims: { time: 2023, geo: 'GE' } }, store)
    expect(live.state).toBeUndefined()      // `ok` is elided — a real value renders
    expect(live.value).toBe('10.0')         // fmtKpiPct(10) — the governed growth number
  })
})

// ── FF-RELATIVE-GENERIC — Law 1: $prev addresses ANY ordered dimension ────────────

describe('FF-RELATIVE-GENERIC — the token navigates a non-time coded axis', () => {
  // An ordered coded axis `phase` (p1→p2→p3), member order from the classifier codelist.
  const phaseClassifier: Classifier = [{ code: 'p1' }, { code: 'p2' }, { code: 'p3' }]
  const seqObs: Observation[] = [
    { measure: 'SEQ', value: 10, time: 2023, phase: 'p1' },
    { measure: 'SEQ', value: 20, time: 2023, phase: 'p2' },
    { measure: 'SEQ', value: 40, time: 2023, phase: 'p3' },
  ]
  const seqStore = new ExternalStore(seqObs, { classifiers: { phase: phaseClassifier } })

  registerMetric('metric:seq-step', {
    label: { en: 'Step over the phase axis' },
    calc: {
      inputs: {
        cur:  { measure: 'SEQ' },
        prev: { measure: 'SEQ', at: { phase: { $prev: 1 } } },  // one PHASE member back
      },
      expr: { op: 'sub', left: { $derived: 'cur' }, right: { $derived: 'prev' } },
    },
  })

  it('$prev navigates the phase codelist order (p3 → p2), never a hardcoded time axis', () => {
    // cur = SEQ@p3 (40), prev = SEQ@p2 (20) ⇒ 40 − 20 = 20 — pure Law-1 genericity.
    expect(resolveMetricValue('metric:seq-step', { dims: { time: 2023, phase: 'p3' } }, seqStore)).toBe(20)
    // p1 is the first phase member ⇒ off-the-edge ⇒ honest no-data (null).
    expect(resolveMetricValue('metric:seq-step', { dims: { time: 2023, phase: 'p1' } }, seqStore)).toBeNull()
  })
})

// ── FF-RELATIVE-WARM-COVERS — the warm set covers the read (no cold component) ─────

describe('FF-RELATIVE-WARM-COVERS — a relative dim is warmed as the whole axis', () => {
  it('drops the relative-token dim from the warm dims (full-axis warm), pins the rest', () => {
    const reqs = calcMetricRequirements('metric:gdp-yoy', { dims: { time: 2023, geo: 'GE' } })
    // cur: pinned at time 2023. prev: time DROPPED (whole axis) so member enumeration +
    // the prior-member point read both resolve from the one unbounded superset slice.
    expect(reqs).toEqual([
      { code: 'GDP', dims: { time: 2023, geo: 'GE' } },
      { code: 'GDP', dims: { geo: 'GE' } },
    ])
  })

  it('a token-FREE calc metric warms byte-identically (FF-BIND-PARITY unbroken)', () => {
    registerMetric('metric:sum-plain', {
      label: { en: 'Plain' },
      calc: {
        inputs: { a: { measure: 'GDP' }, b: { measure: 'GAP', at: { geo: 'GE' } } },
        expr: { op: 'add', left: { $derived: 'a' }, right: { $derived: 'b' } },
      },
    })
    expect(calcMetricRequirements('metric:sum-plain', { dims: { time: 2023, geo: 'GE' } })).toEqual([
      { code: 'GDP', dims: { time: 2023, geo: 'GE' } },
      { code: 'GAP', dims: { time: 2023, geo: 'GE' } },
    ])
  })
})
