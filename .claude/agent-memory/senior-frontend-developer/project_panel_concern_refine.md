---
name: panel-concern-refine
description: AR-52 REFINE moment — the CONCERN axis (content·data·style·layout·behavior) that groups the whole-node inspector; the declared tag, the app-tier taxonomy, the DockBody route, and the facet asymmetry to unify.
metadata:
  type: project
---

**AR-52 REFINE moment — "inspector by concern-groups" (DONE 2026-07-15, commit be1711c; apps/panel + additive core/react/plugins tag; ZERO object-model change).** Owner crisis: the right-dock was a flat, tangled property dump (`MuiBox css-0` chaos, "everything mushed"). Rides root Law 11 (REFINE = author-plane, concern-grouped, progressive). Canon: [[canonical-line-north]] + `BLUEPRINT-panel-canonical-relay`. Builds on [[panel-plane-inspector]] (plane) + [[facet-axis-style-facet]] (facets) + [[project_panel_ui_kit_and_rail]] (MUI→Radix).

## The CONCERN axis (the declared tag — the AudiencePlane precedent, exactly)
- **`FieldConcern = 'content'|'data'|'style'|'layout'|'behavior'`** — new type in `packages/core/src/config/prop-schema.ts`; **`PropField.concern?`** (absent ⇒ `'content'` — sibling of `group`, a presentation hint the ENGINE never reads). Same 5-hop re-export chain as AudiencePlane: core `prop-schema`→core `index.ts`→react `slice-meta.ts`→`engine/types/slice.ts`→`engine/types/index.ts`→`engine/index.ts` (add the symbol beside `AudiencePlane` in each block).
- **App-tier taxonomy (`apps/panel/src/inspector/concern.ts`):** `CONCERN_ORDER` (the canonical spine — content→data→style→layout→behavior), `CONCERN_LABELS` (bilingual, Law 4), `CONCERN_OPEN_BY_DEFAULT` = {content,data} (progressive disclosure), `concernOfField` (⇒content default), `concernOfFacet` (see asymmetry below), + the PURE derivations `bucketByConcern`/`applicableFacets` (framework-free — live here, NOT the .tsx, to avoid react-refresh warnings + keep them testable).
- **Reference schemas tagged** (kpi/chart/table/geograph + shared `dataIntegritySchema` preliminary→data): chart = data(measure)·style(chartType/stacked/…/axes/legend)·content(label)·layout(height); geograph = data(geoJsonUrl/paramKey/isoField/geoCodeMap)·behavior(multiSelect/maxSelect)·content·style(color)·layout(anchor); table columns drill tagged too. Untagged fields default to CONTENT (never orphaned).

## The render (calm surface, reversible Strangler)
- **`ConcernGroups.tsx` (the SHARED spine — extracted 2026-07-15, commit 6b66b90).** The CONCERN_ORDER walk + collapsible `<fieldset>/<legend>/button[aria-expanded]` disclosure + progressive open-state + empty-drop, taking `buckets` + `idBase` + a `renderBucket(bucket, concern)` render-prop. THREE call sites delegate (no parallel mechanism, Law 1/OCP): whole-node (facets in the body), band-item drill, nested-item drill. `ConcernGroup` + the `label` helper moved here.
- **`ConcernGroupedInspector.tsx`** — the whole-node surface now DELEGATES to `<ConcernGroups>` (renderBucket = node fields `<Inspector fixedSchemaSource(fields,[])>` then FacetControls); it shrank ~60 lines. Still plane-filters + buckets via `bucketByConcern(schema, applicableFacets(meta,role))`.
- **PART-DRILL is concern-grouped too (DONE 2026-07-15):** BOTH flat item paths now route through `<ConcernGroups>` — (a) the **canvas band-item** path = `builtins.tsx` `element.schema` `selectedBand` branch (select a KPI card/column/chrome region), (b) the **in-inspector nested drill** = `NestedItemControl.tsx` `ObjectFormScreen` (drilling an array/object field's items). BOTH `filterSchemaByPlanes(itemSchema, planesForRole(role))` FIRST (band uses `ctx.role`; ObjectFormScreen uses `useVisiblePlanes()`), then `bucketByConcern(visible, [])` (no facets — item-level). ObjectFormScreen keeps its ONE `DrillContext.Provider` wrapping ConcernGroups so a nested field in ANY concern is still a drill-row on the unified breadcrumb. Field DOM ids UNCHANGED (each bucket Inspector reuses the drill-path idPrefix; field names unique across concerns) → the existing NestedItemControl tests passed UNMODIFIED.
- **`DockBody.tsx` route unchanged:** whole-node → ConcernGroupedInspector; the registry sections (`element.schema` etc.) now emit concern-grouped bodies from within. The registry stays SSOT (dockSection/planeProjection GREEN).
- **MUI kill:** DockBody's `<Box sx>`+`<Divider>` → semantic `.studio-dock__sections` + `<hr class=studio-dock__rule>`; ConcernGroup CSS binds GLOBAL DTCG tokens (`--color-*`/`--spacing-*`/`--border-width-thin`), NOT the undefined `--insp-*` (dark-safe — see [[project_panel_ui_kit_and_rail]]).
- **Guard:** `FF-CONCERN-GROUPED` (`concernProjection.fitness.test.ts`) — taxonomy shape, no-orphan sweep over every registered node, reference distribution, facet bucketing, empty-drop.

## Gotchas + follow-ups (for the lead)
- **FACET concern is asymmetric** — node fields carry `concern` on the declaration, but facets map
  app-side via `FACET_CONCERN` (keyed by facet.id: data→data, style→style, chrome→layout,
  visibility/events→behavior). Purer = `FacetDescriptor.concern?` in packages/react — deferred.
- **Item-schema tagging is under-distributed.** Only the table column schema + kpi/chart/gauge
  item schemas got tagged (`concern` per field) in this wave; chrome region itemSchemas
  (app-header/app-footer) and other structural nodes' itemSchemas (hero/links/page-header/
  stats-carousel/featured-slider/geograph) remain UNTAGGED → a drill there shows one big CONTENT
  group (no orphan, just undistributed). Tag when those become authored surfaces.
- **Concern assignment judgment (for consistency when tagging more items):** static display
  toggles (axis `hidden`, legend `show`) → STYLE not behavior; conditional-logic/interaction (KPI
  `when`, events) → BEHAVIOR; number formatting/scale → STYLE; data-integrity (`preliminary`) →
  DATA; unit/caption text → CONTENT; governed binds (`measure`/`value`/`key`) → DATA;
  `width` → LAYOUT.
- **Pre-existing, not mine:** chart shows the measure picker twice (node field + DATA facet) — now
  adjacent in the DATA concern (clearer, still redundant); flag for content dedup.
- **CRLF trap** (reconfirms [[feedback_line_endings]]): `packages/core/src/index.ts` is
  anomalously CRLF in an LF repo — `sed -i` always flips it to LF (whole-file diff); the Edit tool
  preserves CRLF. Never `sed` a CRLF file here.
- **dist rebuild required** after any core/react/plugins tag change — the live app boots from
  dist (gitignored, don't stage).
