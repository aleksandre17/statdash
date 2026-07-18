---
name: panel-data-workbench-wp2
description: W-P2 three-pane data workbench — focus-view escalation surface, generatedQuery plane-split model, entry via DATA facet
metadata:
  type: project
---

# W-P2 — the three-pane data workbench (ADR-046 · SPEC §3)

`platform/apps/panel/src/features/data-layer/workbench/` — the Power-Query-class
surface: step rail (reused `PipelineBuilder`) · live grid (re-homed `PipelineStepGrid`
verbatim) · generated-query pane (`GeneratedQueryPane` + pure `generatedQuery.ts`).

**Why / key decisions:**
- **The wide surface is a FOCUS-VIEW ESCALATION, not a dock section.** The studio's
  established separate-screen for workspace-weight subjects is `FocusView` +
  `useFocusEscalation` (SL-4 node-field). `DataFacetField` escalates
  `{ source:'node-field', fieldPath:'data', render:(bind)=><DataWorkbench value=bind.value onChange=bind.onChange/> }`.
  This gives the grid the full-viewport center column WITHOUT touching the StudioShell
  4-column grid. Entry door = `data-testid="open-data-workbench"` (shown for query/unbound spec).
- **`generatedQuery.ts` is the plane-split SSOT (E4 EXPLAIN seam).** `describeAuthorSteps`
  resolves every noun through `buildColumnLabels` (the grid's governed catalog) and
  NEVER calls `queryReadObs` — so it structurally cannot leak a raw code
  (FF-AUTHOR-NO-QUERY by construction). `describeStewardDetail` (gated by `useRole()`)
  adds raw DataSpec JSON + lowered ObsQuery (fail-soft on unresolved ref).

**How to apply (W-P3 / future):**
- Verb labels + field-ref noun extraction in `generatedQuery.ts` (`VERB_LABELS`,
  `FIELD_VALUE_KEYS`/`FIELD_RECORD_KEYS`) are W-P2-LOCAL hand-maps — W-P3 must make them
  a projection of the op-registry `category` field (the SSOT), not hand-listed sets.
- Real step shapes matter: `filter` = `{op:'filter', where:{field:val}}` (fields are
  KEYS of `where`, values are member codes — never surface values). See `defaultStep.ts`
  for every op's minimal valid shape.
- KNOWN gap the grid still has (verbatim re-home): the live grid exposes member codes as
  CELL values + duplicate metric header (value+measure) + untranslated `obsStatus` — a
  `columnLabels.ts`/cell-localization pass owed in W-P3. The generated-query pane is clean.

Related: [[project_panel_pipeline_live_grid]] (W-P1 grid) · [[project_panel_plane_inspector]]
(AudiencePlane) · [[project_facet_axis_style_facet]] (facet dispatch).
