---
name: project-panel-editor-capability-parity
description: ADR-051 DU4 trust-recovery — restore spec-editing capability silently lost across DU3+Step A; narrow the fold gate + AdvancedRawPanel escape + SpecTypePicker; FF-EDITOR-CAPABILITY-PARITY gate
metadata:
  type: project
---

Trust-recovery correction (ADR-051 DU4, 2026-07-20): DU3 (one editing surface) + Step A
(wide fold gate) TOGETHER silently stripped DataSpec editing power. Restored + gated so it
can never silently regress.

**Root cause + fix (workbench/workbenchModel.ts):** `toWorkbenchModel` admitted any kind
`desugarToPipeline` could fold — conflating "engine CAN lower to a pipeline" with "author
SHOULD edit it as a pipeline". Narrowed to ONLY `pipeline`+`query` (`isWorkbenchShaped`).
So `timeseries`/single-code `growth`/`pivot`/`transform` return `null` → the DU3 fallback
lane, where their intact dedicated editors (`registerSpecEditors.ts` → Timeseries/Growth/
Pivot/Transform) give FULL editing (code/years, pivot rows/keyField/valueFields/colors,
inline source+encoding, single↔multi toggle). The engine `desugarToPipeline` is UNCHANGED
(still folds them — a capability); the PANEL gate declines them (the decision is the
kind-check, not the fold ability). `coverage.fitness` FF-ALL-KINDS-SHAPED is engine-scoped
(desugar) so it's unaffected.

**Escape hatches restored (`workbench/WorkbenchAdvanced.tsx`, new — 3 exported components):**
- `SpecTypePicker` (R1) — create-from-scratch + inter-kind CONVERT via
  `resolveSpecAuthoring(type).make()`. On the **OWNED Radix Select** (`@statdash/react`), NOT
  MUI (FF-NO-NEW-MUI ratchet forbids new MUI Select — this was caught + fixed). `pipeline`
  isn't a catalog kind → shows placeholder (Radix has no MUI out-of-range warning).
  `data-testid="spec-type-picker"`. Mounted in the fallback-lane header, the from-scratch
  (`workbench-from-scratch`) branch, AND the three-pane AdvancedRawPanel.
- `AdvancedRawPanel` (owner's original complaint) — collapsed "Advanced / raw" disclosure the
  THREE-PANE gets: mounts generic `SpecBody` → `query` surfaces QuerySpecEditor's Advanced
  (encoding/MeasureSelector/FilterBuilder/FieldWells); native `pipeline` → writable raw JSON
  (SpecBody→JsonFallback for the un-catalogued kind). `data-testid="workbench-advanced"`.
- `ReadOnlyJson` (R6) — read-only JSON disclosure. `data-testid="workbench-json"`.

**DataWorkbench.tsx:** three-pane wrapped in `.data-workbench-shell` (flex column) so the grid
flexes and AdvancedRawPanel sits as a bounded footer (new CSS in workbench.css). `pipeline`
is NOT added to SPEC_CATALOG (would break FF-DATASPEC-AUTHORING-COMPLETE) — SpecBody's existing
JsonFallback already handles the un-catalogued kind.

**The GATE — `editorCapabilityParity.fitness.test.tsx` (FF-EDITOR-CAPABILITY-PARITY):** renders
the SURVIVOR (DataWorkbench) per capability + asserts reachable — timeseries/growth editable
code+years (panes ABSENT), pivot PivotEditor, transform inline rows+encoding, growth single↔
multi toggle, query three-pane Advanced (type-switch + Field Wells + read-only JSON), pipeline
writable raw JSON, from-scratch picker, and SpecTypePicker convert/create via make(). Imports
`registerSpecEditors` so the REAL editors render (not JsonFallback). Radix picker driven by the
FF-RADIX-A11Y-INTACT idiom (focus trigger → keyDown ArrowDown → findByRole listbox → click
option), NOT the MUI `mouseDown`+option idiom. Collapsed MUI Accordion content is
`visibility:hidden` → `getByRole` filters it (must expand first); `getByText`/`getByTestId`
see it collapsed.

**Tests updated (the DU3 gates that asserted the OVER-removal):** FF-ONE-SPEC-EDITOR + both
DataModelingPanel host tests + DataWorkbench.test — replaced "no kind `<Select>`" absence
assertions with "the picker lives INSIDE the workbench (spec-type-picker within the container),
not a SIBLING". The real DU3 invariant (no second parallel DataSpecEditor sibling;
`workbench-raw-advanced` absent; facet imports no DataSpecEditor) is preserved.
workbenchModel.test — the "Step A folded kinds open panes" block flipped to assert
timeseries/growth/pivot/transform → `null`.

Gate: full panel suite 172 files/1275 tests green, tsc clean, lint 0 errors. NOT deployed
(owner routes live verify). Related: [[project_panel_one_data_workspace]] · [[project_panel_ui_kit_and_rail]] ·
[[feedback_radix_jsdom_polyfills]].
