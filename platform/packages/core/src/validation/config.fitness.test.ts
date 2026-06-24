// ── F1 Fitness — validateConfig honours the shared accept/reject corpus ──
//
//  ADR adr-config-and-render-vision §7.8 F1. validateConfig is the SAME
//  structural validator apps/api (save) and packages/react (render) import,
//  so proving it here against the shared corpus proves BOTH sides cannot
//  diverge (they run one function). The corpus is exported from
//  ./config-corpus so the later api + react fitness tests reuse it verbatim.
//

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateConfig } from './config'
import {
  registerNodeType,
  knownNodeTypes,
  _resetNodeTypes,
} from '../registry/nodeTypes'
import {
  VALID_CONFIGS,
  INVALID_CONFIGS,
  corpusAllTypes,
} from './config-corpus'

describe('validateConfig — F1 shared corpus', () => {
  // The corpus VALID cases require a NON-EMPTY registry (so the type-∈-set
  // check is live), and the "unknown type" INVALID case requires its type to
  // be ABSENT. corpusAllTypes() installs exactly the right set.
  beforeEach(() => {
    _resetNodeTypes()
    for (const t of corpusAllTypes()) registerNodeType(t)
  })
  afterEach(() => {
    _resetNodeTypes()
  })

  describe('VALID configs produce zero errors', () => {
    for (const c of VALID_CONFIGS) {
      it(c.label, () => {
        const errors = validateConfig(c.config)
        expect(errors, JSON.stringify(errors, null, 2)).toEqual([])
      })
    }
  })

  describe('INVALID configs produce the expected error code', () => {
    for (const c of INVALID_CONFIGS) {
      it(c.label, () => {
        const errors = validateConfig(c.config)
        expect(errors.length).toBeGreaterThan(0)
        const codes = errors.map(e => e.code)
        expect(codes, `expected ${c.expectCode} in ${JSON.stringify(codes)}`)
          .toContain(c.expectCode)
      })
    }
  })

  it('every error carries a path, code, message and severity', () => {
    for (const c of INVALID_CONFIGS) {
      for (const e of validateConfig(c.config)) {
        expect(typeof e.path).toBe('string')
        expect(typeof e.code).toBe('string')
        expect(typeof e.message).toBe('string')
        expect(['error', 'warning', 'info']).toContain(e.severity)
      }
    }
  })
})

describe('validateConfig — fail-open on the empty node-type registry', () => {
  beforeEach(() => { _resetNodeTypes() })
  afterEach(() => { _resetNodeTypes() })

  it('does NOT reject an unknown node type when the registry is empty', () => {
    expect(knownNodeTypes()).toEqual([])
    const errors = validateConfig({
      type: 'inner-page',
      id: 'p',
      children: [{ type: 'a-type-nobody-registered', id: 'x' }],
    })
    // No UNKNOWN_NODE_TYPE (fail-open); the rest of the floor still applies.
    expect(errors.map(e => e.code)).not.toContain('UNKNOWN_NODE_TYPE')
    expect(errors).toEqual([])
  })

  it('enforces the unknown-type check once the registry is populated', () => {
    registerNodeType('inner-page')
    const errors = validateConfig({
      type: 'inner-page',
      id: 'p',
      children: [{ type: 'a-type-nobody-registered', id: 'x' }],
    })
    expect(errors.map(e => e.code)).toContain('UNKNOWN_NODE_TYPE')
  })
})
