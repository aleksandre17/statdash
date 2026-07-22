// ── workbenchCapabilities — the DERIVED admissibility matrix (DESIGN-0104 §2·C2 · E1) ──
//
//  Proves the Capability-Matrix derivation of three-pane admissibility is (a) BEHAVIOUR-
//  IDENTICAL to the hand gate it replaces — the E1 mandate is "change HOW the decision is
//  made, not the decision" — and (b) FAIL-CLOSED, so the 0104 regression class (a kind
//  silently admitted to a read-only three-pane) cannot recur by construction.
//
import { describe, it, expect } from 'vitest'
import { SPEC_CATALOG, capabilitiesFor } from '@statdash/engine'
import {
  isWorkbenchAdmissible, requiredCapabilities, workbenchProvidedCapabilities,
  WORKBENCH_CORE_CAPABILITIES,
} from './workbenchCapabilities'

// The hand gate this wave REPLACES: `isWorkbenchShaped` admitted exactly these (query legacy +
// native pipeline). The derived matrix must reproduce this set — nothing more, nothing less.
const HAND_GATE_ADMISSIBLE = ['query', 'pipeline'] as const

// Every kind the system routes: the authoring-catalog kinds + the native `pipeline` shape.
const ALL_KINDS = [...Object.keys(SPEC_CATALOG), 'pipeline']

describe('DERIVED workbench admissibility — before ≡ after the Capability Matrix', () => {
  it('the derived admissible set is byte-identical to the old hand gate {query, pipeline}', () => {
    const derived = ALL_KINDS.filter(isWorkbenchAdmissible).sort()
    expect(derived).toEqual([...HAND_GATE_ADMISSIBLE].sort())
  })

  it('every NON-admissible kind requires at least one act the workbench core does not provide', () => {
    // The honest reason each is refused the panes — a capability the three-pane cannot deliver
    // (value-cell head, pivot fields, inline source, single↔multi, explicit rows, metric grain).
    const provided = workbenchProvidedCapabilities()
    for (const kind of ALL_KINDS.filter((k) => !isWorkbenchAdmissible(k))) {
      const orphan = requiredCapabilities(kind).filter((c) => !provided.has(c))
      expect(orphan.length, `${kind} must have a non-core requirement`).toBeGreaterThan(0)
    }
  })

  it('every ADMISSIBLE kind has ALL its required acts in the workbench-provided set', () => {
    const provided = workbenchProvidedCapabilities()
    for (const kind of HAND_GATE_ADMISSIBLE) {
      for (const cap of requiredCapabilities(kind)) {
        expect(provided.has(cap), `${kind} needs ${cap} from the panes`).toBe(true)
      }
    }
  })
})

describe('FAIL-CLOSED — an undeclared kind is never silently admitted', () => {
  it('a kind with no declared capabilities is NOT admissible (routes to the honest fallback)', () => {
    // capabilitiesFor is empty for an unknown kind → requiredCapabilities is empty → refused.
    // This is the regression lock: a future kind that forgets to declare cannot slip into the panes.
    expect(capabilitiesFor('made-up-kind')).toEqual([])
    expect(isWorkbenchAdmissible('made-up-kind')).toBe(false)
  })

  it('the workbench-provided set is exactly the declared core acts (no accidental widening)', () => {
    expect([...workbenchProvidedCapabilities()].sort()).toEqual([...WORKBENCH_CORE_CAPABILITIES].sort())
  })
})
