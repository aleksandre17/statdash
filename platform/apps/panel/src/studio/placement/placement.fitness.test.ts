// ── FF-PLACEMENT-DERIVED — the Placement Law as a pure, provable primitive (SL-0b) ─
//
//  Proves that WHERE any editable subject is placed is a DERIVED total function of
//  its scope × weight — never hand-placed per editor — aligned to SPEC §3.2, and
//  that the owner's "crammed right dock" is a state the code cannot produce:
//
//    • TOTALITY — every (scope, band) resolves to exactly one container in the
//      closed set (no gap, no undefined).
//    • DERIVED, NOT PER-EDITOR — the SSOT table is keyed ONLY by the abstract
//      scope × weight axes; no node-type / editor-name / domain literal appears.
//    • ESCALATION INVARIANT — for every weight-laddered scope, heavier weight
//      never resolves to a LIGHTER container (monotone along the ladder), and the
//      ladder is POPOVER (glance) → DOCK-PANEL / DRILL (form) → FOCUS-VIEW (workspace).
//    • FF-NO-CRAMMED-DOCK — an OVERSIZE subject always escalates OUT of the dock to
//      the FOCUS-VIEW; no dock container ever holds an oversize subject (incl. page).
//    • FF-CANONICAL-ALIGNMENT — the finer four-band table PROJECTS onto the §3.2
//      three-weight table: the two vocabularies are one model, not two.
//    • SSOT THRESHOLD LOCK — the two placement thresholds (4 / 8) live in exactly
//      one place and match the §4 / D7.1b notion they generalize (no forked number).
//
import { describe, it, expect } from 'vitest'
import {
  deriveWeight, toCanonicalWeight, WEIGHT_THRESHOLDS, WEIGHT_BANDS, CANONICAL_WEIGHTS,
  type SubjectShape, type CanonicalWeight,
} from './weight'
import {
  resolveSurface, placeSubject, containerWeightFamily,
  PLACEMENT_TABLE, CANONICAL_TABLE, ESCALATION_LADDER, capacityRank,
  type Container, type PlacementScope,
} from './resolveSurface'

const SCOPES: PlacementScope[] = ['micro-target', 'element', 'nested-item', 'page', 'site']
const CONTAINERS: Container[] = [
  'inline', 'popover', 'dock-panel', 'dock-drill', 'focus-view', 'relocated-surface',
]
/** The scopes that ride the weight-escalation ladder (site is an off-ladder home). */
const LADDERED: PlacementScope[] = ['micro-target', 'element', 'nested-item', 'page']

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

  it('a rich type dominates → oversize/workspace regardless of breadth or nesting (§3.1)', () => {
    expect(deriveWeight({ flatFields: 1, hasRichType: true })).toBe('oversize')
    expect(deriveWeight({ flatFields: 0, depth: 0, hasRichType: true })).toBe('oversize')
    expect(toCanonicalWeight(deriveWeight({ flatFields: 1, hasRichType: true }))).toBe('workspace')
  })

  it('hasNested defaults to depth > 0 when omitted', () => {
    expect(deriveWeight({ flatFields: 2, depth: 0 })).toBe('flat')
    expect(deriveWeight({ flatFields: 2, depth: 1 })).toBe('nested')
  })

  it('is total — any plausible shape lands in exactly one known band', () => {
    for (const flatFields of [0, 1, 4, 5, 50]) {
      for (const depth of [0, 1, 8, 9, 30]) {
        for (const hasNested of [undefined, true, false]) {
          for (const hasRichType of [undefined, true, false]) {
            const shape: SubjectShape = { flatFields, depth, hasNested, hasRichType }
            expect(WEIGHT_BANDS).toContain(deriveWeight(shape))
          }
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
    // The scope keys are the canonical closed set — not node types or editor names.
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
    // micro-target walks exactly that ladder as weight grows.
    expect(resolveSurface('micro-target', 'flat')).toBe('popover')
    expect(resolveSurface('micro-target', 'nested')).toBe('dock-drill')
    expect(resolveSurface('micro-target', 'oversize')).toBe('focus-view')
  })
})

describe('FF-NO-CRAMMED-DOCK — an oversize subject cannot stay in the dock', () => {
  it('every weight-laddered scope escalates an OVERSIZE subject to the focus-view', () => {
    for (const scope of LADDERED) {
      expect(resolveSurface(scope, 'oversize')).toBe('focus-view')
    }
  })

  it('the new page scope: workspace-weight escapes to the focus-view, never crams the dock', () => {
    // The reported cram (filters pipeline stacked in the dock) is unrepresentable.
    expect(resolveSurface('page', 'oversize')).toBe('focus-view')
    expect(placeSubject('page', { flatFields: 2, hasRichType: true })).toBe('focus-view')
  })

  it('no dock container (panel/drill) ever holds an oversize subject', () => {
    for (const scope of SCOPES) {
      const c = resolveSurface(scope, 'oversize')
      expect(c).not.toBe('dock-panel')
      expect(c).not.toBe('dock-drill')
    }
  })
})

describe('FF-PLACEMENT-DERIVED — site scope is a weight-independent home', () => {
  it('site scope always lands on its own relocated surface (any weight)', () => {
    for (const band of WEIGHT_BANDS) {
      expect(resolveSurface('site', band)).toBe('relocated-surface')
    }
  })
})

describe('FF-CANONICAL-ALIGNMENT — the four-band table projects onto §3.2 (one model)', () => {
  it('every laddered container answers to the canonical weight family of its band', () => {
    // element / nested-item / page: their flat/grouped/nested bands are all FORM, and
    // oversize is WORKSPACE — the container's weight family must agree.
    for (const scope of ['element', 'nested-item', 'page'] as PlacementScope[]) {
      for (const band of WEIGHT_BANDS) {
        const container = resolveSurface(scope, band)
        expect(containerWeightFamily(container)).toBe(toCanonicalWeight(band))
      }
    }
  })

  it('micro-target carries the glance end (§3.2 glance → POPOVER)', () => {
    // glance is a scope position, not a shape band: a single transient property is the
    // micro-target, and it pops over. Heavier bands escalate off the popover.
    expect(resolveSurface('micro-target', 'flat')).toBe('popover')
    expect(containerWeightFamily('popover')).toBe('glance')
  })

  it('the fine cells agree with the CANONICAL_TABLE §3.2 cells (form/workspace)', () => {
    // Where §3.2 states a form cell, the fine form bands land in the same weight family;
    // where it states workspace, the oversize band matches exactly.
    for (const scope of SCOPES) {
      const canonical = CANONICAL_TABLE[scope]
      if (canonical.form) {
        expect(containerWeightFamily(resolveSurface(scope, 'grouped')))
          .toBe(containerWeightFamily(canonical.form))
      }
      if (canonical.workspace) {
        expect(resolveSurface(scope, 'oversize')).toBe(canonical.workspace)
      }
    }
  })

  it('CANONICAL_TABLE is DATA keyed only by scope × canonical weight (no domain literal)', () => {
    expect(Object.keys(CANONICAL_TABLE).sort()).toEqual([...SCOPES].sort())
    for (const scope of SCOPES) {
      const weights = Object.keys(CANONICAL_TABLE[scope]) as CanonicalWeight[]
      expect(weights.every((w) => (CANONICAL_WEIGHTS as readonly string[]).includes(w))).toBe(true)
    }
  })
})

describe('FF-PLACEMENT-DERIVED — SSOT threshold lock (generalizes §4 / D7.1b, no fork)', () => {
  it('the two placement thresholds are exactly the §4 / D7.1b numbers (4 / 8)', () => {
    // inlineMaxFields === Inspector GROUP_TAB_THRESHOLD; maxDrillDepth === NestedItemControl.MAX_NESTING.
    // Locking them here makes any silent divergence a red test.
    expect(WEIGHT_THRESHOLDS.inlineMaxFields).toBe(4)
    expect(WEIGHT_THRESHOLDS.maxDrillDepth).toBe(8)
  })

  it('the escalation ladder is the closed container set minus the off-ladder home', () => {
    expect([...ESCALATION_LADDER]).toEqual(['inline', 'popover', 'dock-panel', 'dock-drill', 'focus-view'])
    expect(capacityRank('relocated-surface')).toBe(-1) // site home is not on the ladder
  })
})

describe('FF-PLACEMENT-DERIVED — placeSubject composition (shape → container)', () => {
  it('a light element fills the dock panel; a deep one escapes to a focus-view', () => {
    expect(placeSubject('element', { flatFields: 3 })).toBe('dock-panel')
    expect(placeSubject('element', { flatFields: 1, depth: 12 })).toBe('focus-view')
  })

  it('a scalar nested item renders inline; a structured one drills', () => {
    expect(placeSubject('nested-item', { flatFields: 2 })).toBe('inline')
    expect(placeSubject('nested-item', { flatFields: 2, hasNested: true })).toBe('dock-drill')
  })

  it('a page config docks; a page filters-pipeline (rich) escalates to a focus-view', () => {
    expect(placeSubject('page', { flatFields: 3 })).toBe('dock-panel')
    expect(placeSubject('page', { flatFields: 3, hasRichType: true })).toBe('focus-view')
  })

  it('a single-property micro-target pops over', () => {
    expect(placeSubject('micro-target', { flatFields: 1 })).toBe('popover')
  })
})
