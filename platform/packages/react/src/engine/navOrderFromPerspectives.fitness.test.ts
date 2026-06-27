// @vitest-environment node
//
// ── navOrderFromPerspectives.fitness — FF-NAV-ORDER-FROM-PERSPECTIVES [P5.2 (3)] ─
//
//  Migration (3): the nav-section ordering no longer comes from the legacy
//  `page.modeOrder`; SiteRenderer now passes `axis.perspectives.map(p => p.id)` to
//  `extractNavSectionsFromChildren` (no signature change — the 3rd arg is the same
//  ordered id list, sourced from the perspective axis SSOT instead of modeOrder).
//
//  This locks the engine half (navUtils): the extractor sorts nav sections by the
//  ORDER of the passed id list, and that order — derived from `perspectives[].id` —
//  is identical to the legacy `modeOrder` order for a [year, range] axis. So the
//  nav is byte-identical while modeOrder is retired.
//
//  Non-vacuous: a reversed id list flips the section order, proving the list is the
//  load-bearing sort key (not an incidental input order).
//

import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry }                     from './register-all'
import { extractNavSectionsFromChildren }   from './navUtils'

const TIME_KEY = 'mode'

// Two nav-contributor sections, each gated to one perspective via view.visibleWhen
// (the generic `eq`-on-the-perspective-param form getNavMode reads). Authored OUT of
// perspective order (range first) so the SORT is the thing under test.
function children(): unknown[] {
  return [
    { type: '__nav_sec__', id: 'dynamics', title: 'Dynamics',
      view: { visibleWhen: { op: 'eq', param: TIME_KEY, is: 'range' } } },
    { type: '__nav_sec__', id: 'annual', title: 'Annual',
      view: { visibleWhen: { op: 'eq', param: TIME_KEY, is: 'year' } } },
  ]
}

beforeAll(() => {
  // A throwaway nav-contributor (default reader: id `anchor ?? id`, title `title`,
  // navMode `view.visibleWhen`). Mirrors `section`'s nav cap without importing it.
  nodeRegistry.register('__nav_sec__', 'default', () => null, { caps: ['nav-contributor'] })
})

describe('FF-NAV-ORDER-FROM-PERSPECTIVES', () => {
  // The axis-derived id list SiteRenderer now passes (perspectives[].id, in order).
  const perspectiveIds = ['year', 'range']
  // The legacy field it replaces — identical contents/order for this axis.
  const legacyModeOrder = ['year', 'range']

  it('sorts nav sections by the perspectives[].id order (year before range)', () => {
    const out = extractNavSectionsFromChildren(children() as never, TIME_KEY, perspectiveIds)
    expect(out.map(s => s.id)).toEqual(['annual', 'dynamics'])   // year-section first
  })

  it('the perspectives-id order === the legacy modeOrder order (byte-identical nav)', () => {
    const fromPerspectives = extractNavSectionsFromChildren(children() as never, TIME_KEY, perspectiveIds)
    const fromModeOrder    = extractNavSectionsFromChildren(children() as never, TIME_KEY, legacyModeOrder)
    expect(fromPerspectives).toEqual(fromModeOrder)
  })

  it('NON-VACUOUS: a reversed id list flips the order (the list is the sort key)', () => {
    const reversed = extractNavSectionsFromChildren(children() as never, TIME_KEY, ['range', 'year'])
    expect(reversed.map(s => s.id)).toEqual(['dynamics', 'annual'])
  })
})
