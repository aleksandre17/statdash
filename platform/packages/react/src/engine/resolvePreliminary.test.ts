// @vitest-environment node
//
// ── resolvePreliminary characterization tests (P2-3) ────────────────────────
//
//  Pins the three OR-ed signals that drive the PreliminaryBadge so a refactor
//  can never silently regress the "preliminary data" affordance (Law 9: data
//  integrity, IMF/Eurostat standard).
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

describe('resolvePreliminary — three OR-ed signals', () => {
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

  it('signal 3: dataset-wide MetadataPort reports status p', () => {
    const store: DataStore = {
      ...staticStore,
      metadata: { provenance: () => ({ status: 'p' }) },
    }
    const ctx = makeCtx({ stores: { default: store }, pageStoreKey: 'default' })
    expect(resolvePreliminary(node({ measure: 'gdp' }), ctx)).toBe(true)
  })

  it('returns undefined when no signal fires (final/normal data)', () => {
    const store: DataStore = {
      ...staticStore,
      metadata: { provenance: () => undefined },
    }
    const ctx = makeCtx({
      stores:       { default: store },
      pageStoreKey: 'default',
      rows:         [{ id: 'a', label: 'A', value: 1, status: 'A' }],
    })
    expect(resolvePreliminary(node(), ctx)).toBeUndefined()
  })

  it('does not fire for a non-preliminary status (e = estimate)', () => {
    const ctx = makeCtx({ rows: [{ id: 'a', label: 'A', value: 1, status: 'e' }] })
    expect(resolvePreliminary(node(), ctx)).toBeUndefined()
  })
})
