// ── FF-ALWAYS-A-HOME — given >=1 page, the effective active id is never null ────
//
//  AR-49 M4 Wave 0. The invalid state "pages exist but none is active" stranded the
//  whole shell (blank canvas, empty Layers, disabled Save/Publish). The derived
//  effective-active-page SSOT makes that state unrepresentable at the read boundary:
//  a null OR stale selection falls back to the first page, so the effective id is
//  null ONLY when there are genuinely zero pages. This locks that invariant against
//  regression (e.g. a future edit that drops the fallback and re-introduces the
//  strand). See store/constructor.selectors.ts effectiveActivePageId.
//
import { describe, it, expect } from 'vitest'
import { effectiveActivePageId } from './constructor.selectors'

const P = (id: string) => ({ id })

describe('FF-ALWAYS-A-HOME — effective active id is never null while any page exists', () => {
  const pages = [P('p1'), P('p2'), P('p3')]

  it('a null selection falls back to the first page (the boot-race case)', () => {
    expect(effectiveActivePageId(null, pages)).toBe('p1')
  })

  it('a valid explicit selection is preserved', () => {
    expect(effectiveActivePageId('p2', pages)).toBe('p2')
  })

  it('a STALE selection (removePagePatch nulled it / a race left a dead id) never strands', () => {
    expect(effectiveActivePageId('deleted', pages)).toBe('p1')
  })

  it('across null / valid / stale selections it is non-null AND always a REAL page', () => {
    for (const sel of [null, 'p1', 'p2', 'p3', 'ghost']) {
      const id = effectiveActivePageId(sel, pages)
      expect(id).not.toBeNull()
      expect(pages.some((p) => p.id === id)).toBe(true)
    }
  })

  it('only with ZERO pages is the effective id null (the sole legitimate empty)', () => {
    expect(effectiveActivePageId(null, [])).toBeNull()
    expect(effectiveActivePageId('anything', [])).toBeNull()
  })
})
