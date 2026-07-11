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

describe('FF-PROMOTION-LOSSLESS — R2-EXPAND: kpi-card promoted (shadow), DOM-parity gate is REAL', () => {
  it('the real DOM-parity gate now proves losslessness (this scaffold is superseded)', () => {
    // R2-EXPAND has landed: `kpi-card` is a REGISTERED runtime node type, built
    // ALONGSIDE the legacy KpiStripNode.items[] path behind isPromotionEnabled(
    // 'kpi-card') (Law 7 · Strangler expand). The R1 "no promotion leaked" scaffold
    // is therefore SUPERSEDED by the real byte-identical DOM-parity gate, which
    // renders the whole provisioning corpus BOTH ways and compares:
    //     packages/plugins/panels/kpi-strip/promotion-lossless.fitness.test.tsx
    //       → FF-PROMOTION-LOSSLESS
    // That gate — not this one — is the SOLE authorizer of the R2-contract one-way
    // door (retiring the legacy path). It stays RED-if-broken there.

    // This roster scan asserts the PALETTE boundary (AUTHORING_METAS = the shipped
    // authoring roster). kpi-card is a SHADOW runtime type and is intentionally NOT
    // yet in the palette roster — palette exposure lands at R2-contract, once the
    // DOM-parity gate authorizes retiring the legacy residence. hero-card is R3.
    const registeredTypes = new Set(METAS.map(idOf))
    expect(registeredTypes.has('kpi-card')).toBe(false)   // shadow only; palette-exposed at R2-contract
    expect(registeredTypes.has('hero-card')).toBe(false)  // R3
    // The unpromoted originals are still present (Strangler boundary intact — the
    // legacy path is NOT removed in the expand phase):
    expect(registeredTypes.has('kpi-strip')).toBe(true)
    expect(registeredTypes.has('hero')).toBe(true)
  })
})
