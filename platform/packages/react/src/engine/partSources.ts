// ── partSources — the ENGINE Part-port adapters (ADR-041 · ROOT-3 · Phase 2) ─────
//
//  Two of the three residence adapters that make the Part port REAL. Both are PURE
//  (no React, no store, no app SSOT) so they live engine-side and keep `packages/
//  react` app-agnostic (Law 3). The third residence — `sourced` — touches the
//  app-owned `filterSchema` SSOT, so its adapter lives with that SSOT in `apps/panel`
//  (`canvas/bandSource.ts`), registered under the SAME residence-keyed port.
//
//    valueParts (residence 'value')  — the BE-1 `bandItemsOf` reading, promoted to a
//      `PartSource`: parts are typed values on `element[field]`, each carrying its own
//      declared `itemSchema` contract; addressed POSITIONALLY by `${field}.${index}`.
//    slotParts  (residence 'slot')   — walks `element[field]` child node instances,
//      `accepts`-gated (the FF-COMPOSITE-INTEGRITY accept-set logic); a slot part IS
//      the child node, so its address carries the child's `nodeId` and NO `partPath`.
//
//  Residence discriminants are declared via typed consts (never a `residence: '<lit>'`
//  construction) so `slice-meta.ts` stays the SOLE residence-tagged PartField
//  constructor — the FF-ONE-PART-GRAMMAR ratchet allowlist stays = 1. The per-part
//  `residence` is carried straight off the declared `part`, never re-derived here.
//
import type {
  PartSource, EnumeratedPart, PartMutation, PartResidence,
} from './partPort'
import type { PropSchema } from './slice-meta'
import { getAtPath, setAtPath } from '@statdash/engine'
import { bandItemsOf } from './bandItems'

// Residence discriminants — typed consts, NOT `residence: '<literal>'` constructions
// (the FF-ONE-PART-GRAMMAR ratchet keeps slice-meta.ts the sole residence constructor).
const R_VALUE: PartResidence = 'value'
const R_SLOT:  PartResidence = 'slot'

const asRecord = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' ? v : {}) as Record<string, unknown>

/** Move the array member at `from` to `to`, immutably (out-of-range ⇒ unchanged). */
function reorderArray<T>(arr: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length) return [...arr]
  const next = [...arr]
  const [item] = next.splice(from, 1)
  const at = to < 0 ? 0 : to > next.length ? next.length : to
  next.splice(at, 0, item)
  return next
}

// ── valueParts — the homogeneous props value-band (BE-1 bandItemsOf, promoted) ────
//
//  Reads the declared value-band field off the container (`node.props` for the
//  authoring inspector, or the flattened node for the overlay — the SAME dual-
//  container contract `bandItemsOf` already serves), one `EnumeratedPart` per array
//  member, addressed positionally. `value` parts stay positional (ADR-041 Delta 1):
//  `partPath = ${field}.${index}`, `key` undefined.
//
export const valueParts: PartSource = {
  residence: R_VALUE,
  enumerateParts(element, part, _ctx): EnumeratedPart[] {
    // Reuse the ONE band reading over a single-field projection of this part.
    const projected: PropSchema = [{
      field:      part.field,
      type:       'array',
      label:      part.label ?? part.field,
      itemSchema: part.itemSchema ?? [],
      itemGroups: part.itemGroups,
      itemLabel:  part.itemLabel,
    }]
    const refs = bandItemsOf(element, projected)
    return refs.map((ref) => ({
      address:    { nodeId: (element.id as string) ?? '', partPath: ref.path },
      contract:   ref.itemSchema,
      subject:    asRecord(getAtPath(element, ref.path)),
      residence:  part.residence,
      field:      ref.field,
      index:      ref.index,
      itemLabel:  ref.itemLabel,
      itemGroups: ref.itemGroups,
    }))
  },
  writePart(element, address, subfield, value, _ctx): PartMutation | null {
    if (!address.partPath) return null
    return {
      target: 'node-props',
      props:  setAtPath(element, `${address.partPath}.${subfield}`, value) as Record<string, unknown>,
    }
  },
  // STRUCTURAL sibling (ADR-042 D2): a value-band reorder is an in-place array splice on
  // `element[field]`, committed via the SAME `node-props` mutation `writePart` returns (so
  // the host's ONE commit switch needs no new arm). Slot/keyed verbs are not this residence's
  // (a value part IS a positional array member) → null. Additive; a value-reorder gesture
  // (kpi-card drag) wires to it in a later slice — the port is complete now (OCP).
  placePart(element, op, _ctx): PartMutation | null {
    if (op.kind !== 'reorder') return null
    const arr = element[op.field]
    if (!Array.isArray(arr)) return null
    return { target: 'node-props', props: { ...element, [op.field]: reorderArray(arr, op.from, op.index) } }
  },
}

// ── slotParts — the tree-band (SlotDef) residence, accepts-gated ──────────────────
//
//  Walks the declared slot field's child node instances; each child IS the part
//  (address carries the child's `nodeId`, `partPath` undefined — ADR-041). The
//  accept-gate is the SAME projection FF-COMPOSITE-INTEGRITY locks: a child whose
//  `type` is outside the field's declared `accepts` set is not enumerated. The
//  child's own contract is its node schema (resolved through the normal node path
//  when it is selected as a whole node), so `contract` is left empty here.
//
export const slotParts: PartSource = {
  residence: R_SLOT,
  enumerateParts(element, part, _ctx): EnumeratedPart[] {
    const children = element[part.field]
    if (!Array.isArray(children)) return []
    const accepts = part.accepts && part.accepts.length > 0 ? new Set(part.accepts) : null
    const out: EnumeratedPart[] = []
    children.forEach((child, index) => {
      const c = asRecord(child)
      if (accepts && !accepts.has(c.type as string)) return
      out.push({
        address:   { nodeId: (c.id as string) ?? '' },   // slot part IS the child node
        contract:  [],
        subject:   c,
        residence: part.residence,
        field:     part.field,
        index,
      })
    })
    return out
  },
  // A slot part's SCALAR edit is not a distinct write — a slot part IS a child node, edited
  // as a whole node through the normal node path. Structural edits go through `placePart`.
  writePart(): PartMutation | null {
    return null
  },
  // STRUCTURAL sibling (ADR-042 D2): the slot residence's structural verbs — insert / move /
  // remove a child NODE — tagged onto the `node-children` mutation the host commits through
  // its tree reducers (`insertNodes` / `moveNode` / `removeNode`, keyed by `op.kind`). The
  // adapter is thin BY DESIGN: the tree ALGEBRA lives in the store reducers (the SSOT), so
  // this is the residence-ROUTING seam, not a second tree mechanism — every structural node
  // edit now flows through the ONE port (FF-ONE-PLACEMENT-GRAMMAR). A value/keyed `reorder`
  // is not this residence's verb → null.
  placePart(_element, op, _ctx): PartMutation | null {
    if (op.kind === 'reorder') return null
    return { target: 'node-children', op }
  },
}
