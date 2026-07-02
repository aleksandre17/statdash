// ── FF-NO-LOCALESTRING-TO-STRING — derive ops localize labels at the boundary (BI-B1) ──
//
//  A codelist/display label may be a bilingual LocaleString `{ ka, en }`. The
//  derive ops that PRODUCE a display string (join-labels, breadcrumbs, find+field)
//  must NEVER `String()`-flatten such an object to "[object Object]" — they resolve
//  it via the canonical resolveLocaleString against the locale threaded into the
//  DeriveContext (BI-B1: the `[object Object]` map subtitle when a region is selected).
//
//  Acceptance:
//    • A LocaleString label never renders as "[object Object]".
//    • The threaded EN locale surfaces the English arm; KA the Georgian arm.
//    • No locale threaded ⇒ first-value fallback (still never "[object Object]").
//    • Plain-string labels are byte-identical to the pre-fix path (Postel).

import { describe, it, expect } from 'vitest'
import { evalFilterDerive }      from './filter-derive'
import type { FilterDerive, DeriveContext } from './filter-derive'

// A source of items whose label is a bilingual LocaleString — exactly the shape a
// `$d`/`$cl` join surfaces from a codelist that carries genuine en + ka.
const bilingualSource = [
  { id: 'GE', label: { ka: 'საქართველო', en: 'Georgia' } },
  { id: 'AB', label: { ka: 'აფხაზეთი',  en: 'Abkhazia' } },
]

const en: DeriveContext = { locale: 'en', fallback: 'ka' }
const ka: DeriveContext = { locale: 'ka', fallback: 'en' }

describe('FF-NO-LOCALESTRING-TO-STRING — join-labels localizes at the boundary', () => {
  const expr: FilterDerive = { op: 'join-labels', source: bilingualSource, by: 'region', labelField: 'label' }

  it('EN locale surfaces the English label (never "[object Object]")', () => {
    const out = evalFilterDerive(expr, { region: 'GE' }, { region: 'GE' }, en) as string
    expect(out).toBe('Georgia')
    expect(out).not.toContain('[object Object]')
  })

  it('KA locale surfaces the Georgian label', () => {
    const out = evalFilterDerive(expr, { region: 'GE' }, { region: 'GE' }, ka) as string
    expect(out).toBe('საქართველო')
  })

  it('multi-select joins each localized label — no "[object Object]"', () => {
    const out = evalFilterDerive(expr, { region: 'GE,AB' }, { region: 'GE,AB' }, en) as string
    expect(out).toBe('Georgia · Abkhazia')
    expect(out).not.toContain('[object Object]')
  })

  it('no locale threaded ⇒ first-value fallback, still never "[object Object]"', () => {
    const out = evalFilterDerive(expr, { region: 'GE' }, { region: 'GE' }) as string
    expect(out).not.toContain('[object Object]')
    // resolveLocaleString first-value path — the ka arm is first in the object.
    expect(out).toBe('საქართველო')
  })

  it('plain-string labels are byte-identical to the pre-fix path (Postel)', () => {
    const plain: FilterDerive = {
      op: 'join-labels',
      source: [{ id: 'GE', label: 'Georgia' }],
      by: 'region', labelField: 'label',
    }
    expect(evalFilterDerive(plain, { region: 'GE' }, { region: 'GE' }, en)).toBe('Georgia')
  })
})

describe('FF-NO-LOCALESTRING-TO-STRING — breadcrumbs localizes the dynamic label', () => {
  const expr: FilterDerive = {
    op: 'breadcrumbs',
    prefix: [{ label: 'Home', href: '/' }],
    source: bilingualSource,
    by: 'region', labelField: 'label',
  }

  it('resolves the bilingual crumb label to the active locale', () => {
    const crumbs = evalFilterDerive(expr, { region: 'GE' }, { region: 'GE' }, en) as { label: string }[]
    expect(crumbs[crumbs.length - 1].label).toBe('Georgia')
    expect(JSON.stringify(crumbs)).not.toContain('[object Object]')
  })
})

describe('FF-NO-LOCALESTRING-TO-STRING — find+field localizes the extracted label', () => {
  const expr: FilterDerive = {
    op: 'find',
    source: bilingualSource,
    by: 'region', idField: 'id', field: 'label',
  }

  it('resolves the extracted bilingual field to the active locale', () => {
    expect(evalFilterDerive(expr, { region: 'GE' }, {}, en)).toBe('Georgia')
    expect(evalFilterDerive(expr, { region: 'GE' }, {}, ka)).toBe('საქართველო')
  })

  it('a non-object extracted field passes through unchanged (numbers, scalars)', () => {
    const numExpr: FilterDerive = {
      op: 'find',
      source: [{ id: 'GE', rank: 1 }],
      by: 'region', idField: 'id', field: 'rank',
    }
    expect(evalFilterDerive(numExpr, { region: 'GE' }, {}, en)).toBe(1)
  })

  it('find WITHOUT a field still returns the whole object (unchanged)', () => {
    const whole: FilterDerive = { op: 'find', source: bilingualSource, by: 'region', idField: 'id' }
    expect(evalFilterDerive(whole, { region: 'GE' }, {}, en)).toEqual(bilingualSource[0])
  })
})
