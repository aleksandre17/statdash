// ── FF-PLACEMENT-DERIVED — the Placement Law as a pure, provable primitive (SL-0) ─
//
//  Proves that WHERE any editable subject is placed is a DERIVED total function of
//  its scope × weight — never hand-placed per editor — and that the owner's
//  "crammed right dock" is a state the code cannot produce:
//
//    • TOTALITY — every (scope, band) resolves to exactly one container in the
//      closed set (no gap, no undefined).
//    • DERIVED, NOT PER-EDITOR — the SSOT table is keyed ONLY by the abstract
//      scope × weight axes; no node-type / editor-name / domain literal appears.
//    • ESCALATION INVARIANT — for every weight-laddered scope, heavier weight
//      never resolves to a LIGHTER container (monotone along the ladder), and the
//      ladder is POPOVER → DOCK/DRILL → FOCUS-VIEW.
//    • FF-NO-CRAMMED-DOCK — an OVERSIZE subject always escalates OUT of the dock to
//      the FOCUS-VIEW; no dock container ever holds an oversize subject.
//    • SSOT THRESHOLD LOCK — the two placement thresholds (4 / 8) live in exactly
//      one place and match the D7.1b notion they generalize (no forked number).
//
import { describe, it, expect } from 'vitest'
import {
  deriveWeight, WEIGHT_THRESHOLDS, WEIGHT_BANDS,
  type SubjectShape,
} from './weight'
import {
  resolveSurface, placeSubject, PLACEMENT_TABLE, ESCALATION_LADDER, capacityRank,
  type Container, type PlacementScope,
} from './resolveSurface'

const SCOPES: PlacementScope[] = ['selection', 'nested-field', 'quick-edit', 'document']
const CONTAINERS: Container[] = [
  'inline', 'popover', 'dock-panel', 'dock-drill', 'focus-view', 'relocated-surface',
]
/** The scopes that ride the weight-escalation ladder (document is off-ladder). */
const LADDERED: PlacementScope[] = ['selection', 'nested-field', 'quick-edit']

describe('FF-PLACEMENT-DERIVED — deriveWeight (shape → band, pure + total)', () => {
  it('≤ inlineMaxFields flat scalar fields, no nesting → flat', () => {
    expect(deriveWeight({ flatFields: 1 })).toBe('flat')
    expect(deriveWeight({ flatFields: WEIGHT_THRESHOLDS.inlineMaxFields })).toBe('flat')
    expect(deriveWeight({ flatFields: 0 })).toBe('flat')
  })

  it('> inlineMaxFields flat fields, no nesting → grouped (one grouped panel, still)', () => {
    expect(deriveWeight({ flatFields: WEIGHT_THRESHOLDS.inlineMaxFields + 1 })).toBe('grouped')
    expect(deriveWeight({ flatFields: 40 })).toBe('grouped')
  })

  it('nested structure within the depth budget → nested (regardless of breadth)', () => {
    expect(deriveWeight({ flatFields: 1, hasNested: true })).toBe('nested')
    expect(deriveWeight({ flatFields: 1, depth: 3 })).toBe('nested')
    expect(deriveWeight({ flatFields: 99, depth: WEIGHT_THRESHOLDS.maxDrillDepth })).toBe('nested')
  })

  it('depth past maxDrillDepth → oversize (over-depth dominates)', () => {
    expect(deriveWeight({ flatFields: 1, depth: WEIGHT_THRESHOLDS.maxDrillDepth + 1 })).toBe('oversize')
    expect(deriveWeight({ flatFields: 0, depth: 20 })).toBe('oversize')
  })

  it('hasNested defaults to depth > 0 when omitted', () => {
    expect(deriveWeight({ flatFields: 2, depth: 0 })).toBe('flat')
    expect(deriveWeight({ flatFields: 2, depth: 1 })).toBe('nested')
  })

  it('is total — any plausible shape lands in exactly one known band', () => {
    for (const flatFields of [0, 1, 4, 5, 50]) {
      for (const depth of [0, 1, 8, 9, 30]) {
        for (const hasNested of [undefined, true, false]) {
          const shape: SubjectShape = { flatFields, depth, hasNested }
          expect(WEIGHT_BANDS).toContain(deriveWeight(shape))
        }
      }
    }
  })
})

describe('FF-PLACEMENT-DERIVED — resolveSurface is total over scope × weight', () => {
  it('every (scope, band) resolves to exactly one container in the closed set', () => {
    for (const scope of SCOPES) {
      for (const band of WEIGHT_BANDS) {
        const c = resolveSurface(scope, band)
        expect(CONTAINERS).toContain(c)
      }
    }
  })

  it('the SSOT table covers the full cross product (no missing cell)', () => {
    expect(Object.keys(PLACEMENT_TABLE).sort()).toEqual([...SCOPES].sort())
    for (const scope of SCOPES) {
      expect(Object.keys(PLACEMENT_TABLE[scope]).sort()).toEqual([...WEIGHT_BANDS].sort())
    }
  })
})

describe('FF-PLACEMENT-DERIVED — placement is DERIVED, not per-editor', () => {
  it('the table is keyed ONLY by abstract scope × weight axes (no editor/type literal)', () => {
    // The scope keys are the closed abstract set — not node types or editor names.
    expect(Object.keys(PLACEMENT_TABLE).sort()).toEqual([...SCOPES].sort())
    // The band keys are the closed weight set — again abstract, not domain literals.
    for (const scope of SCOPES) {
      const bands = Object.keys(PLACEMENT_TABLE[scope])
      expect(bands.every((b) => (WEIGHT_BANDS as readonly string[]).includes(b))).toBe(true)
    }
  })
})

describe('FF-PLACEMENT-DERIVED — escalation invariant (monotone along the ladder)', () => {
  it('for every weight-laddered scope, heavier weight never yields a lighter container', () => {
    for (const scope of LADDERED) {
      let prevRank = -Infinity
      for (const band of WEIGHT_BANDS) {
        const rank = capacityRank(resolveSurface(scope, band))
        expect(rank).toBeGreaterThanOrEqual(0) // stays on the escalation ladder
        expect(rank).toBeGreaterThanOrEqual(prevRank) // non-decreasing = escalates, never regresses
        prevRank = rank
      }
    }
  })

  it('the ladder order is POPOVER → DOCK-PANEL → DOCK-DRILL → FOCUS-VIEW (§3.3)', () => {
    expect(capacityRank('popover')).toBeLessThan(capacityRank('dock-panel'))
    expect(capacityRank('dock-panel')).toBeLessThan(capacityRank('dock-drill'))
    expect(capacityRank('dock-drill')).toBeLessThan(capacityRank('focus-view'))
    // quick-edit walks exactly that ladder as weight grows.
    expect(resolveSurface('quick-edit', 'flat')).toBe('popover')
    expect(resolveSurface('quick-edit', 'nested')).toBe('dock-drill')
    expect(resolveSurface('quick-edit', 'oversize')).toBe('focus-view')
  })
})

describe('FF-NO-CRAMMED-DOCK — an oversize subject cannot stay in the dock', () => {
  it('every weight-laddered scope escalates an OVERSIZE subject to the focus-view', () => {
    for (const scope of LADDERED) {
      expect(resolveSurface(scope, 'oversize')).toBe('focus-view')
    }
  })

  it('no dock container (panel/drill) ever holds an oversize subject', () => {
    for (const scope of SCOPES) {
      const c = resolveSurface(scope, 'oversize')
      expect(c).not.toBe('dock-panel')
      expect(c).not.toBe('dock-drill')
    }
  })
})

describe('FF-PLACEMENT-DERIVED — document scope is a weight-independent home', () => {
  it('document scope always lands on its own relocated surface (any weight)', () => {
    for (const band of WEIGHT_BANDS) {
      expect(resolveSurface('document', band)).toBe('relocated-surface')
    }
  })
})

describe('FF-PLACEMENT-DERIVED — SSOT threshold lock (generalizes D7.1b, no fork)', () => {
  it('the two placement thresholds are exactly the D7.1b numbers (4 / 8)', () => {
    // inlineMaxFields === Inspector GROUP_TAB_THRESHOLD; maxDrillDepth === NestedItemControl.MAX_NESTING.
    // Locking them here makes any silent divergence a red test.
    expect(WEIGHT_THRESHOLDS.inlineMaxFields).toBe(4)
    expect(WEIGHT_THRESHOLDS.maxDrillDepth).toBe(8)
  })

  it('the escalation ladder is the closed container set minus the off-ladder home', () => {
    expect([...ESCALATION_LADDER]).toEqual(['inline', 'popover', 'dock-panel', 'dock-drill', 'focus-view'])
    expect(capacityRank('relocated-surface')).toBe(-1) // document home is not on the ladder
  })
})

describe('FF-PLACEMENT-DERIVED — placeSubject composition (shape → container)', () => {
  it('a light selection fills the dock panel; a deep one escapes to a focus-view', () => {
    expect(placeSubject('selection', { flatFields: 3 })).toBe('dock-panel')
    expect(placeSubject('selection', { flatFields: 1, depth: 12 })).toBe('focus-view')
  })

  it('a scalar nested field renders inline; a structured one drills', () => {
    expect(placeSubject('nested-field', { flatFields: 2 })).toBe('inline')
    expect(placeSubject('nested-field', { flatFields: 2, hasNested: true })).toBe('dock-drill')
  })

  it('a light quick-edit pops over', () => {
    expect(placeSubject('quick-edit', { flatFields: 1 })).toBe('popover')
  })
})
