// ── concern — the REFINE canon's CONCERN taxonomy (root Law 11) ──────────────────
//
//  The Authoring Canon's REFINE moment made real: the inspector is no longer a flat,
//  tangled property dump (the owner's crisis — "everything nauseatingly mushed", "you
//  can't tell what means what, where"). Every authorable thing for a selected element
//  is projected into ONE of five CONCERNS, rendered as a collapsible group in ONE
//  canonical order — so the author sees a calm, legible surface where each field's
//  MEANING is obvious from the group it lives in.
//
//  The engine owns the DECLARED tag (`FieldConcern` on PropField — a presentation hint
//  the engine never interprets, the sibling of `group`); THIS app-tier module owns the
//  taxonomy's ORDER, its bilingual LABELS (Law 4 — locales live in the app), the safe
//  DEFAULT, and the FACET→concern projection. A field/facet DECLARES its concern; the
//  dock groups by it GENERICALLY (Law 1 — never an `if type===`), so a new field lands
//  in its concern automatically (OCP / FF-CONCERN-GROUPED).
//
import type {
  FieldConcern, FacetDescriptor, LocaleString, ObjectMeta, PropField, PropSchema,
} from '@statdash/react/engine'
import { facetRegistry, getAtPath } from '@statdash/react/engine'
import { planesForRole, isPlaneVisible } from './plane'
import type { Role } from '../studio/useRole'

export type { FieldConcern }

/**
 * The canonical CONCERN render order — the owner-blessed spine (root Law 11):
 *   CONTENT (what it says) → DATA (what it means) → STYLE (how it looks) →
 *   LAYOUT (where it sits) → BEHAVIOR (how it acts).
 * The dock renders concern groups in THIS order, always; an empty concern self-drops.
 */
export const CONCERN_ORDER: readonly FieldConcern[] = [
  'content', 'data', 'style', 'layout', 'behavior',
] as const

/**
 * The safe DEFAULT concern (root Law 11 · the byte-identical default): an untagged
 * field is legible under CONTENT — never lost, never an ungrouped orphan (the peer of
 * `plane` defaulting to author). Mirrors `PropField.concern` absent ⇒ `'content'`.
 */
export const DEFAULT_CONCERN: FieldConcern = 'content'

/** The bilingual concern labels — the single group heading the author reads. */
export const CONCERN_LABELS: Record<FieldConcern, LocaleString> = {
  content:  { ka: 'შიგთავსი',    en: 'Content'  },
  data:     { ka: 'მონაცემები',  en: 'Data'     },
  style:    { ka: 'სტილი',       en: 'Style'    },
  layout:   { ka: 'განლაგება',   en: 'Layout'   },
  behavior: { ka: 'ქცევა',       en: 'Behavior' },
}

/**
 * Which concern groups are OPEN by default — progressive disclosure ("see only what's
 * needed at that moment"). CONTENT + DATA (the primary authoring: what it says + what
 * it means) show; STYLE / LAYOUT / BEHAVIOR (refinement) fold, drilled in on demand.
 * A user toggle overrides this per group (view-state only — the taxonomy is pure).
 */
export const CONCERN_OPEN_BY_DEFAULT: ReadonlySet<FieldConcern> =
  new Set<FieldConcern>(['content', 'data'])

/** A field's declared concern (absent ⇒ the safe CONTENT default). The ONE reader. */
export function concernOfField(field: PropField): FieldConcern {
  return field.concern ?? DEFAULT_CONCERN
}

// ── FACET → concern (the app-tier projection) ─────────────────────────────────────
//
//  A FACET (packages/react `FacetDescriptor`) is a universal element capability — each
//  serves exactly ONE concern. The engine's FacetDescriptor does not (yet) carry a
//  `concern` axis, and the concrete facets register HERE in the app tier (builtinFacets),
//  so their concern PLACEMENT is an app presentation decision — declared as this small,
//  OCP-open lookup keyed by the facet's STABLE id (never a node type — Law 1). A new
//  facet adds one entry (or falls to the safe default); the dock is unchanged. When
//  `FacetDescriptor` gains a first-class `concern?` (the unifying follow-up, an
//  architect call), this map folds onto the descriptor — see the return packet.
//
const FACET_CONCERN: Readonly<Record<string, FieldConcern>> = {
  data:       'data',      // the governed metric-bind ⊕ pipeline → DATA
  style:      'style',     // token-constrained view.styles → STYLE
  chrome:     'layout',    // structural variant / region / order → LAYOUT
  visibility: 'behavior',  // conditional show-when (steward plane) → BEHAVIOR
  events:     'behavior',  // trigger→action interactions → BEHAVIOR
}

/** A facet's declared concern (unknown facet ⇒ the safe default — never orphaned). */
export function concernOfFacet(facetId: string): FieldConcern {
  return FACET_CONCERN[facetId] ?? DEFAULT_CONCERN
}

// ── The concern buckets — the pure derivation the dock renders (framework-free) ──────
//
//  Split the node's (plane-filtered) schema by declared field-concern, and bucket the
//  applicable, plane-visible facets by their declared concern. Keyed by concern; the
//  render walks CONCERN_ORDER over the result and drops empties. Pure — trivially tested.
//
export interface ConcernBucket {
  fields: PropField[]          // the node's OWN fields of this concern (a plain list)
  facets: FacetDescriptor[]    // the universal facets of this concern (rich controls)
}

export function bucketByConcern(
  schema: PropSchema,
  facets: FacetDescriptor[],
): Map<FieldConcern, ConcernBucket> {
  const buckets = new Map<FieldConcern, ConcernBucket>()
  const bucket = (c: FieldConcern): ConcernBucket => {
    let b = buckets.get(c)
    if (!b) { b = { fields: [], facets: [] }; buckets.set(c, b) }
    return b
  }
  for (const f of schema) bucket(concernOfField(f)).fields.push(f)
  for (const facet of facets) bucket(concernOfFacet(facet.id)).facets.push(facet)
  return buckets
}

// ── facetAppliesToElement — the ONE "does this facet apply here" predicate ───────────
//
//  The SINGLE applicability rule shared by BOTH facet-projection surfaces — the flat dock
//  (`registerFacetSections`) AND the concern dock (`applicableFacets` below) — so they can
//  never diverge (card 0112 · R2: the two had drifted, and the concern surface, which the
//  LIVE whole-node inspector renders, still lacked the instance branch → a data-OWNING
//  section showed NO Data facet live while the flat-dock fitness passed).
//
//  Two branches, GENERIC across every facet (Law 1 — never a `node.type` read):
//    • TYPE cap  — the facet's declared `appliesWhen` over the element's DECLARED meta
//      (`data-bindable` for DATA, the slot-discriminant for STYLE/VISIBILITY, …).
//    • INSTANCE  — the selected element CARRIES a value at the facet's `readPath` (ADR-041
//      residence: ownership is an INSTANCE property, not a type cap). So a section that
//      declares an inline `data` query at runtime — but opts into no `data-bindable` TYPE
//      cap — still projects its Data facet + door onto ITS spec. The empty-readPath chrome
//      facet ('') is excluded; a caller with no instance props (a drilled band part) passes
//      `undefined` → only the TYPE branch applies (facets stay hidden during a value drill).
//
export function facetAppliesToElement(
  facet: FacetDescriptor,
  meta:  ObjectMeta | undefined,
  props: Record<string, unknown> | undefined,
): boolean {
  if (meta && facet.appliesWhen(meta)) return true
  return facet.readPath !== '' && props != null && getAtPath(props, facet.readPath) != null
}

// ── applicableFacets — the whole-node facets under the active lens ───────────────────
//
//  The SAME predicate registerFacetSections uses (`facetAppliesToElement` — plane visibility
//  ⊕ the shared TYPE-cap ∨ INSTANCE-readPath rule), so the concern surface's facet set is
//  identical to the flat registry's, by construction (Law 1 — never a type read). `props`
//  (the selected element's own props) feeds the instance branch; absent ⇒ TYPE branch only.
//
export function applicableFacets(
  meta:  ObjectMeta,
  role:  Role | undefined,
  props?: Record<string, unknown>,
): FacetDescriptor[] {
  const planes = planesForRole(role)
  return facetRegistry
    .list()
    .filter((f) => isPlaneVisible(f.plane, planes) && facetAppliesToElement(f, meta, props))
}
