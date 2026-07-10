// ── object-model-residence.fitness.test.ts — ADR-023 residence gates ──
//
//  "Two Residences": every composable element is a TREE-BAND node (SlotDef) or a
//  VALUE-BAND typed value (itemSchema) or OPAQUE_BY_DESIGN — no fourth state. The
//  Promotion Law decides which residence: an element carrying ≥2 node facets
//  (identity, visibility expression, own style, own DataSpec, RBAC, reorder) must
//  be a registered node type, NOT a value re-inventing those facets.
//
//  These gates scan the authoring METAs (the discovery SSOT) — so they live
//  plugins-side (the dependency arrow forbids react/core from importing plugins).
//
//    FF-TWO-RESIDENCES-ONLY   — both residences are live in the corpus; the model
//                               is not collapsing to one. (SCAFFOLD · hardens R3.)
//    FF-NO-FACET-REINVENTION  — no VALUE-BAND itemSchema declares a reserved node
//                               facet (visibility expression). The lone pending
//                               offender is allow-listed; a NEW one breaks the
//                               gate; it flips to a HARD gate at R2/R3. (SCAFFOLD.)
//    FF-PROMOTION-LOSSLESS    — no promotion has silently leaked into R1 (kpi-card
//                               / hero-card are NOT node types yet). Becomes the
//                               DOM-parity gate at R2-expand. (SCAFFOLD · R2.)
//
import { describe, it, expect } from 'vitest'
import { AUTHORING_METAS }      from '../authoring-metas'

// ── Structural view over a META (union-narrowing-free) ───────────────────────
interface FieldView {
  field?:      string
  itemSchema?: FieldView[]
}
interface MetaView {
  type?:        string
  slot?:        string
  controlType?: string
  slots?:       Record<string, unknown>
  schema?:      FieldView[]
}
const METAS = AUTHORING_METAS as unknown as MetaView[]
const idOf = (m: MetaView): string => m.type ?? m.slot ?? m.controlType ?? '<anon>'

// ── FF-NO-FACET-REINVENTION ──────────────────────────────────────────────────
//  Reserved node facets a VALUE-BAND item may not alias. Scoped to the UNAMBIGUOUS
//  signal — a per-item VISIBILITY EXPRESSION (`view.visibleWhen` is a node facet;
//  Grafana/Vega value bands never carry per-item visibility). `id`/style are left
//  to the R3 hard gate (they need the value-vs-facet disambiguation Grafana
//  fieldConfig legitimately uses).
const RESERVED_FACET_FIELDS = new Set(['when', 'visibleWhen', 'visibleToRoles'])

/** Collect META identities whose VALUE-BAND (itemSchema) fields alias a reserved facet. */
function facetReinventingMetas(): string[] {
  const offenders = new Set<string>()
  const walk = (fields: FieldView[] | undefined, insideItem: boolean, owner: string): void => {
    for (const f of fields ?? []) {
      if (insideItem && f.field && RESERVED_FACET_FIELDS.has(f.field)) offenders.add(owner)
      if (f.itemSchema) walk(f.itemSchema, true, owner)   // descend INTO the value band
    }
  }
  for (const m of METAS) walk(m.schema, false, idOf(m))
  return [...offenders].sort()
}

describe('FF-NO-FACET-REINVENTION — value-band items may not re-invent node facets [SCAFFOLD · hardens R2/R3]', () => {
  it('the only itemSchema re-inventing a visibility facet is the pending kpi-card promotion', () => {
    // kpi-strip's KpiItemSchema carries `when` (a visibility expression) — the F2
    // debt the Promotion Law names: the KPI card has ≥2 node facets (id + when +
    // own value data) and MUST become a `kpi-card` node (R2). Allow-listed here so
    // the gate blocks any NEW facet-reinventing item today, and FLIPS to `[]` (a
    // hard gate) the moment R2 retires the KpiItemSchema.
    const PENDING_PROMOTION = ['kpi-strip']   // R2-contract: becomes []
    expect(facetReinventingMetas()).toEqual(PENDING_PROMOTION)
  })
})

describe('FF-TWO-RESIDENCES-ONLY — tree band + value band are both live [SCAFFOLD · hardens R3]', () => {
  it('the corpus exercises BOTH residences (not collapsing to one)', () => {
    const hasTreeBand  = METAS.some(m => m.slots && Object.keys(m.slots).length > 0)
    const hasValueBand = METAS.some(m => (m.schema ?? []).some(f => !!f.itemSchema))
    // Tree band = SlotDef children (Puck slot); value band = itemSchema (Builder
    // subFields / Sanity object). Both canonical, both retained (ALT-A rejected).
    expect(hasTreeBand).toBe(true)
    expect(hasValueBand).toBe(true)
  })
})

describe('FF-PROMOTION-LOSSLESS — no promotion leaked into R1 [SCAFFOLD · becomes DOM-parity at R2]', () => {
  it('kpi-card / hero-card are NOT node types yet (R1 = unify only, no promotion)', () => {
    const registeredTypes = new Set(METAS.map(idOf))
    // R1 unifies the type system WITHOUT promoting anything. kpi/hero remain in
    // their current residence (panel with itemSchema / node). When R2-expand
    // registers `kpi-card`, this scaffold is replaced by the real lossless-DOM
    // parity gate (migrate(vN) renders DOM-identical over the provisioning corpus).
    expect(registeredTypes.has('kpi-card')).toBe(false)
    expect(registeredTypes.has('hero-card')).toBe(false)
    // The unpromoted originals are still present (boundary intact):
    expect(registeredTypes.has('kpi-strip')).toBe(true)
    expect(registeredTypes.has('hero')).toBe(true)
  })
})
