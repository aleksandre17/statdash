// ── binding.fitness — the additive value-model + honest-state invariants ──────
//
//  Locks the two laws the dynamic-binding capability rests on:
//    · ADDITIVE (Law 8 / OCP): a node with NO binding is reference-identical after
//      resolveBindings — zero churn, byte-identical to pre-capability behaviour.
//    · HONEST tri-state (Law 11): a binding resolves to ok / no-data / error and NEVER
//      fabricates a value — a REAL 0/false is `ok`, only null/undefined is `no-data`,
//      and a malformed/threw expr is `error` (surfaced, never silently swallowed).
//    · CONTAINMENT: the seam never descends into child-node subtrees (Parts resolve
//      through their own render pass) — the ADR-041 boundary holds.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { isBinding, resolveBinding, resolveBindings } from './binding'
import type { ExprScope } from '@statdash/expr'

const scope = (dims: Record<string, unknown> = {}, derived: Record<string, unknown> = {}): ExprScope =>
  ({ dims: dims as ExprScope['dims'], derived: derived as ExprScope['derived'] })

describe('isBinding — structural guard', () => {
  it('accepts { $bind: string } only', () => {
    expect(isBinding({ $bind: 'year' })).toBe(true)
    expect(isBinding({ $bind: 42 })).toBe(false)   // non-string
    expect(isBinding('year')).toBe(false)          // literal
    expect(isBinding(null)).toBe(false)
    expect(isBinding({ bind: 'year' })).toBe(false)
  })
})

describe('resolveBinding — honest tri-state (Law 11)', () => {
  it('ok: a self-contained constant computes its real value', () => {
    expect(resolveBinding({ $bind: '2 + 2' }, scope())).toEqual({ state: 'ok', value: 4 })
  })

  it('ok: a REAL 0 is a value, never coerced away (the "no fake 0" law, inverse)', () => {
    // A binding that legitimately computes 0 must be `ok`, not `no-data`.
    const r = resolveBinding({ $bind: '3 - 3' }, scope())
    expect(r).toEqual({ state: 'ok', value: 0 })
  })

  it('ok: resolves a live filter-param reference from scope.dims', () => {
    expect(resolveBinding({ $bind: 'year' }, scope({ year: 2023 }))).toEqual({ state: 'ok', value: 2023 })
  })

  it('no-data: a reference absent from the current context resolves honestly, never faked', () => {
    const r = resolveBinding({ $bind: 'missingParam' }, scope())
    expect(r.state).toBe('no-data')
    expect(r.value).toBeNull()
  })

  it('no-data: an empty expression is honest, not an error', () => {
    expect(resolveBinding({ $bind: '   ' }, scope()).state).toBe('no-data')
  })

  it('error: a malformed expression is captured, never thrown', () => {
    const r = resolveBinding({ $bind: '2 +' }, scope())
    expect(r.state).toBe('error')
    expect(r.value).toBeNull()
    expect(r.message).toBeTruthy()
  })
})

describe('resolveBindings — additive seam (Law 8 / OCP)', () => {
  it('a binding-free node is REFERENCE-identical (zero churn, byte-identical)', () => {
    const node = { type: 'text', content: 'Hello', view: { width: 'full' } }
    const out  = resolveBindings(node, scope())
    expect(out.value).toBe(node)          // same reference — no clone
    expect(out.hadBinding).toBe(false)
    expect(out.diagnostics).toEqual([])
  })

  it('replaces a bound scalar prop with its computed value', () => {
    const node = { type: 'text', content: { $bind: 'year' } }
    const out  = resolveBindings(node, scope({ year: 2024 }))
    expect(out.value).toEqual({ type: 'text', content: 2024 })
    expect(out.value).not.toBe(node)      // a new object only when something changed
    expect(out.hadBinding).toBe(true)
    expect(out.diagnostics).toEqual([])
  })

  it('records a diagnostic (with dot-path) for a failed binding', () => {
    const node = { type: 'text', content: { $bind: 'oops' } }
    const out  = resolveBindings(node, scope())
    expect(out.diagnostics).toEqual([{ path: 'content', state: 'no-data', message: undefined }])
  })

  it('resolves bindings nested under a plain object (e.g. view.subtitle)', () => {
    const node = { type: 'kpi', view: { subtitle: { $bind: 'region' } } }
    const out  = resolveBindings(node, scope({ region: 'GE' })) as { value: { view: { subtitle: unknown } } }
    expect(out.value.view.subtitle).toBe('GE')
  })

  it('CONTAINMENT: never descends into child nodes (children/items) — Parts self-resolve', () => {
    const child = { type: 'text', content: { $bind: 'year' } }   // a bound child prop
    const node  = { type: 'section', children: [child], items: [child] }
    const out   = resolveBindings(node, scope({ year: 2000 }))
    expect(out.hadBinding).toBe(false)                            // child bindings not touched
    const v = out.value as { children: unknown[]; items: unknown[] }
    expect(v.children[0]).toBe(child)                             // child left verbatim
    expect(v.items[0]).toBe(child)
  })

  it('CONTAINMENT: skips node-like objects even under a non-containment key', () => {
    const inner = { type: 'chart', title: { $bind: 'x' } }
    const node  = { type: 'wrap', slot: inner }
    const out   = resolveBindings(node, scope())
    expect((out.value as { slot: unknown }).slot).toBe(inner)     // skipped by the `type` heuristic
  })
})
