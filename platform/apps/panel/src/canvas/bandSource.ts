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
  valueParts, slotParts, partFieldsOf, chromeRegistry, SITE_FRAME_ID,
  chromePartPath, chromeSlotOfPartPath,
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
//  the POSITIONAL residences ('slot'|'value' — a closed set) key ONE adapter each,
//  NEVER a concrete node type. A type-keyed registration is the exact per-kind bridge
//  ADR-041 refuses (FF-NO-EXTERNAL-SPECIAL-CASE §0.5b).
//
//  ── The `sourced` residence is MULTI-consumer (S6 · Delta 1) ────────────────────
//  `sourced` parts are projections of an EXTERNAL SSOT, and there is now MORE THAN ONE
//  such SSOT: `'page-filters'` (the page filterSchema) and `'site-chrome'` (the site
//  chrome map). ONE `sourced` slot in a residence-keyed map would COLLIDE. So `sourced`
//  adapters are keyed by their SOURCE id (`PartField.source` — ADR-041 Delta 1: "source
//  is the ADAPTER id"), NOT by the residence. This is declaration-driven, not a per-TYPE
//  branch: the filter-bar and the site-frame each DECLARE their source (`band.source`);
//  the port resolves the adapter the declaration names. Registering by a stable external-
//  SSOT id is categorically different from keying a Part source by a concrete node TYPE —
//  the §0.5b fence still bites a type-keyed `registerPartSource` (it scans that call).
//
const _residenceSources = new Map<PartResidence, PartSource>()   // 'slot' · 'value'
const _sourcedSources   = new Map<string, PartSource>()          // 'page-filters' · 'site-chrome'

/** Register a POSITIONAL-residence Part adapter ('slot'|'value'); idempotent last-write-wins. */
export function registerPartSource(residence: PartResidence, source: PartSource): void {
  _residenceSources.set(residence, source)
}

/**
 * Register a `sourced` Part adapter under its SOURCE id (the external-SSOT adapter id,
 * ADR-041 Delta 1). A source id is NOT a node type — it names the SSOT projected, so a
 * new sourced consumer (filters · chrome · …) is one registration, the port unchanged.
 */
export function registerSourcedPartSource(sourceId: string, source: PartSource): void {
  _sourcedSources.set(sourceId, source)
}

/**
 * Resolve the adapter for a residence. A `sourced` residence is MULTI-consumer, so it
 * resolves by the SOURCE id (`getPartSource('sourced', 'page-filters')`); a positional
 * residence ('slot'|'value') ignores `source`. Absent ⇒ undefined.
 */
export function getPartSource(residence: PartResidence, source?: string): PartSource | undefined {
  if (residence === 'sourced') return source != null ? _sourcedSources.get(source) : undefined
  return _residenceSources.get(residence)
}

/**
 * Enumerate EVERY selectable part of an element through the ONE port: read its
 * declared `PartField`s (`partFieldsOf`, residence-at-field) and route each to the
 * adapter for its residence — a `sourced` field by its `source` id (multi-consumer),
 * a positional field by its residence. The single enumeration mechanism BE-1 / BE-4
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
    const src = part.residence === 'sourced'
      ? _sourcedSources.get(part.source ?? '')
      : _residenceSources.get(part.residence)
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
      source:     part.source,   // 'page-filters' — the adapter id the host re-resolves on write
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

// ── chromeParts — the site-owned chrome band (S6 · sourced source='site-chrome') ──
//
//  The SECOND `sourced` consumer (after `sourcedParts`/filters): the SITE-FRAME element
//  (`SITE_FRAME_META`, `band:{source:'site-chrome'}`) declares its chrome regions as a
//  sourced band. This adapter projects `ctx.chrome × chromeRegistry` — structurally the
//  filter pattern: a keyed projection of an EXTERNAL SSOT (`site.chrome`), each part's
//  contract resolved by the adapter (`chromeRegistry.getMeta(slot,key).schema`, mirroring
//  `getParamSchema`), addressed by a STABLE key (the slot name, Delta 1). Only AUTHORABLE
//  regions (schema-bearing) enumerate — the SAME gate `ChromePalette`/the overlay apply —
//  so a chrome region without a config schema is never a dead selection. The write funnels
//  through the `site-chrome` mutation → the host's `updateChromeConfig` (the site SSOT
//  reducer), NO denormalised copy on any node.
//
//  Enumerates over EVERY registered chrome slot (`chromeRegistry.list()`), resolving each
//  slot's variant from `ctx.chrome[slot]?.variant ?? 'default'` (the ChromeSlot resolution
//  chain, canvas has no page override), so a slot rendered on its default variant is still
//  selectable; the overlay's anchor-presence guard filters to the ones actually rendered.

export const chromeParts: PartSource = {
  residence: 'sourced',
  enumerateParts(_element, part, ctx): EnumeratedPart[] {
    const chrome = ctx.chrome ?? {}
    const out: EnumeratedPart[] = []
    for (const slot of chromeRegistry.list()) {
      const key    = chrome[slot]?.variant ?? 'default'
      const meta   = chromeRegistry.getMeta(slot, key)
      const schema = meta?.schema
      if (!schema || schema.length === 0) continue   // only AUTHORABLE regions — never a dead selection
      out.push({
        // STABLE-KEY address (ADR-041 Delta 1): keyed by the slot name (the chrome SSOT
        // key), NOT a position — a chrome reorder never renumbers a live selection. The
        // `chrome.<slot>` grammar is the engine SSOT (`chromePartPath`), shared with the
        // store's `selectChrome` so enumerate and select can never drift.
        address:    { nodeId: SITE_FRAME_ID, partPath: chromePartPath(slot) },
        contract:   schema,
        subject:    (chrome[slot]?.config ?? {}) as Record<string, unknown>,
        residence:  part.residence,
        source:     part.source,   // 'site-chrome' — the adapter id the host re-resolves on write
        field:      slot,          // anchor coordinate — matches the ChromeSlot PartAnchor `field`
        index:      0,             // one region per slot (no positional band within a slot)
        key:        slot,
        itemGroups: [],
      })
    }
    return out
  },
  writePart(_element, address, subfield, value, _ctx): PartMutation | null {
    // partPath is `chrome.<slot>` — the slot is parsed through the engine SSOT
    // (`chromeSlotOfPartPath`), which is strict on the `chrome.` prefix so a non-chrome
    // address never mis-writes. A pathless / non-chrome address resolves to null.
    const slot = chromeSlotOfPartPath(address.partPath)
    if (!slot) return null
    // A residence-tagged mutation the host commits at its true home (`updateChromeConfig`)
    // — the site SSOT, NO denormalised copy on any node (mirrors the filter-schema write).
    return { target: 'site-chrome', slot, field: subfield, value }
  },
}

// The Part port adapters, registered at module load (side-effect, as BE-4's
// `registerBandSource` was). POSITIONAL residences ('value'/'slot') key one engine adapter
// each; the MULTI-consumer `sourced` residence keys its adapters by SOURCE id (Delta 1) —
// the app-owned filter band ('page-filters') and chrome band ('site-chrome').
registerPartSource('value', valueParts)
registerPartSource('slot',  slotParts)
registerSourcedPartSource('page-filters', sourcedParts)
registerSourcedPartSource('site-chrome',  chromeParts)
