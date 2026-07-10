// @vitest-environment node
//
// ── FF-GRAPH-PARITY (LIVE) + the V2 shadow-mode divergence findings [AR-49 V2] ─
//
//  Flips the V1 `it.todo('FF-GRAPH-PARITY')` scaffold to a REAL assertion. The
//  reactive query graph (compilePage → pull-lazy/push-invalidate) runs in SHADOW
//  MODE alongside the current path; `runShadowParity` diffs, per transition:
//    ① changed ⊆ invalidated   (no under-fire — every genuinely-changed node recomputes)
//    ② graph.get(n) == oracle   (value parity — skipped nodes serve correct memos)
//    ③ over-fire reported        (the graph's residual over-fire vs the coarse baseline)
//
//  The derivation body is INJECTED (`coreDerive`) — a core-expressible MIRROR of
//  react's `resolveNodeRows` (interpretSpec → encoding-ref lowering → applyEncoding →
//  pipe-ref lowering → applyPipeline → localize). The SAME body computes the graph's
//  cells AND the oracle, so any divergence is attributable to the graph's memo/invalidate
//  decisions alone (the render body is not forked; react injects the real one at V3).
//
//  ── TWO DEMONSTRATED DIVERGENCES (the V2 deliverable — reported, not papered over) ──
//  Shadow VALUE-parity surfaces two dependency classes that ref-TOTALITY (FF-EXTRACTDEPS-
//  TOTAL) structurally cannot see — both are the "dependency a static walk cannot see"
//  class extractDeps' own header flags. They are characterized here (asserted to EXIST)
//  and escalated: the V3 render-switch is NOT render-safe until extractDeps' dependency
//  MODEL is widened. See the report / MEMORY for the fix direction.
//    A · `val`-based specs (timeseries/growth/row-list/ratio-list) read the WHOLE ambient
//        `ctx.dims` coordinate (`_val` → `matchedValues`, store-impl.ts:291), so they
//        implicitly depend on EVERY dim in the active coordinate — but extractDeps records
//        only TIME_DIM for them. A non-time ambient dim change (geo) changes their value
//        with NO edge → the graph serves a STALE value (under-fire).
//    B · A `$d`/`$cl` display-JOIN yields locale-dependent row LABELS (tagged, resolved at
//        the boundary), but `deps.locale` is set only for localized DISPLAY FIELDS, never
//        for a row-label join → a locale toggle changes the rows with NO edge (under-fire).

import { describe, it, expect } from 'vitest'
import { runShadowParity, type ShadowStep } from './shadow'
import type { GraphState, DeriveFn } from './compilePage'
import type { DepNode } from './extractDeps'

import { interpretSpec }                        from '../data/spec'
import { resolveEncodingRefs, applyEncoding }   from '../data/encoding'
import { resolvePipeRefs }                      from '../data/transform/resolve-refs'
import { applyPipeline }                        from '../data/transform/pipeline'
import { storeVal }                             from '../data/store'
import { ExternalStore }                        from '../data/store-impl'
import { isTaggedLocaleString, resolveLocaleString } from '../i18n/types'
import type { SectionContext }                  from '../core/context'
import type { DataStore }                       from '../data/store'

// ── coreDerive — the core-expressible mirror of react's resolveNodeRows ────────
//  Same body, same order; the ONLY omissions are the react-layer concerns (CachedStore
//  wrapping, cross-store `blend` desugar) — irrelevant to a single-store parity corpus.
type Rows = Record<string, unknown>[]
function makeDerive(store: DataStore): DeriveFn<Rows> {
  const localize = (rows: Rows, locale?: string): Rows =>
    rows.map((row) => {
      let copy: Record<string, unknown> | undefined
      for (const k of Object.keys(row)) {
        if (isTaggedLocaleString(row[k])) {
          copy ??= { ...row }
          copy[k] = resolveLocaleString(row[k] as never, locale ?? 'en', 'en')
        }
      }
      return copy ?? row
    })

  return (node: DepNode, state: GraphState): Rows => {
    const ctx: SectionContext = {
      dims:             (state.dims ?? {}) as SectionContext['dims'],
      locale:           state.locale,
      perspectiveState: state.perspectiveState,
    }
    const vars = state.vars ?? {}
    const data = node['data'] as Record<string, unknown> | undefined
    if (!data) return []

    const pipe0 = data['pipe'] as never[] | undefined
    const dataSpec = pipe0?.length
      ? { ...data, pipe: resolvePipeRefs(pipe0, { dims: ctx.dims, vars }) }
      : data
    const raw = localize(interpretSpec(dataSpec as never, ctx, store) as Rows, ctx.locale)

    const enc0 = data['encoding'] as never | undefined
    const enc  = enc0 ? resolveEncodingRefs(enc0, { dims: ctx.dims, vars }) : undefined
    let rows: Rows = enc
      ? (applyEncoding(raw as never, enc, (code) => storeVal(store, code, ctx)) as unknown as Rows)
      : raw

    const transforms = node['transforms'] as never[] | undefined
    if (transforms?.length) {
      const resolved = resolvePipeRefs(transforms, { dims: ctx.dims, vars })
      rows = applyPipeline(rows as never, resolved, {
        classifiers: store.classifiers, display: store.display, section: ctx,
      }) as Rows
    }
    return localize(rows, ctx.locale)
  }
}

// ── The parity store — GVA across geo × sector × approach × time ───────────────
const OBS = [
  { measure: 'GVA', geo: 'R1', sector: 'A', approach: 'PROD', time: 2022, value: 10 },
  { measure: 'GVA', geo: 'R1', sector: 'A', approach: 'PROD', time: 2023, value: 12 },
  { measure: 'GVA', geo: 'R1', sector: 'B', approach: 'PROD', time: 2023, value: 5 },
  { measure: 'GVA', geo: 'R2', sector: 'A', approach: 'PROD', time: 2022, value: 20 },
  { measure: 'GVA', geo: 'R2', sector: 'A', approach: 'PROD', time: 2023, value: 24 },
  { measure: 'GVA', geo: 'R2', sector: 'B', approach: 'PROD', time: 2023, value: 9 },
]
const soundStore = new ExternalStore(OBS)

// ── The SOUND corpus — pure `query` specs whose rows change ONLY via a named ─────
//  `$ctx` filter dim (the class extractDeps models exactly). chart-static's filter is
//  a LITERAL pin — no state edge — so it must NEVER invalidate on a dim change (the
//  exact-invalidation proof); its `perspective` visibleWhen is the over-fire probe.
const soundPage = {
  type: 'page',
  sections: [{
    type: 'section',
    children: [
      { type: 'chart', id: 'chart-geo',    data: { type: 'query', query: { measure: 'GVA', filter: { geo:    { $ctx: 'geo' } } } } },
      { type: 'chart', id: 'chart-sector', data: { type: 'query', query: { measure: 'GVA', filter: { sector: { $ctx: 'sector' } } } } },
      { type: 'chart', id: 'chart-time',   data: { type: 'query', query: { measure: 'GVA', filter: { time:   { $ctx: 'time' } } } } },
      {
        type: 'chart', id: 'chart-static',
        // Literal-pin filter (no $ctx) — rows independent of state. A perspective
        // visibleWhen makes it the perspective OVER-FIRE probe (visibility ≠ rows).
        data: { type: 'query', query: { measure: 'GVA', filter: { approach: 'PROD' } } },
        view: { visibleWhen: { op: 'perspective-is', perspective: 'range', param: 'mode' } },
      },
    ],
  }],
}

const S = (label: string, dims: Record<string, unknown>, mode = 'year'): ShadowStep =>
  ({ label, state: { dims, perspectiveState: { mode } } })

describe('FF-GRAPH-PARITY — shadow-mode graph ≡ current path (V2, LIVE)', () => {
  const sequence: ShadowStep[] = [
    S('s0 initial',        { geo: 'R1', sector: 'A', time: 2022 }),
    S('geo R1→R2',         { geo: 'R2', sector: 'A', time: 2022 }),
    S('sector A→B',        { geo: 'R2', sector: 'B', time: 2022 }),
    S('time 2022→2023',    { geo: 'R2', sector: 'B', time: 2023 }),
    S('perspective→range', { geo: 'R2', sector: 'B', time: 2023 }, 'range'),
    S('no-op equal write', { geo: 'R2', sector: 'B', time: 2023 }, 'range'),
  ]
  const report = runShadowParity(soundPage, makeDerive(soundStore), sequence)
  const byLabel = (l: string) => report.transitions.find((t) => t.label === l)!

  it('parity holds across every interaction (no under-fire, no value mismatch)', () => {
    for (const t of report.transitions) {
      expect(t.underFired, `${t.label}: STALE nodes (graph missed a real change)`).toEqual([])
      expect(t.valueMismatches, `${t.label}: value divergence`).toEqual([])
    }
    expect(report.ok).toBe(true)
  })

  it('a named-$ctx dim change invalidates EXACTLY its dependent (exact fan-out)', () => {
    expect([...byLabel('geo R1→R2').invalidated].sort()).toEqual(['chart-geo'])
    expect([...byLabel('sector A→B').invalidated].sort()).toEqual(['chart-sector'])
    expect([...byLabel('time 2022→2023').invalidated].sort()).toEqual(['chart-time'])
  })

  it('a literal-pin node never invalidates on a dim change; the graph beats the coarse baseline', () => {
    for (const l of ['geo R1→R2', 'sector A→B', 'time 2022→2023']) {
      expect(byLabel(l).invalidated).not.toContain('chart-static')
      // The win: exact fan-out (1) ≪ coarse walk (all 4 data nodes).
      expect(byLabel(l).exactInvalidated).toBeLessThan(byLabel(l).coarseWalk)
    }
  })

  it('perspective is a VISIBILITY dep, not a rows dep — over-fire with value parity intact', () => {
    const t = byLabel('perspective→range')
    // chart-static is invalidated by its perspective visibleWhen, yet its ROWS are
    // unchanged ⇒ pure over-fire, value parity holds (the observation: V3 should route
    // perspective deps to the visibility sub-node, not the rows cell).
    expect(t.overFired).toContain('chart-static')
    expect(t.changed).not.toContain('chart-static')
    expect(t.valueMismatches).toEqual([])
  })

  it('writing an equal value re-evaluates ZERO nodes', () => {
    expect(byLabel('no-op equal write').invalidated).toEqual([])
  })
})

// ── V2 FINDING A — `val`-based specs under-fire on an ambient (non-time) dim ────
//  A `timeseries` reads `storeVal` at `atTime(y, ctx)`; `_val` matches the WHOLE
//  ctx.dims coordinate, so its value depends on ambient `geo`. extractDeps records
//  only TIME_DIM ⇒ a geo change does NOT invalidate it ⇒ STALE. This is the crux
//  divergence: shadow VALUE-parity catches what ref-totality cannot.
describe('V2 FINDING A — val-based spec under-fires on ambient-coordinate change', () => {
  const page = { type: 'page', children: [
    { type: 'chart', id: 'ts', data: { type: 'timeseries', code: 'GVA', years: [2022, 2023] } },
  ] }
  const report = runShadowParity(page, makeDerive(soundStore), [
    S('s0', { geo: 'R1', time: 2023 }),
    S('geo R1→R2 (ambient)', { geo: 'R2', time: 2023 }),
  ])
  const t = report.transitions[0]!

  it('the timeseries VALUE genuinely changes with geo (the oracle sees it)', () => {
    expect(t.changed).toContain('ts')
  })
  it('DIVERGENCE: the graph does NOT invalidate it — a staleness under-fire (report NOT ok)', () => {
    expect(t.underFired).toContain('ts')
    expect(t.valueMismatches).toContain('ts')
    expect(report.ok).toBe(false)
  })
})

// ── V2 FINDING B — a $d row-label join is locale-dependent but not `deps.locale` ──
//  The `$d` join tags a LocaleString label (steps.ts) resolved per-locale at the
//  boundary; extractDeps marks classifier:geo but NOT locale (locale is set only for
//  localized DISPLAY FIELDS). A locale toggle changes the rows with no edge ⇒ under-fire.
describe('V2 FINDING B — a $d-join label is locale-dependent but unmarked for locale', () => {
  const labelStore = new ExternalStore(OBS, {
    classifiers: { geo: [{ code: 'R1' }, { code: 'R2' }] },
    display: {
      geo: {
        R1: { label: { en: 'Region 1', ka: 'რეგიონი 1' } },
        R2: { label: { en: 'Region 2', ka: 'რეგიონი 2' } },
      },
    },
  })
  const page = { type: 'page', children: [
    { type: 'chart', id: 'loc', data: {
      type: 'query', query: { measure: 'GVA' },
      pipe: [{ op: 'lookup', from: { $d: 'geo' }, key: 'geo', fields: ['label'] }],
      encoding: { label: 'label', value: 'value' },
    } },
  ] }
  const report = runShadowParity(page, makeDerive(labelStore), [
    { label: 's0 en', state: { dims: { geo: 'R1' }, locale: 'en' } },
    { label: 'locale en→ka', state: { dims: { geo: 'R1' }, locale: 'ka' } },
  ])
  const t = report.transitions[0]!

  it('the joined labels genuinely change with locale (the oracle sees it)', () => {
    expect(t.changed).toContain('loc')
  })
  it('DIVERGENCE: the graph does NOT invalidate it on a locale toggle — under-fire', () => {
    expect(t.underFired).toContain('loc')
    expect(report.ok).toBe(false)
  })
})
