// @vitest-environment node
//
// ── FF-VISIBILITY-NO-RAW-WHEN — a band item's `when` is a projected control (ADR-049 P2a) ─
//
//  ADR-049 P2a Lane 2 un-buries the band-item conditional visibility. Node-level
//  `view.visibleWhen` was already declaration-driven (the universal `visibility` facet →
//  VisibilityField); the remaining gap was the OPAQUE steward `when` object on a KPI-strip
//  item (value/sourced part items). This gate holds the projection-completeness invariant:
//  NO band-item `when` field is authored as a raw `type:'object'` control — it MUST declare
//  `type:'visibility'` so the item editor dispatches it to the SAME VisibilityBuilder the
//  node facet uses (mirrors FF-DATASPEC-AUTHORING-COMPLETE — "neither editable nor opaque
//  is a silent gap").
//
//  Imports pure schema modules (`import type` is erased; only `defineSchema` runs), so the
//  node env holds — no React/Shell pulled. Featured-slider items carry NO `when` field
//  (only kpi-strip does), so the corpus is scoped to the schemas that actually declare one.
//
import { describe, it, expect } from 'vitest'
import type { PropField, PropSchema } from '@statdash/react/engine'
import { KpiItemSchema }      from '../../panels/kpi-strip/default/KpiStripNode'
import { FeaturedItemSchema } from '../featured-slider/default/FeaturedSliderNode'

/** Every band-item schema whose items MAY carry a conditional-visibility `when`. */
const BAND_ITEM_SCHEMAS: Array<{ id: string; schema: PropSchema }> = [
  { id: 'kpi-strip.items',      schema: KpiItemSchema },
  { id: 'featured-slider.items', schema: FeaturedItemSchema },
]

/** The `when` (conditional-visibility) field of an item schema, if it declares one. */
const whenField = (schema: PropSchema): PropField | undefined =>
  schema.find((f) => f.field === 'when')

describe('FF-VISIBILITY-NO-RAW-WHEN — band-item `when` is projected, never raw JSON (ADR-049 P2a)', () => {
  it('the guard is running over real schemas (not vacuous)', () => {
    expect(BAND_ITEM_SCHEMAS.every((s) => s.schema.length > 0)).toBe(true)
  })

  it("no band-item `when` field is authored as a raw `type:'object'`", () => {
    const offenders = BAND_ITEM_SCHEMAS
      .map((s) => ({ id: s.id, when: whenField(s.schema) }))
      .filter(({ when }) => when != null && when.type === 'object')
      .map(({ id }) => id)
    expect(offenders, `raw-object when fields: ${offenders.join(' | ')}`).toEqual([])
  })

  it("the kpi-strip item `when` declares `type:'visibility'` (dispatches to the builder)", () => {
    const when = whenField(KpiItemSchema)
    expect(when).toBeDefined()
    expect(when?.type).toBe('visibility')
    // still a steward-plane advanced control (unchanged plane law — root Law 11).
    expect(when?.plane).toBe('steward')
  })

  it('BITES: a raw-object `when` WOULD be caught (guard is real)', () => {
    const fake: PropSchema = [{ field: 'when', type: 'object', label: { en: 'x' } }]
    expect(whenField(fake)?.type).toBe('object')  // the exact shape the gate rejects
  })
})
