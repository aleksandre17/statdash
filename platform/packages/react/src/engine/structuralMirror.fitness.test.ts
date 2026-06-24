// ── structuralMirror.fitness.test.ts — F4 (mirror ≥ react type) ──────────────
//
//  ADR adr-config-and-render-vision §7.4 + §7.8 F4. The engine's structural
//  mirror (StructuralPageConfig, validation/config.ts) is a strict WIDENING of
//  react's NodePageConfig: the validator validates SHAPE without importing the
//  rich react type (which pulls NodeStyles/ChromeEntry the validator never
//  needs). SSOT is preserved ONLY because the mirror is a superset — react's
//  NodePageConfig must be assignable to StructuralPageConfig.
//
//  This react-side test pins that assignability (react is the one layer that can
//  legally import BOTH types). If PageConfigBase grows a field the structural
//  mirror cannot represent — i.e. the mirror drifts NARROWER than the real type
//  — the assignment below fails to type-check and the build breaks. That is the
//  whole point: the mirror can never silently fall behind the contract it floors.
//
//  Type-level by construction: the load-bearing assertion is the typed
//  `assignableToStructural` binding; the runtime `expect` merely keeps vitest
//  from reporting an empty test file.
//

import { describe, it, expect } from 'vitest'
import type { NodePageConfig }        from './types/node'
import type { StructuralPageConfig }  from '@statdash/engine'

// ── The F4 assertion — compile-time assignability ────────────────────────────
//
//  `Extends<A, B>` is `true` only when A is assignable to B. Forcing the result
//  to the literal `true` makes a drift (A no longer ⊆ B) a TYPE ERROR here.
type Extends<A, B> = [A] extends [B] ? true : false

// If NodePageConfig stops being assignable to StructuralPageConfig, this line
// is a compile error (the type resolves to `false`, not `true`). DO NOT relax.
const assignableToStructural: Extends<NodePageConfig, StructuralPageConfig> = true

// A second direction note (documentation, NOT asserted): the mirror is a strict
// WIDENING, so StructuralPageConfig is NOT assignable to NodePageConfig — that
// asymmetry is correct and intended (the floor is permissive on rich fields).

describe('F4 — structural mirror is a strict widening of the react page type', () => {
  it('NodePageConfig is assignable to StructuralPageConfig (compile-time pinned)', () => {
    expect(assignableToStructural).toBe(true)
  })
})
