import { describe, it, expect } from 'vitest'
import { registerTransformStep, listTransformOps, getTransformStep } from './step-registry'
import { applyStep, applyPipeline } from './pipeline'

// Trigger built-in registration side-effects.
// steps.ts must export its functions for index.ts to register them — if this
// import causes registry values to be undefined, steps.ts is missing its exports.
import './index'

const BUILT_IN_OPS = [
  'addField', 'aggregate', 'cast', 'concat', 'derive',
  'filter', 'group', 'join', 'joinByField', 'lookup', 'melt',
  'reduce', 'rename', 'rollup', 'select', 'sort', 'template', 'window',
] as const

describe('transform step registry — contract', () => {
  it('all 18 built-in ops are registered', () => {
    const ops = listTransformOps()
    // Registry is a module singleton; other tests may have added custom keys.
    // Assert every known built-in is present and the total is at least 15.
    for (const op of BUILT_IN_OPS) {
      expect(ops, `op '${op}' missing from listTransformOps`).toContain(op)
    }
    expect(ops.length).toBeGreaterThanOrEqual(BUILT_IN_OPS.length)
    // Built-ins appear in sorted order relative to each other
    const builtInPositions = BUILT_IN_OPS.map(op => ops.indexOf(op))
    expect(builtInPositions).toEqual([...builtInPositions].sort((a, b) => a - b))
  })

  it('getTransformStep returns a function for every built-in op', () => {
    for (const op of BUILT_IN_OPS) {
      expect(typeof getTransformStep(op), `op '${op}' should be a function`).toBe('function')
    }
  })

  it('registering a custom op makes it available via getTransformStep and listTransformOps', () => {
    const myFn = (rows: unknown[]) => rows
    registerTransformStep('__test_custom__', myFn as never)
    expect(getTransformStep('__test_custom__')).toBe(myFn)
    expect(listTransformOps()).toContain('__test_custom__')
  })

  it('applyStep with unknown op returns rows unchanged (no throw)', () => {
    const rows = [{ x: 1 }]
    const result = applyStep(rows, { op: '__unknown_9999__' } as never)
    expect(result).toEqual(rows)
  })

  it('applyStep dispatches correctly — rename op renames a field', () => {
    const rows = [{ a: 1, b: 2 }]
    const result = applyStep(rows, { op: 'rename', fields: { a: 'z' } })
    expect(result).toEqual([{ z: 1, b: 2 }])
  })

  it('applyPipeline applies steps in order', () => {
    const rows = [{ x: '5' }]
    const result = applyPipeline(rows, [
      { op: 'cast',     fields: { x: 'number' } },
      { op: 'addField', name: 'y', value: 10    },
    ])
    expect(result).toEqual([{ x: 5, y: 10 }])
  })
})
