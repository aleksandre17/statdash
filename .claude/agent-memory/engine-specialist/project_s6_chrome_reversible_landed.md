---
name: project-s6-chrome-reversible-landed
description: S6 chrome-as-Part COMPLETE — reversible EXPAND (site-frame sourced band) + the one-way FOLD (selection arm 2→1, S4 bridge + ChromePalette retired) both landed green
metadata:
  type: project
---

# S6 chrome unification — EXPAND + FOLD both landed green (2026-07-12)

**THE ONE-WAY FOLD LANDED (gate-green corpus-wide, NOT committed, on 3524b73):**
- Selection **arm 2→1**: `SelectionAddress = PartAddress` (the `ChromeSelection` `{kind:'chrome'}` arm + `isChromeSelection`/`chromeSelectionOf`/`useChromeSelection` retired). Chrome selection is now `{nodeId: SITE_FRAME_ID, partPath: 'chrome.<slot>'}` — a part like any other.
- **Address SSOT** = engine `siteFrame.ts` `chromePartPath(slot)`/`chromeSlotOfPartPath(pp)` (+ `CHROME_PART_PREFIX`), barrel-exported; the store's `selectChrome(slot)` wrapper and the `chromeParts` adapter both build/parse through it (can't drift). `selectChrome({kind,slot,key})` → `selectChrome(slot: string|null)`; NO seed-on-select (updateChromeConfigPatch seeds default on first EDIT).
- **S4 bridge retired**: `CHROME_SLOT_ATTR`/`CHROME_KEY_ATTR` deleted (partAnchor + barrel); `ChromeSlot` now stamps the ONE `<PartAnchor field={slot} index={0}>` always (PartAnchor is inert off-canvas — dropped the `authoring` guard). `CanvasOverlay` enumerates the site-frame's chrome parts through the port (needs `chrome` prop = site.chrome map, normalized ChromeEntry→ChromeSlotConfig), queries `rootEl` per-slot for the PartAnchor, dispatches the ONE `onSelectItem(SITE_FRAME_ID, chrome.<slot>)` (onSelectChrome/selectedChrome props deleted).
- **Dock fold**: `useCanvasController.selectedBand` resolves the owning element GENERICALLY — a page node (`page.nodes[id]`) OR the site-frame (`selectedId === SITE_FRAME_ID`, never in page.nodes); SelectedPart gained `ownerId`/`ownerLabel`/`ownerSelectable`/`crumbTitle`. `patchItemProp` routes `target:'site-chrome'` → `updateChromeConfig` (no page `selected` needed). `element.chrome` dock section + `ChromeInspectorPanel` + `ChromePalette` + `chromeSchemaSource` all DELETED — chrome folds into the generic `element.schema` `selectedBand` branch (reordered so the part branch runs before the `if(!selected)` guard). RightDock scope = `(selected || selectedBand)`.
- Gate NUMBERS: lint 0 err · tsc -b --force root 0 · named+affected 9 files/70 ✓ · react-ratchets 33 ✓ · plugins-ratchets+compositionSelKey 14 ✓ · api crossFilterLinkage 15 ✓ · react-full 556 ✓ · panel-full 845 ✓ · plugins-full 572 ✓ · dist rebuild 0 · **e2e chromeNavAuthoring GREEN** (migrated to canvas-select→contextual-dock).
- **Gotcha for future**: the e2e's `KpiStripControl` console.error (`.map` of undefined in structural preview) is PRE-EXISTING fail-soft (caught by NodeErrorBoundary, not an uncaught pageerror) — NOT a regression, does not fail the test.

# S6 chrome unification — the reversible EXPAND landed (2026-07-12)

Chrome = a `sourced` Part of a synthetic SITE-FRAME element (ADR-041 R4). Built the
architect's design (`[[project-s6-chrome-unification]]` is the architect's spec). Chrome
residence is `sourced` NOT slot — a keyed projection of the `site.chrome` SSOT, byte-for-
byte the filter-control pattern.

**LANDED (reversible, gate-green, NOT committed):**
- `packages/react/src/engine/siteFrame.ts` — `SITE_FRAME_ID='site-frame'` + `SITE_FRAME_META={band:{source:'site-chrome'}}`; `partFieldsOf` emits ONE sourced field, ZERO engine change. Barrel-exported (Class-M public API; 09B done — all additive).
- `partPort.ts` — additive: `PartSourceContext.chrome?` (the site chrome SSOT a sourced part projects), `PartMutation | {target:'site-chrome',slot,field,value}`, `EnumeratedPart.source?` (the sourced adapter id, Delta 1, re-resolved on write).
- **Registry-by-source (the collision fix):** `apps/panel/src/canvas/bandSource.ts` — the MULTI-consumer `sourced` residence now resolves by SOURCE id (two maps: `_residenceSources` for value/slot, `_sourcedSources` for 'page-filters'/'site-chrome'). New `registerSourcedPartSource(sourceId, adapter)` (a distinct fn — the §0.5b fence only scans `registerPartSource(`, so a source-keyed reg is NOT flagged). `getPartSource(residence, source?)`. Filters BYTE-IDENTICAL.
- `chromeParts` adapter (bandSource.ts) — projects `chromeRegistry.list() × ctx.chrome` (only schema-bearing/authorable), address `{nodeId:SITE_FRAME_ID, partPath:'chrome.<slot>'}`, contract = registry schema, subject = `site.chrome[slot].config`, anchor coord (field=slot, index=0), write = `site-chrome` mutation.
- Gate: `chromePartsBand.fitness` (new, proves the mechanism), `filterItemsDeclaredBand`/`useCanvasController` migrated to `getPartSource('sourced','page-filters')`. tsc -b --force root =0, lint=0, panel canvas/studio/store/inspector 570✓, react engine 501✓, perf/object-model/compositionSelKey/crossFilterLinkage/canvasChromeFaithful/canvasChromeSelectable/oneSelectionAddress all ✓. react dist build ✓ (exports in .d.ts).

**HALTED — the one-way fold (items 4-5):** overlay/dock/selection wiring + ChromeSelection-arm collapse + ChromePalette retire + e2e migration. **Finding: item 4 (retire `onSelectChrome`/`selectedChrome`/`ChromeFrame`) is ENTANGLED with item 5 (collapse the `ChromeSelection` union arm) — they cannot land green independently.** The moment chrome selection flips off the arm onto a `PartAddress`, EVERY consumer must move at once (ChromeInspectorPanel, ChromePalette, useCanvasController.chromeSel, StudioShell.selectedChrome, the dock, `chromeNavAuthoring.e2e` which drives ChromePalette→chrome-inspector). So the "do 1-4, halt 5" fallback isn't cleanly separable as the brief's item numbering implies — the meaningful item-4 deletions belong WITH item 5 as ONE ~20-file one-way commit. Chrome-on-canvas behaviour is UNCHANGED (still S4 bridge `data-canvas-chrome-slot` + `selectChrome({kind})` arm). `chromeParts` is registered + unit-proven but not yet consumed by the live overlay (Strangler EXPAND, exactly as partPort Phase 1 shipped types with no adapters).

**Dock-fold gotcha for whoever wires item 5:** the site-frame is NOT a page-tree node, so `page.nodes[SITE_FRAME_ID]` is undefined — `useCanvasController.selectedBand` must resolve the owning element generically (page node OR site-frame) and `patchItemProp` must route the `site-chrome` mutation to `updateChromeConfig` WITHOUT requiring a page `selected`. The ChromeSlot anchor must stamp `<PartAnchor field={slot} index={0}>` (key by slot — ChromeSlot can't know a global ordinal), and the overlay frames chrome by querying `rootEl` directly (chrome anchors live in the rail, outside any node anchor).
