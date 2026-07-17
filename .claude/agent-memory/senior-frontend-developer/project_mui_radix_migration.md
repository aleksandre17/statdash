---
name: project-mui-radix-migration
description: MUI→Radix Strangler — owned component foundation in packages/react/src/components/ui; wave-0071 Select landed; ratchet baseline + remaining sweep targets
metadata:
  type: project
---

Owner-committed direction: MUI → Radix headless primitives on the DTCG token spine (craft +
agnosticism). Spec: `docs/architecture/proposals/BLUEPRINT-radix-foundation-and-mui-exit.md`.
Pattern: an OWNED compound = unstyled `radix-ui` behavior + `@layer components` DTCG-token CSS +
a compound API, living AGNOSTIC in `packages/react/src/components/ui/**` (a second tenant restyles
it free). MUI + Radix COEXIST — both project the one DTCG spine (`packages/styles`), so no dual-theming
clash. Package added: `radix-ui` (unified, catalog).

**Wave 0071 DONE (commit b24aa02):** owned `Select` (`components/ui/select/`) swapped into
`SelectControl` (primitives.tsx) + EventsField's 3 selects. `FieldControlRegistry.ts` UNTOUCHED
(the OCP proof). Guards live: `FF-RADIX-TOKEN-ONLY`, `FF-RADIX-A11Y-INTACT`, `FF-NO-NEW-MUI`.

**Ratchet baselines (FF-NO-NEW-MUI, `apps/panel/src/inspector/muiSelectRatchet.fitness.test.ts`):**
inspector MUI-Select === 0 (locked); app-wide MUI-Select <= 12. LOWER these as waves land, never raise.

**Why:** WIP=1 Strangler fused with the re-lay — each wave crafts a surface AND retires its MUI in
the same wave; never a dedicated migration project.

**How to apply — remaining MUI-Select swaps are now pure mechanical replication** (same owned
`Select`, same token CSS, prop-compatible): the 12 app-wide sites are in `features/data-layer/**`
(DataSpecEditor, EncodingEditor, FilterBuilder, PipelineBuilder, steps/SortStepForm),
`features/chrome/ChromeCompositionPanel`, `features/datasources/SourceAuthoringPanel`,
`features/filters/AddControl`, `features/visibility/VisibilityBuilder`,
`studio/model/{CalcBuilder,ExprTreeEditor,MetricEditor}`. Next foundations per blueprint waves 0072+:
ToggleGroup, Field (TextField), Button/IconButton, then overlays (Popover/Dialog/DropdownMenu/Tooltip).
Gotcha to carry forward: Radix Select FORBIDS an empty-string `Item` value — route a "clear/none"
option through a sentinel and map back (see primitives.tsx `CLEAR_VALUE`). Testing: [[feedback-radix-jsdom-polyfills]].
