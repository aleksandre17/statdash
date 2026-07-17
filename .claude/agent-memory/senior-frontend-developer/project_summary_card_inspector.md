---
name: summary-card-inspector
description: SPEC-worldclass Move 1 — the Summary-Card Inspector (rich values → constant-weight glance cards, no raw JSON) + the dock section registry
metadata:
  type: project
---

Move 1 of `docs/architecture/proposals/SPEC-worldclass-authoring-ui.md` (§3.1) — the acute right-side fix. Landed + live-verified on :3013.

**What it is (the grammar):**
- `inspector/summarize.ts` — `summarizeRegistry` keyed by PropFieldType → `SubjectSummary {primary, secondary, badges}`; built-ins for DataSpec/ChartDef + a TOTAL generic field-count fallback (never returns JSON). OCP: one register() per rich type.
- `inspector/controls/SummaryCard.tsx` — the FieldControl (glance card + "Open editor →" that escalates a `node-field` focus-view). Exports `SummaryCardView` (presentational SSOT) — the SL-5 FiltersDrawer affordance was retired into it. Constant height via `SummaryCard.css` (`max-height` + `overflow:hidden`).
- `inspector/rawJsonEscape.ts` — `isRawJsonEscapeEnabled()` (URL `?rawjson` or `setRawJsonEscape()` test seam). JsonControl reachable ONLY behind this.
- `FieldControlRegistry.resolve()` step 6: no registered control → SummaryCard (escape → JsonControl). The 4 rich registrations (object/array/DataSpec/ChartDef→JsonControl) were REMOVED; they fall to the SummaryCard default now.
- `inspector/sections/*` — `dockSectionRegistry {id, appliesTo, render, order}` + `DockBody`; RightDock body composes from it (absorbed the hardcoded Chip+Inspector+ContextEditor+Visibility / page-panes stack). `registerBuiltinDockSections()` at RightDock module load.

**Gotchas that bit:**
- A rich FieldControl MUST carry `id` (Inspector renders `<label htmlFor={id}>`) — SummaryCardView takes `id` and puts it on the card root, else `getElementById` a11y/tests break.
- Old tests asserting raw-JSON (`.insp-field__json`, `getByLabelText` on opaque fields) had to flip to `.summary-card` / `getByText`. Files: NestedItemControl.test, nestedItemControl.escalation.fitness, VisibilityBuilder (needed the id fix), dockZones.fitness (source-scan `/<Inspector\b/` → `/<DockBody\b/`).

**New FFs:** FF-NO-RAW-JSON-DEFAULT, FF-DOCK-CONSTANT-WEIGHT, FF-SUMMARY-EVERYWHERE (`inspector/summaryCard.fitness.test.tsx`); section grammar (`inspector/sections/dockSection.test.ts`).

**Deferred (W-B/W-C):** "Open editor" opens a read-only structured detail (`RichValueDetail`) + dev-flag JSON; real structured editing = the Stage / Chart Studio. The chart node is SPARSE not JSON-miscast (schema is 3 fields; SCHEMA_TODO undrained) — the JSON miscast lives on opaque objects (kpi item `when`/`trend`, kpi-strip `filter`). See [[placement_law_arc]].
