// ── bandItems — declaration-driven value-band enumeration (ADR-038) ─────────────
//
//  The homoiconic projection at the heart of the Bounded Element Law: an element's
//  selectable child ITEMS are DERIVED from its own declared schema — a `PropField`
//  of `type: 'array'` that carries an `itemSchema` (the per-item contract, ADR-022)
//  IS a value-band. There is NO per-type knowledge here: `bandFieldsOf` filters the
//  declaration, so a NEW band-owning element (hero cards, R3, …) is discovered with
//  ZERO new code — the machinery is a pure function of the declaration (OCP · DIP).
//
//  Two representations share this one enumerator (Law of Demeter — callers pass
//  their own container, never reach across):
//    • the RENDERED config node (canvas overlay): band values live inline on the
//      node (`node.items`), the flattened NodePageConfig shape;
//    • the AUTHORING node (inspector): band values live under `node.props.items`.
//  Both address the band by the SAME declared field name, so one function serves
//  both — the caller supplies whichever container holds the field.
//
import type { PropSchema, PropField, PropertyGroup } from '@statdash/react/engine'

/** One selectable value-band item, addressed generically by (field, index). */
export interface BandItemRef {
  /** The declaring band field (e.g. `'items'`). */
  field:      string
  /** The item's index within the band array. */
  index:      number
  /** Dot-path to this item within the container (e.g. `'items.0'`) — the store path. */
  path:       string
  /** The item's OWN declared contract — the bounded schema the Inspector projects. */
  itemSchema: PropSchema
  /** The item's declared property grouping (accordion sections), or []. */
  itemGroups: PropertyGroup[]
  /** How to title the item in a summary (dot-path to its label field), if declared. */
  itemLabel?: string
}

/**
 * The band FIELDS a schema declares: array fields carrying an `itemSchema`. Pure
 * projection over the declaration — never a concrete-type check. A schema with no
 * such field simply yields none (a non-band element is not special-cased away).
 */
export function bandFieldsOf(schema: PropSchema): PropField[] {
  return schema.filter((f) => f.type === 'array' && Array.isArray(f.itemSchema))
}

/**
 * Enumerate the selectable band items of an element, from its declared `schema`
 * and the `container` holding the band values (the node, or its `props`). Generic
 * over ANY band-owning element — the proof of the law: one function, no per-type
 * branch, works for every element that DECLARES a band.
 */
export function bandItemsOf(
  container: Record<string, unknown> | null | undefined,
  schema:    PropSchema,
): BandItemRef[] {
  if (!container) return []
  const out: BandItemRef[] = []
  for (const f of bandFieldsOf(schema)) {
    const arr = container[f.field]
    if (!Array.isArray(arr)) continue
    arr.forEach((_item, index) => {
      out.push({
        field:      f.field,
        index,
        path:       `${f.field}.${index}`,
        itemSchema: f.itemSchema ?? [],
        itemGroups: f.itemGroups ?? [],
        itemLabel:  f.itemLabel,
      })
    })
  }
  return out
}
