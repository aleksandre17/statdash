// ── partPort — ROOT-3 The Part Port (ADR-041 · Phase 1 LIVE, types + contract) ──
//
//  ADR-041 Phase 1: the ROOT-3 port TYPES + CONTRACT, promoted LIVE. This file
//  declares the port interface (`PartField`, residences, `PartAddress`,
//  `EnumeratedPart`, `PartMutation`, `PartSource`) — exported through the engine
//  barrel and read by the unified `partFieldsOf` derivation in `slice-meta.ts`.
//  It carries NO adapters yet (`slotParts`/`valueParts`/`sourcedParts` land in
//  Phase 2, keyed by RESIDENCE never by type); the port is the interface plus the
//  pure reading. Additive + reversible: delete this file body + the `partFieldsOf`
//  block + the barrel line to revert — no config, no stored data, no store action
//  touched. See `docs/architecture/decisions/ADR-041-part-grammar-and-part-port.md`.
//
//  THE ROOT (diagnosis §5 · SPEC-object-model-foundation-diagnosis.md):
//  the platform never laid down, as a first-class primitive, the relation
//  "this element HAS CONSTITUENT PARTS." Absent it, containment grew FOUR parallel
//  grammars (tree slots · props value-bands · sourced bands · chrome regions), each
//  with its own enumeration, address, write path, validation, and anchor. ROOT-3 is
//  the ONE port every authoring / validation / lineage mechanism recurses over — the
//  generalization of BE-4's app-level `BandSource` to "ALL parts, engine-level."
//
//  ONE grammar, N residences (ROOT-2). `SlotDef`, `PropField`+`itemSchema` value
//  bands, and `BandDescriptor` are three SURFACE FORMS of the ONE `PartField` below.
//  The surface names stay (alias/re-export discipline, R1-proven) — this is the
//  unified reading they all project into.
//
import type { PropSchema, LocaleString, FilterSchemaInput, PropertyGroup } from '@statdash/engine'

// ── PartResidence — WHERE an element's parts live (closed set, extensible) ───────
//
//  Residence is a property of the FIELD (Puck's law), never of the node. The three
//  residences below are today's four fragments unified (chrome regions fold in later
//  as a `slot`/`sourced` adapter of a `site-frame` element — ROM R4, still deferred).
//
//    'slot'    — parts are node instances of registered types (accepts-gated).
//                Today's fragment: `SlotDef` (already carries `field:`).
//    'value'   — parts are typed values on `node.props` (per-part contract =
//                `itemSchema`, homogeneous). Today's fragment: `array + itemSchema`.
//    'sourced' — parts are projections of an EXTERNAL SSOT (per-part contract
//                resolved by the adapter, e.g. `getParamSchema(type)` — discriminated).
//                Today's fragment: `META.band` (BandDescriptor) + BE-4 `BandSource`.
//
export type PartResidence = 'slot' | 'value' | 'sourced'

// ── PartField — ROOT-2: an element's contract declares its PARTS as fields ───────
//
//  ONE part-field concept; `SlotDef` / value-`PropField` / `BandDescriptor` are its
//  three surface forms. Wrapper/leaf becomes a DERIVED predicate of the contract:
//  WRAPPER ⇔ the element declares ≥1 PartField; LEAF ⇔ it declares none. No
//  mechanism reads the KIND (`sliceType`, `canHaveChildren`) to answer a containment
//  question (FF-DERIVED-CONTAINMENT).
//
export interface PartField {
  /**
   * The declaring-field ADDRESS handle on the owning element — the coordinate the
   * ONE `PartAddress` grammar builds `partPath` from. Consistent across residences:
   *   • `slot`    → the slot field name (`'children'`); the part IS the child node.
   *   • `value`   → the value-band field (`'items'`); parts addressed `${field}.${index}`.
   *   • `sourced` → the declaring-field handle of the sourced band. While the band is
   *     node-level (Phases 1–5, ONE band per node) this handle COINCIDES with `source`
   *     (the adapter id, e.g. `'page-filters'`); at Phase 6 the band moves onto a real
   *     field and `field` gets its own name while `source` keeps pointing at the same
   *     adapter — a rename behind the same grammar slot, so `PartAddress` stays stable.
   *   ADR-041 Delta 1 (the sourced address convention): `field` is the ADDRESS
   *   coordinate; `source` is the ADAPTER id. They may be equal today; they DIVERGE at
   *   Phase 6. `field` stays REQUIRED so every PartField carries an address coordinate
   *   (one grammar — no optional-field special case for the sourced residence).
   */
  field:      string
  /** WHERE this field's parts reside — declared on the FIELD, never the node (FF-RESIDENCE-AT-FIELD). */
  residence:  PartResidence
  label?:     LocaleString
  /** slot residence: the registered node types this field accepts (drop-gate; empty ⇒ any). */
  accepts?:   string[]
  /** value/sourced residence: the per-part contract when homogeneous (a `PropField.itemSchema`). */
  itemSchema?: PropSchema
  /** value residence: the item's declared property grouping (accordion sections), if any. */
  itemGroups?: PropertyGroup[]
  /** value residence: dot-path to the item's label field for the dock crumb, if declared. */
  itemLabel?: string
  /** sourced residence: the id of the registered PartSource adapter that resides/reads/writes. */
  source?:    string
  multi?:     boolean
  min?:       number
  max?:       number
}

// ── PartAddress — ROOT-3: ONE address grammar (completes ADR-039's Composite address) ──
//
//  The selection triple (`selectedNodeId` · `selectedItemPath` · `chromeSelection`)
//  collapses to this ONE type. A whole-node selection is `partPath === undefined`
//  (backward-compatible with today's `selectedItemPath === null`). A slot part is
//  reached THROUGH the enumeration as the child's own nodeId; a value/sourced part
//  by its `${field}.${index}` path.
//
export interface PartAddress {
  nodeId:    string
  partPath?: string
}

// ── EnumeratedPart — one selectable part, residence-tagged, contract-carrying ─────
//
//  Every part enumerated through the port carries its OWN declared contract and its
//  live subject — so selection / overlay / inspector / validation / lineage are pure
//  projections that never reach into a residence-specific container.
//
export interface EnumeratedPart {
  address:   PartAddress
  /** The part's OWN declared contract (its `itemSchema`, or `getParamSchema(type)` for sourced). */
  contract:  PropSchema
  /** The part's live value object — the bounded subject the Inspector edits. */
  subject:   Record<string, unknown>
  residence: PartResidence
  /** Anchor coordinate — the `(field, index)` the ONE part-anchor stamps and the overlay queries. */
  field:     string
  index:     number
  /**
   * The STABLE per-part address coordinate for a KEYED residence (ADR-041 Delta 1).
   * A `sourced` part (a filter `barId` / control key) is keyed by its stable external-
   * SSOT id, NOT by position — so reorder/insert in the page `filterSchema` never
   * renumbers a live selection. The ONE `PartAddress.partPath` of a keyed part is
   * `${field}.${key}`; `value`/`slot` parts leave `key` undefined and address
   * positionally by `index` (value) or by the child's own `nodeId` (slot). This is the
   * single coordinate Phase 3's selection-triple collapses onto for a filter control.
   */
  key?:      string
  /** Dot-path to the label field for the dock crumb, if declared. */
  itemLabel?: string
  /** The part's declared property grouping (accordion sections) — value residence, or []. */
  itemGroups?: PropertyGroup[]
}

// ── PartMutation — the residence-tagged write (BandMutation, KEPT verbatim) ───────
//
//  The host applies each mutation through the matching store action — `node-props`
//  via `updateNode`, `filter-schema` via `updatePage({ meta.filterSchema })`, and
//  (slot residence, later phase) `node-children` via the tree reducer. Tagged by
//  RESIDENCE — a small, closed architectural set — never by node type, so a new
//  source reusing an existing residence needs no host change (OCP).
//
export type PartMutation =
  | { target: 'node-props';    props:    Record<string, unknown> }
  | { target: 'filter-schema'; schema:   FilterSchemaInput }
  | { target: 'node-children'; children: unknown[] }   // slot residence — lands with slotParts

// ── PartSource — ROOT-3: the ONE port every mechanism recurses over ──────────────
//
//  The generalization of BE-4's `BandSource` from "value bands, app-level" to "ALL
//  parts, engine-level." Adapters (not bridges): `slotParts` (walks `children` by the
//  declared slot) · `valueParts` (= BE-1 `bandItemsOf`) · `sourcedParts` (= BE-4
//  `filterSchemaBandSource`, staying app-level where it touches an app SSOT — the
//  PORT is engine, the adapter lives with its residence). BE-1 / BE-4 / BE-5 fall out
//  as ONE mechanism; the NEXT kinds (hero cards, table columns, repeat instances,
//  chrome items) are declarations only — no new bridge (FF-ONE-PART-GRAMMAR).
//
export interface PartSource {
  readonly residence: PartResidence
  /** List the selectable parts of `element` for one declared PartField. */
  enumerateParts(
    element: Record<string, unknown>,
    part:    PartField,
    ctx:     PartSourceContext,
  ): EnumeratedPart[]
  /** Commit ONE subfield edit of the part at `address`, as a residence-tagged mutation. */
  writePart(
    element:  Record<string, unknown>,
    address:  PartAddress,
    subfield: string,
    value:    unknown,
    ctx:      PartSourceContext,
  ): PartMutation | null
}

// ── PartSourceContext — the external SSOT a sourced part projects (page-owned) ────
export interface PartSourceContext {
  /** The active page's filter schema (SSOT a `sourced` filter part projects). */
  filterSchema?: FilterSchemaInput
}
