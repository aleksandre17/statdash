---
name: constructor-page-inspector-methodology-v3
description: Constructor V3 — Page Inspector (PageConfigBase authoring via presentationPropSchema) + methodology/preliminary fieldset (Law 9 authorable badge)
metadata:
  type: project
---

Constructor roadmap V3 — two ADDITIVE authoring surfaces (no data-model reshape, byte-identical). Builds on [[constructor-paramdef-filters-v0]] / [[constructor-inspector]].

**Page Inspector** (`apps/panel/src/features/page-config/`): authors the PAGE ROOT's `PageConfigBase` config through the EXISTING generic `<Inspector>`.
- `pageSchemaSource` (mirrors `filterParamSchemaSource`) returns a page-root PropSchema; `PageInspectorPanel` models `page.meta` as a `CanvasNode {type:'inner-page', props: meta}` and writes edits via `setAtPath` into `page.meta`, dropping an emptied meta back to `undefined`. Page-SCOPED (shown regardless of node selection, like FiltersDrawer); mounted in `PageStep.tsx` Inspector column above FiltersDrawer.
- `presentation` is NOT hand-listed: `presentationPropSchema()` (union of registered projectors' schema(), from `@statdash/react/engine`) re-prefixed to `presentation.*` dot-paths. A new projector is authorable for free. Tests MUST boot projectors (`registerPresentationProjector(colorProjector/crumbsProjector)` from `@statdash/plugins/presentation`) — the registry is empty at module-eval, projectors register at app boot (setupCanvasRegistry).
- Also authors `frame` (static-option select: default/landing/minimal/canvas), `modeOrder` (array JSON editor), `vars` (object JSON editor — the documented collection escape hatch).
- **Page-root KIND (`type`) deliberately NOT authored**: canvasPageAdapter hardwires root to `inner-page` and strips `type` from meta (PAGE_STRUCTURAL_KEYS); carrying it would break the "meta-less page → no spurious meta" round-trip invariant (canvasPageAdapter.test.ts line ~211) and not take effect. Promoting kind = a deeper adapter reshape, out of scope (prompt's "kind WHERE editable" clause). Round-trip is already lossless via PageMeta structural pass-through — zero adapter edit needed.

**Methodology fieldset (Law 9 — make the badge AUTHORABLE; the shells already RENDER it):**
- Section node: added `methodology.{note,source,lastUpdated}` to `SectionSchema` + a Methodology PropertyGroup (`packages/plugins/nodes/section/default/SectionNode.ts`). Kept as plain `string` (NOT LocaleString) — the current `SectionMethodology` data model is string, so changing it would break byte-identity + be a reshape. The shell reads `def.methodology.*` directly; authoring writes the nested path via setAtPath → round-trips losslessly. (Prompt said "LocaleField for localized text" but the field is string-typed in the model; honoring byte-identity wins.)
- `preliminary` flag (signal #1 of `resolvePreliminary`, `def.preliminary===true`, drives PreliminaryBadge): added to chart/table/gauge via a SHARED reusable PropSchema fragment `packages/plugins/panels/dataIntegritySchema.ts` (`DATA_INTEGRITY_SCHEMA` + `DATA_INTEGRITY_FIELDS`). Each data-panel node type declares `preliminary?: boolean` (ISP per-element) and spreads the fragment into its schema + a "Data integrity" group. NOT a NodeBase widen (layout nodes have no badge — thin-base rule, see [[feedback_strict_solid_per_element]]). A new data panel spreads the same fragment.

**Gotcha:** `dataIntegritySchema.ts` carries bilingual Georgian labels but is NOT a `meta.ts`/`*Node.ts` → TIER-2 flagged by `no-tenant-content.fitness.test.ts`. Added to its ALLOW set (catalog-class, same as op-schemas/param-schemas/visibility-schemas). See [[law4_i18n_check]].

**Green:** build:engine+geostat+panel+typecheck+lint(0 err)+gen:schema(3 branches/28 $defs, PageConfigBase unchanged)+test 1209→1224 (Page Inspector 7, methodology 8). reference_metadata (V31 dataset-level methodology via MetadataPort) left untouched — not in cheap reach of the data-source editor this slice; node/section methodology + Page Inspector were the must-do.
