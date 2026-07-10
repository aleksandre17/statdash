// ── FF-PLACEMENT-AUDIT — the relocate-audit, grounded in deriveWeight (AR-49 SL-5) ─
//
//  The SL-5 relocate-audit as a DURABLE, EXECUTABLE artifact. Every heavy authoring
//  subject in the Studio is enumerated with its true SCOPE and its abstract
//  SubjectShape, and its container is asserted to be exactly `placeSubject(scope,
//  shape)` — the SAME pure kernel every surface uses. So the classification "stays in
//  the dock vs escalates to a focus-view" is DERIVED, never hand-asserted, and a
//  crammed dock is unrepresentable for the REAL subjects, not just the SL-4 fixture.
//
//  Reading the table:
//    • container 'inline' | 'popover' | 'dock-panel' | 'dock-drill'  → STAYS in the
//      dock ladder (bounded, progressive disclosure) — no relocation needed.
//    • container 'focus-view'                                        → MUST escalate
//      OUT of the dock (FF-NO-CRAMMED-DOCK).
//    • `wired` records whether the escalation is LIVE-wired today; `audited-next`
//      marks a proven-oversize subject whose relocation is a follow-on (same port).
//
//  The shape of each domain subject is derived by the CONSUMER that owns its schema
//  (the SL-4 pattern): filters via `filterPipelineShape`; the rest expressed here from
//  the §3.1 rich-type judgement (a whole engine sub-document — DataSpec / ChartDef /
//  VisibilityExpr / FilterSchema — dominates → workspace), which the law never names.
//
import { describe, it, expect } from 'vitest'
import { placeSubject, type Container, type PlacementScope, type SubjectShape } from './placement'
import { filterPipelineShape } from '../features/filters/filterPlacement'
import type { BarView } from '../features/filters/filterSchemaModel'

/** One row of the relocate-audit — a real authoring subject weighed by the law. */
interface AuditRow {
  subject:   string
  scope:     PlacementScope
  shape:     SubjectShape
  container: Container            // the ASSERTED, derived verdict
  status:    'wired' | 'stays' | 'audited-next'
  note:      string
}

const bars = (n: number): BarView[] =>
  Array.from({ length: n }, (_, i) => ({ id: `bar${i}`, bar: {} as BarView['bar'], params: [] }))

const AUDIT: readonly AuditRow[] = [
  // ── Glance / form subjects — stay on the dock ladder (bounded) ────────────────
  { subject: 'row rename (single property)', scope: 'micro-target', shape: { flatFields: 1 },
    container: 'popover', status: 'wired', note: 'SL-3 EditPopover — glance micro-edit.' },
  { subject: 'node Inspector (few fields)', scope: 'element', shape: { flatFields: 3 },
    container: 'dock-panel', status: 'stays', note: 'The default element form home.' },
  { subject: 'nested-item (flat scalars)', scope: 'nested-item', shape: { flatFields: 2 },
    container: 'inline', status: 'stays', note: 'D7.1b inline — no drill.' },
  { subject: 'nested-item (structured)', scope: 'nested-item', shape: { flatFields: 2, hasNested: true },
    container: 'dock-drill', status: 'stays', note: 'D7.1b progressive drill.' },
  { subject: 'filter-bar controls bridge', scope: 'element', shape: { flatFields: 1, hasNested: true },
    container: 'dock-drill', status: 'stays',
    note: 'FilterBarControlsBridge is ALREADY a bounded list→drill (one control at a time) — not a cram.' },

  // ── Workspace subjects — must escalate OUT to a focus-view ────────────────────
  { subject: 'nested-item (rich DataSpec item)', scope: 'nested-item', shape: { flatFields: 1, hasRichType: true },
    container: 'focus-view', status: 'wired', note: 'SL-4 — the nested-item drill boundary escalation.' },
  { subject: 'page filters pipeline (populated)', scope: 'page', shape: filterPipelineShape(bars(2)),
    container: 'focus-view', status: 'wired',
    note: 'SL-5 — the FIRST REAL page-scope escalation. FiltersDrawer affordance → self-bound focus-view.' },
  { subject: 'chart encoding / DataSpec editor', scope: 'element', shape: { flatFields: 1, hasRichType: true },
    container: 'focus-view', status: 'wired',
    note: 'ALREADY relocated: DataModelingPanel/QuerySpecEditor lives only in the Steward Model focus-view (SL-2). Re-mounting on an author dock would trip FF-AUTHOR-NO-QUERY.' },
  { subject: 'node visibility expression', scope: 'element', shape: { flatFields: 1, hasRichType: true },
    container: 'focus-view', status: 'audited-next',
    note: 'VisibilityExpr is a §3.1 rich type → oversize. Currently inline in the element dock — a NODE-FIELD escalation candidate (same SL-4 path).' },
  { subject: 'page perspectives builder', scope: 'page', shape: { flatFields: 1, hasRichType: true },
    container: 'focus-view', status: 'audited-next',
    note: 'A page-scope rich builder → oversize. A SELF-BOUND escalation candidate (same SL-5 path as filters).' },
] as const

describe('FF-PLACEMENT-AUDIT — every authoring subject is placed by the derived law', () => {
  it.each(AUDIT)('$subject ($scope) → $container', ({ scope, shape, container }) => {
    // The verdict is the pure kernel — no per-subject literal anywhere.
    expect(placeSubject(scope, shape)).toBe(container)
  })

  it('every subject the law weighs OVERSIZE resolves to the focus-view (no dock cram)', () => {
    for (const row of AUDIT) {
      if (row.container === 'focus-view') {
        expect(placeSubject(row.scope, row.shape)).toBe('focus-view')
      }
    }
  })

  it('the two REAL relocations proven live this slice are wired (filters) or pre-existing (encoding)', () => {
    const wiredFocusViews = AUDIT.filter((r) => r.container === 'focus-view' && r.status === 'wired')
    // SL-4 nested-item, SL-5 filters pipeline, and the pre-existing Model encoding home.
    expect(wiredFocusViews.map((r) => r.subject)).toEqual([
      'nested-item (rich DataSpec item)',
      'page filters pipeline (populated)',
      'chart encoding / DataSpec editor',
    ])
  })
})
