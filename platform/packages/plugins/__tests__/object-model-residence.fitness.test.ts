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
//    FF-NO-FACET-REINVENTION  — no VALUE-BAND itemSchema aliases a genuinely
//                               node-only facet (`visibleToRoles` / RBAC). ADR-041
//                               settled per-item VISIBILITY (`when`) as a legitimate
//                               VALUE-residence facet (residence-at-field), so it is
//                               no longer an offender; the gate holds zero offenders.
//    FF-ONE-PART-GRAMMAR      — no shadow node type shadows a value band: `kpi-card`
//                               / `hero-card` are NOT node types (D-F2 retired the
//                               shadow promotion; the value band is the sole
//                               residence). Replaces the retired FF-PROMOTION-LOSSLESS.
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
//  Reserved facets a VALUE-BAND item may not alias. ADR-041 (residence-at-field)
//  SETTLED that per-item visibility (`when` / `view.visibleWhen`) is a LEGITIMATE
//  facet of the VALUE residence — not a node-only facet: the value residence owns
//  its own visibility, evaluated on the value-band render path (kpi-strip's `when`,
//  KpiStripShell + the engine `kpiVisible` SSOT). D-F2 retired the shadow promotion
//  that once framed value-band visibility as a debt to graduate; so `when` /
//  `visibleWhen` are REMOVED from the reserved set. What remains genuinely node-only
//  is per-item RBAC (`visibleToRoles`) — a render-pipeline facet with no value-band
//  home today (ADR-041 ROOT-4); a value item aliasing it is still the forbidden
//  reinvention. `id`/style stay to the R3 disambiguation.
const RESERVED_FACET_FIELDS = new Set(['visibleToRoles'])

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

describe('FF-NO-FACET-REINVENTION — value-band items may not alias a node-only facet [ADR-041]', () => {
  it('NO value-band item aliases a node-only facet (kpi-strip `when` is now a legitimate value facet)', () => {
    // ADR-041 D-F2: value-band visibility is a LEGITIMATE facet of the VALUE
    // residence (residence-at-field), so kpi-strip's KpiItemSchema `when` is NO
    // LONGER an offender — the shadow-promotion theory that framed it as a debt is
    // retired. The gate now holds ZERO offenders: no value band aliases a genuinely
    // node-only facet (`visibleToRoles`). A NEW value item that reinvents RBAC trips.
    expect(facetReinventingMetas()).toEqual([])
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

describe('FF-ONE-PART-GRAMMAR — no shadow node type shadows a value band [ADR-041 · D-F2]', () => {
  it('no `kpi-card` / `hero-card` node type shadows the value-band residence (promotion retired)', () => {
    // ADR-041 D-F2 RETIRED the shadow promotion machinery: FF-PROMOTION-LOSSLESS is
    // gone (there is no longer a second residence to prove byte-parity against — the
    // value band is the SOLE residence for a KPI card). This TIGHTENS FF-ONE-PART-
    // GRAMMAR: a KPI card is a `value` PartField of kpi-strip's `items`, never a
    // registered node type shadowing it. `kpi-card` / `hero-card` MUST NOT appear as
    // node types — the promotion node, its META, and its lowering were deleted.
    const registeredTypes = new Set(METAS.map(idOf))
    expect(registeredTypes.has('kpi-card')).toBe(false)   // deleted (D-F2) — no shadow residence
    expect(registeredTypes.has('hero-card')).toBe(false)  // never promoted
    // The value-band owners are the sole residence — present and unshadowed:
    expect(registeredTypes.has('kpi-strip')).toBe(true)
    expect(registeredTypes.has('hero')).toBe(true)
  })
})
