---
name: project-s6-chrome-unification
description: S6 chrome-as-part fold (ADR-041 R4) — chrome residence is `sourced` NOT `slot`; why, and the seam inventory
metadata:
  type: project
---

# S6 — chrome unification (ADR-041 R4 / SPEC-studio-ia-canonical S6)

Fold chrome from a separate selection species (`chromeSel`/`ChromeSelection` arm + S4 `data-canvas-chrome-slot` interim bridge) into the ONE Part port: a `site-frame` element declares its chrome regions as PartFields, enumerated/selected/authored through the SAME `enumerateParts`/`PartAddress` path as everything else.

**The load-bearing decision — chrome residence is `sourced`, NOT `slot` (the S6 brief said slot; slot is a category error).**
Why: chrome data lives in `site.chrome[slot] = {variant,config}` — a site-level keyed map; chrome shells live in a SEPARATE `chromeRegistry` (keyed `slot::key`), not `nodeRegistry`. That is structurally IDENTICAL to filter controls (`sourced`): a keyed projection of an external SSOT, per-part contract resolved by an adapter (`chromeRegistry.getMeta(slot,key).schema`, mirroring `getParamSchema`), addressed by a STABLE key (the slot name), written via `updateChromeConfig`. `slot` residence means "child NODE instances in `element[field]`, node-children reducer" — forcing chrome into it needs config migration (violates ADR-041 hard-invariant #1 "zero config migration") OR a fake slot adapter reading site.chrome (the residence-keyed registry allows ONE slot adapter = `slotParts`, so impossible). ADR-041 line 34 + partPort.ts say "slot/**sourced** adapter" — the ADR left it open; sourced is correct.
**Why:** the chrome SSOT (`site.chrome`) + separate `chromeRegistry` make it a keyed-external-projection = `sourced`, byte-for-byte the filter-control pattern.
**How to apply:** if S6 resumes, build chrome as the SECOND `sourced` consumer, not a slot part, not a 4th residence. Flag any instruction to use slot.

**Registry generalization required (Observation-Duty finding):** `apps/panel/src/canvas/bandSource.ts::_partSources` is `Map<PartResidence,PartSource>` — ONE adapter per residence; `sourced` is already taken by `sourcedParts` (filters, source='page-filters'). Two `sourced` consumers collide. Fix = route `sourced` by `PartField.source` id (Delta-1 already says "`source` is the ADAPTER id"): register sourcedParts under 'page-filters', chromeParts under 'site-chrome'; `enumerateParts` resolves sourced via `part.source`. Additive/reversible; makes today's "exactly one sourced adapter" assumption explicit.

**Seam inventory (all verified in tree, feat/ar49-m0-metric-first-authoring):**
- engine: `site-frame` META (packages/react or plugins) declaring chrome regions as `sourced` PartField(s) source='site-chrome'; `ChromeSlot.tsx` swap interim `data-canvas-chrome-slot` → the ONE `PartAnchor (field='chrome', index)` family; new `PartMutation` target `'site-chrome'`.
- app: `chromeParts` sourced adapter (reads site.chrome+chromeRegistry, writes updateChromeConfig); `CanvasOverlay.tsx` enumerate site-frame parts + delete the chrome-specific pass (`ChromeFrame`/`onSelectChrome`/`selectedChrome`); store `selectChrome` → wrapper over `select({nodeId:siteFrameId, partPath:'chrome.'+slot})`; retire `ChromeSelection` arm (the one-way de-alias, like Ph.6) + `isChromeSelection`/`chromeSelectionOf`; dock `element.chrome`+`ChromeInspectorPanel` fold into generic `element.schema` selectedBand projection; `ChromePalette` retired (canvas-selectable).
- fitness: keep FF-NO-EXTERNAL-SPECIAL-CASE + ratchets green; extend `oneSelectionAddress.fitness` (chrome is now a PartAddress, not a `kind:'chrome'` arm); `canvasChromeSelectable.fitness` migrates to the part-anchor family; e2e `chromeNavAuthoring.e2e`.

**Status 2026-07-12:** DESIGNED, HALTED for residence sign-off (slot→sourced divergence + the ChromeSelection de-alias is one-way, ADR-041-Ph.6-class). Not implemented. See [[project-part-grammar-foundation]].
