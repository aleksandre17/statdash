// ── perspective-p52.fitness — toggle-from-axis + KPI-when (engine half) [P5.2] ──
//
//  The engine-pure half of P5.2 (migrate the last System-A surfaces onto the
//  perspective model). Two contracts:
//
//   (1) FF-PERSPECTIVE-BAR-FROM-AXIS — the toggle's available list (id+label+icon)
//       derives from the parsed `PerspectiveAxis` via `perspectiveOptions`, NOT a
//       separately-registered ModeDef registry. Decision (B): the axis OWNS its
//       toggle presentation. The active id reads from `perspectiveState` via
//       `activeIdForAxis` (fallback perspectives[0]).
//   (1b) FF-PERSPECTIVE-BAR-EQUIV — the derived defs are byte-identical in `ka` to
//       what the live mode-bar rendered (the geostat PerspectiveDefs carry the
//       manifest.modes labels+icons), and locale-correct in `en` (the i18n
//       completion the ka-only mode-bar lacked).
//   (2) FF-KPI-WHEN-NOT-MODE — the visible-KPI set per perspective === the legacy
//       `mode`-filtered set, at BOTH `interpretKpis` (render) and
//       `extractKpiRequirements` (warm), via the ONE shared `kpiVisible` predicate;
//       and no `KpiSpec.mode` union survives (a `when` perspective-is gate replaces it).
//
//  Non-vacuous throughout: every assertion exercises a concrete per-perspective flip.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  perspectiveOptions, activeIdForAxis,
  interpretKpis, extractKpiRequirements,
  resolveLocaleString, evalVisibility,
} from '../index'
import type {
  PerspectiveAxis, KpiSpec, SectionContext, DataStore, EngineRow, StoreQuery,
  VisibilityExpr,
} from '../index'

// ── The geostat single axis (ka labels+icons === manifest.modes) ──────────────
const AXIS: PerspectiveAxis = {
  perspectives: [
    { id: 'year',  label: { ka: 'წლიური',  en: 'Annual'   }, icon: 'calendar',
      scope: { timeBinding: { dim: 'time', pin: { $ctx: 'year' } } } },
    { id: 'range', label: { ka: 'დინამიკა', en: 'Dynamics' }, icon: 'calendar-range',
      scope: { timeBinding: { dim: 'time', range: [{ $ctx: 'fromYear' }, { $ctx: 'toYear' }],
                              targetKeys: { from: 'fromYear', to: 'toYear' } } } },
  ],
}

// ── (1) FF-PERSPECTIVE-BAR-FROM-AXIS ──────────────────────────────────────────

describe('P5.2 (1) — the toggle available list derives FROM THE AXIS', () => {
  it('perspectiveOptions maps id + label(locale) + icon off each PerspectiveDef, in order', () => {
    const defs = perspectiveOptions(AXIS, 'ka', 'ka')
    expect(defs).toEqual([
      { id: 'year',  label: 'წლიური',  icon: 'calendar'       },
      { id: 'range', label: 'დინამიკა', icon: 'calendar-range' },
    ])
    // Order is the axis declaration order (= the nav-sort order).
    expect(defs.map(d => d.id)).toEqual(AXIS.perspectives.map(p => p.id))
  })

  it('a PerspectiveDef without an icon yields a ModeDef with no icon key (thin optional)', () => {
    const noIcon: PerspectiveAxis = { perspectives: [{ id: 'x', label: { ka: 'X', en: 'X' } }] }
    const [d] = perspectiveOptions(noIcon, 'ka', 'ka')
    expect(d).toEqual({ id: 'x', label: 'X' })
    expect('icon' in d).toBe(false)
  })

  it('the active id reads perspectiveState via activeIdForAxis (fallback perspectives[0])', () => {
    expect(activeIdForAxis(AXIS, 'mode', { mode: 'range' })).toBe('range')
    expect(activeIdForAxis(AXIS, 'mode', { mode: 'year'  })).toBe('year')
    expect(activeIdForAxis(AXIS, 'mode', undefined)).toBe('year')          // default = [0]
    expect(activeIdForAxis(AXIS, 'mode', { mode: 'bogus' })).toBe('year')  // unknown ⇒ default
  })
})

// ── (1b) FF-PERSPECTIVE-BAR-EQUIV ─────────────────────────────────────────────

describe('P5.2 (1b) — byte-identical in ka, locale-correct in en', () => {
  // The labels+icons the LIVE mode-bar rendered (manifest.modes, ka-only — both
  // locales showed the ka string). FROZEN here as the byte-identity oracle.
  const LIVE_MODE_BAR = [
    { id: 'year',  label: 'წლიური',  icon: 'calendar'       },
    { id: 'range', label: 'დინამიკა', icon: 'calendar-range' },
  ]

  it('ka: the axis-derived defs are byte-identical to the live mode-bar', () => {
    expect(perspectiveOptions(AXIS, 'ka', 'ka')).toEqual(LIVE_MODE_BAR)
  })

  it('en: the toggle now shows the English label (the i18n completion)', () => {
    const en = perspectiveOptions(AXIS, 'en', 'ka')
    expect(en.map(d => d.label)).toEqual(['Annual', 'Dynamics'])
    // icons unchanged across locale
    expect(en.map(d => d.icon)).toEqual(['calendar', 'calendar-range'])
    // NON-VACUOUS: en differs from the ka-only live bar (the gap that is now closed).
    expect(en[0].label).not.toBe(resolveLocaleString(AXIS.perspectives[0].label, 'ka', 'ka'))
  })
})

// ── (2) FF-KPI-WHEN-NOT-MODE ──────────────────────────────────────────────────

// A one-value-each stub store: interpretKpis only needs a scalar per measure.
const STUB_STORE: DataStore = {
  querySync(q: StoreQuery): EngineRow[] {
    return q.type === 'val' ? [{ value: 100 } as unknown as EngineRow] : []
  },
}

// A kpi-strip with a year-only, a range-only, and an unconditional card (the old
// 'both' — now `when` ABSENT). The legacy `mode` union mapped 1:1 onto these.
const SPECS: KpiSpec[] = [
  { id: 'y', label: 'Y', unit: '', color: '#000',
    when: { op: 'perspective-is', perspective: 'year' },
    value: { type: 'point', measure: 'Y', format: 'mln_gel' } },
  { id: 'r', label: 'R', unit: '', color: '#000',
    when: { op: 'perspective-is', perspective: 'range' },
    value: { type: 'point', measure: 'R', format: 'mln_gel' } },
  { id: 'b', label: 'B', unit: '', color: '#000',           // no `when` ⇒ every perspective
    value: { type: 'point', measure: 'B', format: 'mln_gel' } },
]

function ctxFor(active: string): SectionContext {
  // perspectiveState is the SSOT the kpiVisible predicate reads (seeded from the
  // active perspective id, exactly as SiteRenderer does).
  return { dims: { time: 2025 }, perspectiveState: { mode: active } }
}

describe('P5.2 (2) — KpiSpec.when replaces KpiSpec.mode (warm === render)', () => {
  it('interpretKpis shows exactly the year-perspective cards in the year perspective', () => {
    const out = interpretKpis(SPECS, ctxFor('year'), STUB_STORE)
    expect(out.map(k => k.label)).toEqual(['Y', 'B'])   // year-only + unconditional
  })

  it('interpretKpis shows exactly the range-perspective cards in the range perspective', () => {
    const out = interpretKpis(SPECS, ctxFor('range'), STUB_STORE)
    expect(out.map(k => k.label)).toEqual(['R', 'B'])   // range-only + unconditional
  })

  it('extractKpiRequirements warms EXACTLY the same visible set (no warm/render drift)', () => {
    // The warm requirement codes per perspective must match the rendered cards'
    // measures — the §0b kpi-strip-crash invariant. The shared `kpiVisible` SSOT
    // guarantees it: a card warmed-but-not-rendered (or vice-versa) is impossible.
    const yearCodes  = new Set(extractKpiRequirements(SPECS, ctxFor('year')).map(r => r.code))
    const rangeCodes = new Set(extractKpiRequirements(SPECS, ctxFor('range')).map(r => r.code))
    expect([...yearCodes].sort()).toEqual(['B', 'Y'])
    expect([...rangeCodes].sort()).toEqual(['B', 'R'])
    // NON-VACUOUS: the two perspectives genuinely warm different code sets.
    expect(yearCodes.has('Y')).toBe(true);  expect(yearCodes.has('R')).toBe(false)
    expect(rangeCodes.has('R')).toBe(true); expect(rangeCodes.has('Y')).toBe(false)
  })

  it('the visible set === the legacy mode-filtered set (the migration is faithful)', () => {
    // The legacy predicate `s.mode === 'both' || s.mode === ctx.timeMode` over the
    // pre-migration {year, range, both} authoring — replicated and asserted equal.
    const legacyMode: Record<string, 'year' | 'range' | 'both'> = { y: 'year', r: 'range', b: 'both' }
    for (const active of ['year', 'range']) {
      const legacy = SPECS
        .filter(s => legacyMode[s.id] === 'both' || legacyMode[s.id] === active)
        .map(s => s.id)
      const migrated = interpretKpis(SPECS, ctxFor(active), STUB_STORE).map(k => k.label.toLowerCase())
      expect(migrated).toEqual(legacy)
    }
  })

  it('no card carries a `mode` field — the privileged union is gone from the authoring', () => {
    for (const s of SPECS) expect('mode' in s).toBe(false)
  })
})

// ── kpi `when` uses the SAME context surface as renderNode (visibility SSOT) ──────
//
//  renderNode gates a node's `view.visibleWhen` with `evalVisibility(expr,
//  ctx.filterParams, ctx.sectionCtx.perspectiveState)`. The kpi `when` predicate
//  (kpiVisible, via interpretKpis/extractKpiRequirements) MUST evaluate against the
//  SAME `fr` surface — `filterParams`, NOT `ctx.dims` — so a future non-perspective
//  kpi `when` (eq/isset/in) behaves identically on a card and on a node. This pins
//  that agreement; before the fix the kpi path read `ctx.dims` and would diverge.

describe('kpi `when` agrees with renderNode visibility (same fr surface)', () => {
  // An eq-card gated on a RAW filter param (`region`), plus an unconditional card.
  const EQ_WHEN: VisibilityExpr = { op: 'eq', param: 'region', is: 'GE' }
  const EQ_SPECS: KpiSpec[] = [
    { id: 'geo', label: 'GEO', unit: '', color: '#000', when: EQ_WHEN,
      value: { type: 'point', measure: 'GEO', format: 'mln_gel' } },
    { id: 'b', label: 'B', unit: '', color: '#000',
      value: { type: 'point', measure: 'B', format: 'mln_gel' } },
  ]
  // dims.region is DELIBERATELY conflicting ('XX') to prove the predicate reads
  // filterParams, not dims. (perspectiveState present but irrelevant to an eq op.)
  const ctx: SectionContext = { dims: { region: 'XX' }, perspectiveState: { mode: 'year' } }

  it('the eq-card shows iff filterParams.region === "GE" (reads filterParams, not dims)', () => {
    const show = interpretKpis(EQ_SPECS, ctx, STUB_STORE, { region: 'GE' }).map(k => k.label)
    const hide = interpretKpis(EQ_SPECS, ctx, STUB_STORE, { region: 'XX' }).map(k => k.label)
    expect(show).toEqual(['GEO', 'B'])   // filterParams matches ⇒ visible
    expect(hide).toEqual(['B'])          // filterParams differs ⇒ hidden (dims='XX' is NOT consulted)
  })

  it('warm (extractKpiRequirements) gates on the SAME filterParams — no warm/render drift', () => {
    const warmShow = new Set(extractKpiRequirements(EQ_SPECS, ctx, { region: 'GE' }).map(r => r.code))
    const warmHide = new Set(extractKpiRequirements(EQ_SPECS, ctx, { region: 'XX' }).map(r => r.code))
    expect([...warmShow].sort()).toEqual(['B', 'GEO'])
    expect([...warmHide].sort()).toEqual(['B'])
  })

  it('kpi visibility === the literal renderNode call evalVisibility(expr, filterParams, ps)', () => {
    // The exact expression+surface renderNode passes; the kpi card is visible iff this is.
    for (const fp of [{ region: 'GE' }, { region: 'XX' }, {}]) {
      const renderNodeResult = evalVisibility(EQ_WHEN, fp, ctx.perspectiveState)
      const kpiVisible = interpretKpis(EQ_SPECS, ctx, STUB_STORE, fp)
        .some(k => k.label === 'GEO')
      expect(kpiVisible).toBe(renderNodeResult)
    }
  })
})
