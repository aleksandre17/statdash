// ── bandSource — BE-4 re-homed under the Part port (ADR-041 · Phase 2) ───────────
//
//  BE-4 shipped the `BandSource` port: a node DECLARES which source projects its
//  band (`meta.band.source`) and the canvas projects GENERICALLY, never per-type.
//  ADR-041 folds that into the ONE Part port: BE-1 (props value-band), BE-4 (page-
//  owned filter band) and BE-5 (slot children) become THREE residence adapters of
//  ONE mechanism (`enumerateParts`/`writePart`, adapters keyed by RESIDENCE never by
//  type). The two pure adapters — `valueParts` (residence 'value') and `slotParts`
//  ('slot') — live engine-side (app-agnostic, Law 3). This file is where the third,
//  `sourcedParts` ('sourced'), lands: it touches the app-owned `filterSchema` SSOT
//  (`toBarViews`/`setBarParams`/`getParamSchema`), so it stays in `apps/panel`,
//  registered under the SAME residence-keyed port as the engine adapters.
//
//  ADR-041 Delta 1 (the sourced address convention): a `sourced` part is addressed by
//  a STABLE KEY — `partPath = ${barId}.${control-key}`, `EnumeratedPart.key` carrying
//  the control's SSOT key — so reorder/insert in the page `filterSchema` never
//  renumbers a live selection (`value` parts stay positional; `slot` parts ARE the
//  child node, `partPath` undefined). The `sourcedParts` port adapter emits this.
//
//  Phase 3 (this change): the transitional POSITIONAL `BandSource` facade is DELETED.
//  The overlay + selection collapsed onto the port's ONE stable-key `PartAddress`, so
//  there is no longer a second (positional) projection to keep — value/sourced/slot
//  selection is ONE address grammar (`enumerateParts` / `getPartSource(residence)`).
//
import { getParamSchema } from '@statdash/engine'
import type { ParamNode } from '@statdash/engine'
import {
  valueParts, slotParts, partFieldsOf,
} from '@statdash/react/engine'
import type {
  PropSchema, ObjectMeta,
  PartSource, PartResidence, EnumeratedPart, PartMutation, PartSourceContext,
} from '@statdash/react/engine'
import { setAtPath } from '../inspector/showWhen'
import { toBarViews, setBarParams } from '../features/filters/filterSchemaModel'

// ══ The residence-keyed Part port registry (Service-Locator over residences) ══════
//
//  Generalizes BE-4's `registerBandSource` (keyed by source-id) to the ONE port:
//  keyed by RESIDENCE ('slot'|'value'|'sourced' — a closed set), NEVER by a concrete
//  node type. A type-keyed registration is the exact per-kind bridge ADR-041 refuses
//  (FF-NO-EXTERNAL-SPECIAL-CASE §0.5b). A new element reusing an existing residence
//  needs NO registration change (OCP); a genuinely new residence adds ONE adapter.
//
const _partSources = new Map<PartResidence, PartSource>()

/** Register a Part-port adapter under its residence (idempotent last-write-wins). */
export function registerPartSource(residence: PartResidence, source: PartSource): void {
  _partSources.set(residence, source)
}

/** Resolve the adapter registered for a residence (absent ⇒ undefined). */
export function getPartSource(residence: PartResidence): PartSource | undefined {
  return _partSources.get(residence)
}

/**
 * Enumerate EVERY selectable part of an element through the ONE port: read its
 * declared `PartField`s (`partFieldsOf`, residence-at-field) and route each to the
 * adapter registered for its residence. The single enumeration mechanism BE-1 / BE-4
 * / BE-5 all flow through now — no residence-specific container is reached directly.
 * `nodeId` stamps each part's address (the owning node); each part carries its own
 * residence-tagged contract + live subject.
 */
export function enumerateParts(
  container: Record<string, unknown>,
  meta:      ObjectMeta | undefined,
  ctx:       PartSourceContext,
  nodeId?:   string,
): EnumeratedPart[] {
  if (!meta) return []
  const out: EnumeratedPart[] = []
  for (const part of partFieldsOf(meta)) {
    const src = _partSources.get(part.residence)
    if (!src) continue
    for (const p of src.enumerateParts(container, part, ctx)) {
      out.push(nodeId != null ? { ...p, address: { ...p.address, nodeId } } : p)
    }
  }
  return out
}

// ── sourcedParts — the page-owned, discriminated filter band (BE-4, PartSource) ───
//
//  Enumerated via the shipped `toBarViews` projection over the page `filterSchema`
//  (scoped to the node's `barIds`, or all bars when absent). Each control's authoring
//  schema is resolved through the engine `getParamSchema(param.type)` — DISCRIMINATED,
//  derived from the ONE ParamDef declaration (the SAME registry the runner reads).
//  The write funnels through `setBarParams` (the SSOT reducer) — no denormalised copy
//  on the node. Addressed by the STABLE control key (Delta 1): `partPath` =
//  `${barId}.${key}`, resolved by key (never by a renumbering position) on write.

/** One resolved filter control — the shared reading both projections consume. */
interface FilterControlRow {
  barId:    string
  index:    number
  key:      string
  param:    ParamNode
  contract: PropSchema
}

/** Project the page `filterSchema` (scoped to the node's `barIds`) to ordered rows —
 *  the ONE reading the port adapter (stable) and the facade (positional) share. */
function readFilterControls(
  container: Record<string, unknown>,
  ctx:       PartSourceContext,
): FilterControlRow[] {
  const schema = ctx.filterSchema
  if (!schema) return []
  const barIds = Array.isArray(container.barIds) ? (container.barIds as string[]) : undefined
  const out: FilterControlRow[] = []
  for (const view of toBarViews(schema)) {
    if (barIds && !barIds.includes(view.id)) continue
    view.params.forEach((param, index) => {
      out.push({ barId: view.id, index, key: param.key, param, contract: getParamSchema(param.type) ?? [] })
    })
  }
  return out
}

export const sourcedParts: PartSource = {
  residence: 'sourced',
  enumerateParts(element, part, ctx): EnumeratedPart[] {
    return readFilterControls(element, ctx).map((r) => ({
      // STABLE-KEY address (ADR-041 Delta 1): keyed by the control's SSOT key, NOT
      // its position — a reorder never renumbers a live selection.
      address:    { nodeId: (element.id as string) ?? '', partPath: `${r.barId}.${r.key}` },
      contract:   r.contract,
      subject:    r.param as unknown as Record<string, unknown>,
      residence:  part.residence,
      field:      r.barId,   // anchor coordinate (barId, position) — matches FilterBarShell
      index:      r.index,
      key:        r.key,
      itemLabel:  'label',
      itemGroups: [],
    }))
  },
  writePart(_element, address, subfield, value, ctx): PartMutation | null {
    const schema = ctx.filterSchema
    if (!schema || !address.partPath) return null
    const dot = address.partPath.indexOf('.')
    if (dot < 0) return null
    const barId = address.partPath.slice(0, dot)
    const key   = address.partPath.slice(dot + 1)
    const view  = toBarViews(schema).find((v) => v.id === barId)
    if (!view) return null
    const idx = view.params.findIndex((p) => p.key === key)   // resolve by STABLE key
    if (idx < 0) return null
    const nextParams: ParamNode[] = view.params.map((p, i) =>
      i === idx ? (setAtPath(p, subfield, value) as ParamNode) : p,
    )
    return { target: 'filter-schema', schema: setBarParams(schema, barId, nextParams) }
  },
}

// The three residences, registered under the ONE port at module load (side-effect,
// as BE-4's `registerBandSource` was). Engine adapters + the app-owned sourced one.
registerPartSource('value',   valueParts)
registerPartSource('slot',    slotParts)
registerPartSource('sourced', sourcedParts)
