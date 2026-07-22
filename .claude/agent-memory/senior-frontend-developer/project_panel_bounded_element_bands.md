---
name: panel-bounded-element-bands
description: The canvas band/part seam (ADR-038/039 BE-1/BE-4, then ADR-041 Part port) — where selection/overlay/inspector project value-band + filter-control parts, the non-obvious data-flow, test gotchas, and the Phase-2 port re-home reconciliation
metadata:
  type: project
---

The authoring canvas makes each declared value-band ITEM a selectable, bounded, authorable
element (ADR-038 Bounded Element Law, ADR-039 selection projection). Two band residences
share ONE machinery via a `BandSource` port (Strategy/DIP):

- **BE-1 props band** (kpi-strip `items[]`): values inline in `node.props`, ONE fixed
  `itemSchema`. Adapter `propsBandSource` (id `'node-props'`, the DEFAULT). Enumerate = the
  pre-existing `bandItemsOf` over the node's declared schema.
- **BE-4 filter band** (filter-bar controls): values live in the PAGE SSOT
  `page.meta.filterSchema.bars[barId].filters`, DISCRIMINATED by `ParamDef.type`. Adapter
  `filterSchemaBandSource` (id `'page-filters'`): enumerates via `toBarViews`, resolves each
  item schema via engine `getParamSchema(type)`, writes via `setBarParams` (NO node copy).

**The seam (files):** `apps/panel/src/canvas/bandSource.ts` (port + registry +
propsBandSource + filterSchemaBandSource; PURE — `write` returns a residence-tagged
`BandMutation` the host applies). A node DECLARES its residence in its registered META via
`band: { source }` (packages/react `BandDescriptor` on `ObjectMeta`; forwarded through
`registerSlice` → `NodeRegistry` `getMeta().band`). The canvas resolves
`getBandSource(meta.band?.source)` — never a `type === 'filter-bar'` branch (FF-NO-EXTERNAL-
SPECIAL-CASE, which now also scans `bandSource.ts`). New FF-FILTER-ITEMS-DECLARED-BAND locks
the filter band. Consumers: `CanvasOverlay` (source-routed enumerate → frames), controller
`selectedBand`/`patchItemProp` (source-routed), dock `element.schema` branch reads
`selectedBand.itemObject` (not `getAtPath(selected.props)`).

**Non-obvious data-flow (cost double if re-derived):**
- The overlay gets `filterSchema` OFF ITS EXISTING `page` prop — `toNodePageConfig` spreads
  `page.meta.filterSchema` onto the rendered `nodeConfig` ROOT, and `NodePageRenderer` reads it
  through the SAME `useFilterState`/`FiltersProvider` path the real filter-bar controls use — no
  new CanvasView/StudioShell prop is needed, and overlay enumeration can never drift from what the
  renderer laid out (same object).
- Anchor coordinate for a filter item = `(field=bar.id, index=position-in-bar.items)`; both key
  orderings derive from Record insertion order, so the overlay index maps to the right ParamDef
  even when a hidden/perspective-gated control is skipped from render (no anchor ⇒ overlay skips).
- `filterSchemaBandSource itemObject` is the **ParamNode** (carries `key`) — that IS what the
  Inspector edits; the bare `itemSchema` has no `key` field so it's never edited directly.

**How to apply:** a NEW externally-sourced band = one META `band` descriptor + one registered
BandSource adapter; selection/overlay/inspector machinery unchanged (OCP). Runtime output stays
byte-identical: BandItemBoundary is a zero-DOM Fragment off the authoring canvas.

---

**ADR-041 Phase 2+3 (CURRENT STATE) — BE-1/BE-4/BE-5 collapsed to ONE mechanism, positional
facade DELETED.** The `BandSource` port generalized to the engine **Part port**
(`enumerateParts`/`writePart`, adapters keyed by RESIDENCE `'slot'|'value'|'sourced'`, never by
type). Three residence adapters: `valueParts`+`slotParts` (engine
`packages/react/src/engine/partSources.ts`, pure, app-agnostic) + `sourcedParts` (app
`bandSource.ts`, touches the filterSchema SSOT so stays app-side). Registry
`registerPartSource(residence, source)` + aggregate `enumerateParts(container, meta, ctx, nodeId?)`
live in `apps/panel/src/canvas/bandSource.ts`. `bandItemsOf`/`bandFieldsOf`/`BandItemRef` moved to
engine (`packages/react/src/engine/bandItems.ts`); the app version is a thin re-export.

**Selection is now ONE address.** The old triple (`selectedNodeId`/`selectedItemPath`/
`chromeSelection`) collapsed to ONE session field `selection: SelectionAddress`
(`constructor.history.ts`), where `SelectionAddress = PartAddress | ChromeSelection` — node/item is
the engine `PartAddress (nodeId, partPath?)`; chrome is a DISCRIMINATED arm (`kind:'chrome'`;
a PartAddress never carries `kind`) because chrome is not yet a page-node part (a stringly cram was
rejected as fragile). ONE `select(address)` + ergonomic wrappers `selectNode`/`selectItem`/
`selectChrome` (all funnel to `selection`, so a new selection clears the prior by construction).
The triple is DERIVED via pure helpers (`constructor.selectors.ts`); `useSelectedNode`/
`-ItemPath`/`useChromeSelection` project them (byte-identical, referentially stable). Locked by
`FF-ONE-SELECTION-ADDRESS` (asserts the three legacy fields are NOT independent state).

**Addressing is now STABLE-KEY everywhere (the transitional positional `BandSource` facade —
`getBandSource`/`propsBandSource`/`filterSchemaBandSource` — is DELETED).** CanvasOverlay +
controller + e2e resolve through the port's `enumerateParts`/`getPartSource(residence)` on the ONE
stable-key `PartAddress.partPath`. Overlay `data-item-path` = `part.address.partPath` (value =
positional `items.0`, byte-identical; sourced = STABLE `${barId}.${key}`, e.g. `main.beta`, not a
position — `filterItemSelect.e2e` selectors reflect this). Controller `selectedBand` matches by
`p.address.partPath === selectedItemPath` (no positional re-derivation). Overlay still finds the
DOM anchor by `(field,index)` — the BandItemBoundary stamping itself stays positional until a
future anchor-merge unifies it onto `PartAddress` too.

**Residence-literal ratchet (engine):** `FF-ONE-PART-GRAMMAR` scans every engine file for a raw
`residence:'slot'|'value'|'sourced'` string literal and allowlists ONLY `slice-meta.ts`
(baseline=1, can only shrink) — engine Part adapters must declare the `PartSource.residence`
discriminant via a typed const (`const R_VALUE:PartResidence='value'; residence:R_VALUE`), never
the raw string. App files are NOT scanned (sourcedParts uses the raw string directly — fine).
