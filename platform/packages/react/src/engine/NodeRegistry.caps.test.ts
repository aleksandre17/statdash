// @vitest-environment node
//
// ── NodeRegistry capability tests ─────────────────────────────────────────────
//
//  Pins the behaviour of getCaps(type, variant) and getByCapability(cap):
//    - getCaps returns the declared caps for a registered type+variant.
//    - getCaps on unregistered entry returns [].
//    - getCaps returns a defensive copy — mutating it does not affect the registry.
//    - getByCapability returns all entries that declared the given cap.
//    - getByCapability returns [] for a cap that no entry has declared.
//    - getByCapability returns the correct entry shape.
//    - Multiple registrations with the same cap all appear in getByCapability.
//    - Entries without the queried cap are excluded.
//

import { describe, it, expect } from 'vitest'
import { NodeRegistry }          from './NodeRegistry'
import type { NodeCap }          from './NodeRegistry'
import type { RenderContext }    from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** No-op renderer — NodeRegistry stores it, tests don't call it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shell = (_node: any, _ctx: RenderContext, _children: any) => null

function makeRegistry() {
  return new NodeRegistry()
}

// ── getCaps ───────────────────────────────────────────────────────────────────

describe('NodeRegistry — getCaps', () => {

  it('returns declared caps for a registered type+variant', () => {
    const reg = makeRegistry()
    reg.register('mytype', 'default', shell, {
      caps: ['data', 'children'] as const,
    })

    const caps = reg.getCaps('mytype', 'default')

    expect(caps).toEqual(['data', 'children'])
  })

  it('returns [] for an unregistered type', () => {
    const reg = makeRegistry()

    expect(reg.getCaps('nonexistent', 'default')).toEqual([])
  })

  it('returns [] for a registered type registered without opts', () => {
    const reg = makeRegistry()
    reg.register('bare-type', 'default', shell)  // no opts → no meta → no caps

    expect(reg.getCaps('bare-type', 'default')).toEqual([])
  })

  it('returns [] for a registered type registered with opts but no caps field', () => {
    const reg = makeRegistry()
    reg.register('nocaps', 'default', shell, { label: 'No-cap node' })

    expect(reg.getCaps('nocaps', 'default')).toEqual([])
  })

  it('falls back to default variant when named variant is not registered', () => {
    const reg = makeRegistry()
    reg.register('mytype', 'default', shell, {
      caps: ['chart'] as const,
    })

    // 'compact' is not registered → falls back to 'default'
    const caps = reg.getCaps('mytype', 'compact')

    expect(caps).toEqual(['chart'])
  })

  it('returns caps for the exact variant when registered', () => {
    const reg = makeRegistry()
    reg.register('mytype', 'default', shell, { caps: ['children'] as const })
    reg.register('mytype', 'compact', shell, { caps: ['data', 'chart'] as const })

    expect(reg.getCaps('mytype', 'default')).toEqual(['children'])
    expect(reg.getCaps('mytype', 'compact')).toEqual(['data', 'chart'])
  })

  it('defensive copy — mutating returned array does not affect registry', () => {
    const reg = makeRegistry()
    reg.register('mytype', 'default', shell, {
      caps: ['data', 'children'] as const,
    })

    const caps1 = reg.getCaps('mytype', 'default')
    caps1.push('chart' as NodeCap)

    const caps2 = reg.getCaps('mytype', 'default')

    // Original caps unchanged
    expect(caps2).toEqual(['data', 'children'])
    expect(caps2).toHaveLength(2)
  })

})

// ── getByCapability ───────────────────────────────────────────────────────────

describe('NodeRegistry — getByCapability', () => {

  it('returns entries that declared the given cap', () => {
    const reg = makeRegistry()
    reg.register('section', 'default', shell, {
      caps: ['data', 'children'] as const,
    })

    const results = reg.getByCapability('data')

    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('section')
    expect(results[0].variant).toBe('default')
  })

  it('does NOT return entries that do not have the cap', () => {
    const reg = makeRegistry()
    reg.register('section', 'default', shell, {
      caps: ['children'] as const,  // no 'data'
    })
    reg.register('chart', 'default', shell, {
      caps: ['data', 'chart'] as const,
    })

    const results = reg.getByCapability('data')

    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('chart')
  })

  it('returns [] for a cap that no registered entry declares', () => {
    const reg = makeRegistry()
    reg.register('section', 'default', shell, {
      caps: ['children'] as const,
    })

    expect(reg.getByCapability('export')).toEqual([])
  })

  it('returns [] for a completely unknown cap string', () => {
    const reg = makeRegistry()
    reg.register('section', 'default', shell, {
      caps: ['data'] as const,
    })

    expect(reg.getByCapability('nonexistent-cap' as NodeCap)).toEqual([])
  })

  it('returns correct entry shape: type, variant, and caps present', () => {
    const reg = makeRegistry()
    reg.register('panel', 'default', shell, {
      caps:     ['data', 'chart'] as const,
      category: 'data',
    })

    const [entry] = reg.getByCapability('chart')

    expect(entry).toMatchObject({
      type:     'panel',
      variant:  'default',
      caps:     ['data', 'chart'],
      category: 'data',
    })
  })

  it('multiple registrations with same cap all appear in results', () => {
    const reg = makeRegistry()
    reg.register('section',  'default', shell, { caps: ['data', 'children'] as const })
    reg.register('kpi-strip','default', shell, { caps: ['data', 'kpi']      as const })
    reg.register('chart',    'default', shell, { caps: ['data', 'chart']    as const })

    const results = reg.getByCapability('data')

    expect(results).toHaveLength(3)
    const types = results.map(e => e.type)
    expect(types).toContain('section')
    expect(types).toContain('kpi-strip')
    expect(types).toContain('chart')
  })

  it('different variants of same type returned separately when both match', () => {
    const reg = makeRegistry()
    reg.register('section', 'default', shell, { caps: ['data', 'children'] as const })
    reg.register('section', 'compact', shell, { caps: ['data'] as const })

    const results = reg.getByCapability('data')

    expect(results).toHaveLength(2)
    const variants = results.map(e => e.variant)
    expect(variants).toContain('default')
    expect(variants).toContain('compact')
  })

  it('entries registered without opts (no meta) are not returned', () => {
    const reg = makeRegistry()
    // Registered without opts — does not appear in list() / getByCapability()
    reg.register('invisible', 'default', shell)

    // Even though type is registered for rendering, it has no meta
    expect(reg.getByCapability('data')).toEqual([])
  })

  it('entry without caps field is excluded even if other meta is present', () => {
    const reg = makeRegistry()
    reg.register('no-cap-node', 'default', shell, { label: 'Widget', category: 'layout' })

    expect(reg.getByCapability('data')).toEqual([])
    expect(reg.getByCapability('children')).toEqual([])
  })

})
