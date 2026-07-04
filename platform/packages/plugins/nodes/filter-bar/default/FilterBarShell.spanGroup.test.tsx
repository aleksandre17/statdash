// @vitest-environment jsdom
//
// ── from→to span-group composition (dynamics year window) ─────────────────────
//
//  The dynamics range picker is TWO independent `type:'select'` params — fromYear
//  and toYear — each keeping its own options, default, and ctx-key write (the
//  two-key filter pipeline). This gate proves the FILTER-BAR composes their render
//  into ONE localized template WITHOUT collapsing the two keys:
//
//    en (preposition):  from [fromYear] to [toYear]
//    ka (postposition): [fromYear] დან [toYear] მდე
//
//  Two seams are mocked to keep this a focused unit on the WRAP behaviour:
//   • @statdash/react        → useT resolves against the REAL spanI18n catalog for a
//                              controllable locale (so we assert real connector words,
//                              not i18n keys).
//   • @statdash/react/engine → useFiltersContext (the bar) + filterControlRegistry
//                              (a stub select that surfaces the filterKey it writes).
//  evalVisibility (perspective gating) stays REAL — the range/year split is genuine.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { spanI18n } from './meta'

// Controllable active locale for the mocked useT.
let LOCALE: 'ka' | 'en' = 'en'
vi.mock('@statdash/react', () => ({
  useT: (_ns: string) => (key: string) =>
    (spanI18n as Record<string, Record<string, string>>)[LOCALE][key] ?? '',
}))

// The migrated dynamics bar: fromYear + toYear are spanRole-tagged range selects;
// mode is a hidden carrier; year is the year-perspective selector. Order matters —
// the two endpoints must read left→right as one window even with a hidden param
// between them.
const RANGE_ONLY = { op: 'perspective-is', perspective: 'range' } as const
const YEAR_ONLY = { op: 'perspective-is', perspective: 'year' } as const
const BARS = [
  {
    type: 'bar', id: 'bar', position: 'sticky', order: 0,
    items: [
      { key: 'fromYear', type: 'select', spanRole: 'from', options: { type: 'static', items: [] }, visibleWhen: RANGE_ONLY },
      { key: 'mode',     type: 'hidden' },
      { key: 'toYear',   type: 'select', spanRole: 'to',   options: { type: 'static', items: [] }, visibleWhen: RANGE_ONLY },
      { key: 'year',     type: 'year-select', visibleWhen: YEAR_ONLY },
    ],
  },
]

// Stub controls: a select surfaces the filterKey it writes (proves the two-key
// wiring survives); a hidden renders nothing (as HiddenShell does).
vi.mock('@statdash/react/engine', () => ({
  useFiltersContext: () => ({ bars: BARS }),
  filterControlRegistry: {
    get: (type: string) =>
      type === 'hidden'
        ? { Shell: () => null }
        : { Shell: ({ filterKey }: { filterKey: string }) =>
            <select data-testid={`sel-${filterKey}`} aria-label={filterKey} /> },
  },
}))

import { render, screen, cleanup } from '@testing-library/react'
import type { ReactElement } from 'react'
import { FilterBarShell } from './FilterBarShell'
import type { RenderContext } from '@statdash/react/engine'
import type { FilterBarNode } from './FilterBarNode'

function renderBar(locale: 'ka' | 'en', mode: 'range' | 'year') {
  LOCALE = locale
  const ctx = {
    filterParams: {},
    sectionCtx: { perspectiveState: { mode } },
  } as unknown as RenderContext
  const def = { type: 'filter-bar' } as FilterBarNode
  return render(FilterBarShell(def, ctx, { rendered: [], byName: {} } as never) as ReactElement)
}

afterEach(() => cleanup())

describe('filter-bar from→to span composition', () => {
  it('renders both endpoint selects, each keeping its OWN filter key (two-key pipeline)', () => {
    renderBar('en', 'range')
    // Each endpoint writes its own ctx key — collapsing to a single range tuple would
    // lose one of these; both present ⇒ fromYear/toYear stay two independent filters.
    expect(screen.getByTestId('sel-fromYear')).toBeTruthy()
    expect(screen.getByTestId('sel-toYear')).toBeTruthy()
  })

  it('en: reads "from [x] to [y]" — leading prepositions, no trailing postpositions', () => {
    const { container } = renderBar('en', 'range')
    const words = [...container.querySelectorAll('.filter-range-word')].map(w => w.textContent)
    expect(words).toEqual(['from', 'to'])          // leads only; en trails are empty → nothing
    expect(container.textContent).not.toContain('დან')
    expect(container.textContent).not.toContain('მდე')
  })

  it('ka: reads "[x] დან [y] მდე" — trailing postpositions, no leading prepositions', () => {
    const { container } = renderBar('ka', 'range')
    const words = [...container.querySelectorAll('.filter-range-word')].map(w => w.textContent)
    expect(words).toEqual(['დან', 'მდე'])          // trails only; ka leads are empty → nothing
    expect(container.textContent).not.toContain('from')
    expect(container.textContent).not.toContain('to')
  })

  it('the word sits on the correct side of each endpoint (from-word ‖ from-select ‖ to-word ‖ to-select)', () => {
    const { container } = renderBar('en', 'range')
    const from = container.querySelector('[data-span-role="from"]')!
    const to   = container.querySelector('[data-span-role="to"]')!
    // from-endpoint: "from" precedes its select
    expect(from.textContent).toContain('from')
    expect(from.querySelector('[data-testid="sel-fromYear"]')).toBeTruthy()
    expect(to.querySelector('[data-testid="sel-toYear"]')).toBeTruthy()
    // left→right order: the from endpoint precedes the to endpoint in the DOM.
    expect(from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('both endpoints live in ONE .filter-span-group — the window never splits across rows', () => {
    const { container } = renderBar('ka', 'range')
    const groups = container.querySelectorAll('.filter-span-group')
    // Exactly one group, and BOTH endpoints are inside it (so CSS nowrap keeps the
    // four-part "[from] დან [to] მდე" unit side-by-side even in a wrapping bar). A
    // hidden carrier sitting between them must NOT break the group.
    expect(groups.length).toBe(1)
    const group = groups[0]!
    expect(group.querySelector('[data-span-role="from"]')).toBeTruthy()
    expect(group.querySelector('[data-span-role="to"]')).toBeTruthy()
    expect(group.querySelector('[data-testid="sel-fromYear"]')).toBeTruthy()
    expect(group.querySelector('[data-testid="sel-toYear"]')).toBeTruthy()
  })

  it('no raw i18n key leaks (span-from-lead / span-to-trail never render literally)', () => {
    const { container } = renderBar('ka', 'range')
    expect(container.textContent).not.toMatch(/span-(from|to)-(lead|trail)/)
  })

  it('year perspective hides the from→to window entirely (render-only perspective gate)', () => {
    renderBar('en', 'year')
    expect(screen.queryByTestId('sel-fromYear')).toBeNull()
    expect(screen.queryByTestId('sel-toYear')).toBeNull()
    // the year selector is the one shown instead
    expect(screen.getByTestId('sel-year')).toBeTruthy()
  })
})
