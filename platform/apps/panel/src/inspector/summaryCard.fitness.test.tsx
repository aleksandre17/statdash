// ── Fitness — the Summary-Card Inspector invariants (SPEC §3.1, Move 1) ─────────
//
//  Three gates the acute right-side fix must hold, forever:
//    • FF-NO-RAW-JSON-DEFAULT  — no rich/opaque value resolves to the raw-JSON
//      textarea in the default path; JsonControl is a dev escape ONLY.
//    • FF-DOCK-CONSTANT-WEIGHT — the SummaryCard is a bounded, fixed-height box by
//      construction (CSS max-height + clipped overflow), so the dock cannot overflow.
//    • FF-SUMMARY-EVERYWHERE   — `summarize()` is TOTAL: every rich/unknown type
//      yields a legible glance (non-empty primary), never a JSON dump.
//
import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import type { PropField } from '@statdash/react/engine'
import { fieldControlRegistry } from './FieldControlRegistry'
import { JsonControl } from './controls/primitives'
import { SummaryCard } from './controls/SummaryCard'
import { summarize } from './summarize'
import { setRawJsonEscape } from './rawJsonEscape'

const f = (over: Partial<PropField>): PropField =>
  ({ field: 'x', type: 'string', label: { ka: 'X', en: 'X' }, ...over } as PropField)

// The rich/opaque types the dock must never dump as raw JSON, plus an unknown one.
const RICH_TYPES = ['object', 'array', 'DataSpec', 'ChartDef', 'totally-unknown']

afterEach(() => setRawJsonEscape(null))

describe('FF-NO-RAW-JSON-DEFAULT — raw JSON leaves the default path', () => {
  it('every rich/opaque/unknown type resolves to SummaryCard by default', () => {
    setRawJsonEscape(false)
    for (const t of RICH_TYPES) {
      const control = fieldControlRegistry.resolve(f({ type: t as PropField['type'] }))
      expect(control, `${t} must be a SummaryCard`).toBe(SummaryCard)
      expect(control, `${t} must NOT be JsonControl by default`).not.toBe(JsonControl)
    }
  })

  it('JsonControl is registered for NO type — it is only the escape fallback', () => {
    for (const t of RICH_TYPES) {
      expect(fieldControlRegistry.get(t)).toBeUndefined()
    }
  })

  it('JsonControl is reachable ONLY behind the explicit dev escape', () => {
    setRawJsonEscape(true)
    for (const t of RICH_TYPES) {
      expect(fieldControlRegistry.resolve(f({ type: t as PropField['type'] }))).toBe(JsonControl)
    }
  })
})

describe('FF-DOCK-CONSTANT-WEIGHT — the card is bounded by construction', () => {
  // The dock's constant weight rests on TWO structural facts, both asserted here at
  // the dispatch + render layer (jsdom does not apply the .css, and panel-vitest
  // resolves `?raw` CSS to '' — so the pixel clamp lives in SummaryCard.css and is
  // verified by review; the STRUCTURE that makes the clamp possible is tested):

  it('a rich value renders as ONE bounded card box — never an unbounded <textarea>', () => {
    const field = f({ type: 'object', field: 'blob' })
    const huge = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]))
    const { container } = render(
      createElement(SummaryCard, {
        field, id: 'insp-blob', value: huge, locales: ['en'], locale: 'en', onChange: () => {},
      }),
    )
    // one fixed card container…
    expect(container.querySelectorAll('.summary-card')).toHaveLength(1)
    // …and NOT the unbounded raw-JSON textarea that grows with the value.
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('every rich/heavy type dispatches to the bounded SummaryCard (not JsonControl)', () => {
    setRawJsonEscape(false)
    for (const t of RICH_TYPES) {
      expect(fieldControlRegistry.resolve(f({ type: t as PropField['type'] }))).toBe(SummaryCard)
    }
  })
})

describe('FF-SUMMARY-EVERYWHERE — summarize() is total, never a JSON dump', () => {
  const cases: Array<{ type: string; value: unknown }> = [
    { type: 'DataSpec', value: { type: 'query', query: { measure: 'gdp', dims: { time: {} } } } },
    { type: 'ChartDef', value: { type: 'bar', label: 'GDP', stacked: true } },
    { type: 'object',   value: { a: 1, b: 2, c: 3 } },
    { type: 'array',    value: [1, 2, 3] },
    { type: 'unknown',  value: { anything: true } },
    { type: 'object',   value: null },
  ]

  it('returns a non-empty, non-JSON primary for every rich/unknown value', () => {
    for (const c of cases) {
      const s = summarize(f({ type: c.type as PropField['type'] }), c.value, 'en')
      expect(s.primary, `${c.type} primary`).toBeTruthy()
      // a glance, never a serialized blob
      expect(s.primary.trim().startsWith('{'), `${c.type} must not dump JSON`).toBe(false)
      expect(s.primary.trim().startsWith('['), `${c.type} must not dump JSON`).toBe(false)
    }
  })

  it('populates the glance from the value (DataSpec measure, ChartDef mark, counts)', () => {
    expect(summarize(f({ type: 'DataSpec' }), { type: 'query', query: { measure: 'gdp' } }, 'en').primary)
      .toBe('gdp')
    expect(summarize(f({ type: 'ChartDef' }), { type: 'bar', label: 'GDP' }, 'en').badges)
      .toContain('bar')
    expect(summarize(f({ type: 'array', label: { ka: 'A', en: 'A' } }), [1, 2, 3], 'en').secondary)
      .toContain('3')
  })
})
