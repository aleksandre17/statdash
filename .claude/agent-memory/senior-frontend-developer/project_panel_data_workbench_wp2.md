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

**Mount-seam map (0099 — the workbench mounts standalone, no canvas element):**
`DataWorkbench` is a pure controlled `value`/`onChange` component — it needs NO selected
node. Its two live-binding HOSTS:
- **Facet escalation (canvas element):** `DataFacetField` → `useFocusEscalation().escalate({source:'node-field', fieldPath:'data', render:bind=><DataWorkbench …/>})` → full-screen
  `FocusView`. The escalation host (`FocusEscalationContext`) is provided ONLY around the
  compose-shell RightDock — it is ABSENT inside the Sources/Model focus-view screens, so you
  CANNOT escalate a fresh workbench focus-view from those screens.
- **Entity landing (`DataModelingPanel`, 0099):** a workbench-shaped spec (`isWorkbenchShaped`
  = native `pipeline` OR legacy `query`) selected in the panel mounts `DataWorkbench` inline,
  FULL-WIDTH (browser column steps aside, a Back returns), bound to the spec entity via
  `updateDataSpec`. This is the Sources «დაათვალიერე workbench-ში» handoff's landing (the
  handoff seeds a `pipeline` via `withStewardCube`+`createDataSpec` and selects it). BEFORE
  0099 the panel routed `pipeline` through `DataSpecEditor.SpecBody` (no `pipeline` case) →
  `JsonFallback` raw JSON — the defect. The raw `DataSpecEditor` now survives as a COLLAPSED
  steward disclosure below the workbench (plane law), and still serves non-workbench spec kinds.
- **Do NOT route `pipeline`→workbench inside `DataSpecEditor.SpecBody`:** `DataSpecEditor` is
  also the facet's steward raw-editor accordion (where a pipeline element already has the
  escalation door) — it would double the workbench + strand the raw-JSON escape.

Related: [[project_panel_pipeline_live_grid]] (W-P1 grid) · [[project_panel_plane_inspector]]
(AudiencePlane) · [[project_facet_axis_style_facet]] (facet dispatch) ·
[[project_panel_pipeline_emission_flip_wp5b]] (fromWorkbenchModel emission).
