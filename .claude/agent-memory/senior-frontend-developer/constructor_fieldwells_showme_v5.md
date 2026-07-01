---
name: constructor-fieldwells-showme-v5
description: Constructor V5 — drag-to-bind field wells + Tableau "Show Me"; the non-programmer binds data by dragging field chips / clicking a suggested chart (byte-identical config output)
metadata:
  type: project
---

Constructor roadmap V5 — the "easy for a non-programmer" binding UX. ADDITIVE: the produced config is byte-identical to the typed editors; the UX is the improvement, not the output. Builds on [[constructor-dataspec-editors-v2]] / [[constructor-inspector]]. Lives in `apps/panel/src/features/data-layer/`.

**fieldwells/ (drag-to-bind, Looker/Tableau pattern):**
- `fieldChips.ts` (PURE) — cube profile → `FieldChip[]` (measures + dimensions). Reuses `discovery/cubeEnumOptions` (measureOptions/dimensionOptions) for labels; adds drag metadata = the field KIND + its Vega-Lite `measurementType` (rides from R2 `deriveMeasurementType` — measure→quantitative, isTime→temporal, else nominal). The author never picks a type.
- `binding.ts` (PURE — the byte-identical HEART) — `bindMeasure(query,chip)` appends to `ObsQuery.measure` deduped (=== MeasureSelector's `measure: string[]`); `bindEncoding(enc,channel,chip)` writes the channel as a **bare string** `{...enc,[channel]:code}` (=== EncodingEditor's `setChannel`). CRITICAL: write a bare string NOT a ChannelDef — a ChannelDef would DIVERGE from the typed editor and break the invariant. `wellAccepts(well,kind)` = Tableau shelf rule (measure/value take a measure; label/series/color take a dimension). Wells: `'measure' | 'value' | 'label' | 'series' | 'color'`.
- `FieldPalette.tsx` — chips are dnd-kit `useDraggable` AND a clickable `<Chip>` button (pick→arm). `FieldWell.tsx` — dnd-kit `useDroppable` AND, when an armed chip is valid, `role=button tabIndex=0` (Enter/Space binds) — the keyboard/click EQUIVALENT of the drop (WCAG 2.1 AA). `FieldWells.tsx` — orchestrates one `DndContext` (shared `useDndSensors` = pointer+keyboard); BOTH drag (onDragEnd recovers typed `dragData.ts` payloads) and pick→click funnel through ONE `applyBind(well,chip)` → the pure writes. Wired into `QuerySpecEditor` as the PRIMARY surface; the typed MeasureSelector/EncodingEditor moved into a collapsed "Advanced (გაფართოებული)" accordion (progressive disclosure). Filter + PipelineBuilder stay (wells don't cover them — YAGNI bound to measure + core channels).

**showme/ (Tableau "Show Me"):**
- `buildSuggestedSpec.ts` (PURE) — `(PanelSuggestion, profile) → query DataSpec` populated with first measure + basis-dim label (codes from profile, Law 2). Returns null when no measure. Same `query` shape the typed editors emit.
- `ShowMe.tsx` — REUSES the existing `discovery/suggestPanels` (no new suggestion logic); renders each suggestion as a one-click Button → `buildSuggestedSpec` → `onInsert(spec, panelType)` callback. Wired into `DataStep` left rail; host calls `createDataSpec` (the existing add-spec path) + selects it. Hides when no suggestions (accelerator, never a blocker).

**Byte-identical proof:** `binding.test.ts` (pure: chip→config === reproduced typed-editor output) + `FieldWells.test.tsx` (the pick→click path through the rendered component emits identical config; mocks useActiveProfile + useSite via vi.mock). `buildSuggestedSpec.test.ts` + `fieldChips.test.ts` pin the pure builders.

**Green:** build:engine+geostat+panel+typecheck+lint(0 err, 43 accepted react-refresh warnings)+test 1334→1357 (+23: binding 11, fieldChips 5, buildSuggestedSpec 5, FieldWells 3). No engine/config TYPE changed (gen:schema unchanged) — pure additive panel UX.
