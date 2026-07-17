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
  `page.meta.filterSchema` onto the rendered `nodeConfig` ROOT, and `NodePageRenderer` reads
  `page.filterSchema` → `useFilterState` → `FiltersProvider` → the filter-bar renders real
  controls. So NO new CanvasView/StudioShell prop is needed, and overlay enumeration can
  never drift from what the renderer laid out (same object).
- Anchor coordinate for a filter item = `(field=bar.id, index=position-in-bar.items)`;
  `FilterBarShell` wraps each `<slice.Shell>` in `BandItemBoundary`. `bar.id` === the
  filterSchema bar key; `bar.items` order === `toBarViews` params order (both = Record
  insertion order) — so overlay index maps to the right ParamDef even when a hidden/
  perspective-gated control is skipped from render (no anchor ⇒ overlay skips, no crash).
- `filterSchemaBandSource` `itemObject` is the **ParamNode** (carries `key`, added by
  `toBarViews`→`toParamNode`) — that IS what the Inspector edits; `itemSchema` (getParamSchema)
  has no `key` field so it's never edited. Path grammar `${barId}.${index}` (dot-path).

**How to apply:** a NEW externally-sourced band = one META `band` descriptor + one registered
BandSource adapter; selection/overlay/inspector machinery unchanged (OCP). See architect's
[[bounded-element-bands]]. Runtime output stays byte-identical: BandItemBoundary is a zero-DOM
Fragment off the authoring canvas.

---

**ADR-041 Phase 2 (Part port re-home, done) — BE-1/BE-4/BE-5 collapse to ONE mechanism.**
The `BandSource` port generalized to the engine **Part port** (`enumerateParts`/`writePart`,
adapters keyed by RESIDENCE `'slot'|'value'|'sourced'`, never by type). Three residence
adapters: `valueParts`+`slotParts` (engine `packages/react/src/engine/partSources.ts`, PURE,
app-agnostic) + `sourcedParts` (app `bandSource.ts`, touches the filterSchema SSOT so stays
app-side). Registry `registerPartSource(residence, source)` + aggregate `enumerateParts(container,
meta, ctx, nodeId?)` live in `apps/panel/src/canvas/bandSource.ts`. `bandItemsOf`/`bandFieldsOf`/
`BandItemRef` MOVED to engine (`packages/react/src/engine/bandItems.ts`); app `bandItems.ts` is a
thin re-export. Controller resolves `selectedBand`/`patchItemProp` through the port.

**Two non-obvious reconciliations (cost double if re-derived):**
1. **Delta-1 stable-key vs positional facade.** `sourcedParts` emits Delta-1 STABLE-KEY addresses
   (`partPath = ${barId}.${controlKey}`, `EnumeratedPart.key` = control key; write resolves by key
   not position). But CanvasOverlay + FF-FILTER-ITEMS-DECLARED-BAND + `filterItemSelect.e2e`
   (`[data-item-path="main.0"]`) still need the POSITIONAL address. So a TRANSITIONAL `BandSource`
   facade (`getBandSource`/`propsBandSource`/`filterSchemaBandSource`, positional `${field}.${index}`)
   is KEPT alongside the port — ONE reading (`readFilterControls`/`bandItemsOf`), two projections.
   The controller bridges: matches `selectedItemPath` POSITIONALLY (`${p.field}.${p.index}`), writes
   via the found part's STABLE `address`. **Phase 3/4 remove the facade** when overlay + selection
   collapse onto the port's stable address (that's what EnumeratedPart.key was built for).
**ADR-041 Phase 3 (selection-triple → ONE address, DONE) — facade DELETED.** The old
selection triple (`selectedNodeId`/`selectedItemPath`/`chromeSelection`) collapsed to ONE
session field `selection: SelectionAddress` (`constructor.history.ts`), where
`SelectionAddress = PartAddress | ChromeSelection` — node/item is the engine `PartAddress`
`(nodeId, partPath?)`; chrome is a DISCRIMINATED arm (`kind:'chrome'`; a PartAddress never
carries `kind`) because chrome is not yet a page-node part (ROM R4 deferred — a stringly
`(nodeId,partPath)` cram for chrome was rejected as fragile). ONE `select(address)` +
ergonomic wrappers `selectNode`/`selectItem`/`selectChrome` (all funnel to `selection`, so a
new selection clears the prior by construction). The triple is now DERIVED via pure helpers
`selectedNodeIdOf`/`selectedItemPathOf`/`chromeSelectionOf` (`constructor.selectors.ts`, also
the non-hook path tests use over `getState().selection`); `useSelectedNode`/`-ItemPath`/
`useChromeSelection` project them (byte-identical, referentially stable). Locked by
`FF-ONE-SELECTION-ADDRESS` (`store/oneSelectionAddress.fitness.test.ts` — asserts the three
legacy fields are NOT independent state via `'selectedNodeId' in state === false`).
The TRANSITIONAL positional `BandSource` facade (`getBandSource`/`propsBandSource`/
`filterSchemaBandSource`) is **DELETED** from `bandSource.ts`; CanvasOverlay + controller +
both e2e now resolve through the port's `enumerateParts`/`getPartSource(residence)` on the ONE
stable-key `PartAddress.partPath`. Overlay `data-item-path` = `part.address.partPath` (value =
positional `items.0`, byte-identical; sourced = STABLE `${barId}.${key}` e.g. `main.beta`);
`filterItemSelect.e2e` selectors moved `main.1`→`main.beta`. Controller `selectedBand` matches
by `p.address.partPath === selectedItemPath` (no positional re-derivation). Overlay still finds
the DOM anchor by `(field,index)` — the BandItemBoundary stamping stays positional until the
Phase-4 anchor merge. `FF-FILTER-ITEMS-DECLARED-BAND` rewritten onto the port + stable key.
App-only change (no dist). **Phase 4 (anchor merge → ONE PartAnchor) is next.**

2. **Residence-literal ratchet (engine).** `FF-ONE-PART-GRAMMAR` RATCHET (engine
   `object-model.fitness.test.ts`) scans EVERY engine file for `/residence:\s*['"](slot|value|
   sourced)['"]/` and allowlists ONLY `slice-meta.ts` (BASELINE=1, can only shrink). So engine
   Part adapters must NOT write `residence: 'value'` — declare the `PartSource.residence`
   discriminant via a typed const (`const R_VALUE: PartResidence = 'value'`; `residence: R_VALUE`)
   and carry per-part residence off `part.residence`. App files are NOT scanned by this ratchet
   (sourcedParts uses `residence: 'sourced'` directly — fine).
