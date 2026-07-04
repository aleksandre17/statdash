// @vitest-environment node
//
// ── resolvePreliminary characterization tests (P2-3) ────────────────────────
//
//  Pins the two YEAR-AWARE OR-ed signals that drive the PreliminaryBadge so a
//  refactor can never silently regress the "preliminary data" affordance (Law 9:
//  data integrity, IMF/Eurostat standard). The former dataset-wide MetadataPort
//  fallback was REMOVED (year-blind leak): the badge now fires ONLY from the
//  DISPLAYED slice, never because the dataset ALSO contains a preliminary obs.
//

import { describe, it, expect }   from 'vitest'
import { resolvePreliminary }      from './resolvePreliminary'
import { staticStore }             from '@statdash/engine'
import type { DataStore }          from '@statdash/engine'
import type { NodeBase, RenderContext } from './types'

// Minimal RenderContext — only the fields resolvePreliminary reads.
function makeCtx(over: Partial<RenderContext>): RenderContext {
  return {
    sectionCtx: { dims: {} },
    stores:     {},
    rows:       [],
    ...over,
  } as RenderContext
}

const node = (over: Partial<NodeBase & { preliminary?: boolean; measure?: string }> = {}) =>
  ({ type: 'chart', id: 'n1', ...over }) as NodeBase & { preliminary?: boolean }

describe('resolvePreliminary — two year-aware OR-ed signals', () => {
  it('signal 1: explicit node config def.preliminary === true', () => {
    expect(resolvePreliminary(node({ preliminary: true }), makeCtx({}))).toBe(true)
  })

  it('signal 2: a rendered row carries obsStatus = P (query path, upper-case)', () => {
    const ctx = makeCtx({ rows: [{ id: 'a', label: 'A', value: 1, obsStatus: 'P' } as never] })
    expect(resolvePreliminary(node(), ctx)).toBe(true)
  })

  it('signal 2: a rendered row carries obsStatus = p (normalized lower-case)', () => {
    const ctx = makeCtx({ rows: [{ id: 'a', label: 'A', value: 1, obsStatus: 'p' } as never] })
    expect(resolvePreliminary(node(), ctx)).toBe(true)
  })

  it('signal 2: a rendered row carries provenance.status = p (encoded DataRow path)', () => {
    const ctx = makeCtx({ rows: [{ id: 'a', label: 'A', value: 1, provenance: { status: 'p' } }] })
    expect(resolvePreliminary(node(), ctx)).toBe(true)
  })

  // The year-blind leak, now closed: a dataset-wide MetadataPort reporting `p`
  // must NOT fire the badge when the DISPLAYED rows are final — the badge is a
  // property of the shown slice, never of the dataset as a whole (Law 1: no
  // dataset-wide signal). This is the exact contradiction the removed step 3
  // created against signal 2's own contract.
  it('dataset-wide MetadataPort status p does NOT fire when displayed rows are final', () => {
    const store: DataStore = {
      ...staticStore,
      metadata: { provenance: () => ({ status: 'p' }) },
    }
    const ctx = makeCtx({
      stores:       { default: store },
      pageStoreKey: 'default',
      rows:         [{ id: 'a', label: 'A', value: 1, status: 'A' }],   // displayed slice is final
    })
    expect(resolvePreliminary(node({ measure: 'gdp' }), ctx)).toBeUndefined()
  })

  it('returns undefined when no signal fires (final/normal data)', () => {
    const ctx = makeCtx({
      rows: [{ id: 'a', label: 'A', value: 1, status: 'A' }],
    })
    expect(resolvePreliminary(node(), ctx)).toBeUndefined()
  })

  it('does not fire for a non-preliminary status (e = estimate)', () => {
    const ctx = makeCtx({ rows: [{ id: 'a', label: 'A', value: 1, status: 'e' }] })
    expect(resolvePreliminary(node(), ctx)).toBeUndefined()
  })
})
