---
name: project-section-migration
description: Section Strangler-Fig is COMPLETE (twin retired, export+info wired); paths are packages/* not engine/*; divergent geostat tsconfig still real
metadata:
  type: project
---

**STATUS (verified 2026-06-28): the section migration COMPLETED.** Earlier "stalled twins" snapshot is retired.
- Legacy `SectionBlock.tsx` twin is **gone**. The section folder is `packages/plugins/nodes/section/default/` with `SectionShell.tsx` + `SectionHeader.tsx` + `SectionMethodology.tsx` + `SectionSkeleton.tsx` — no `components/` subdir, no `SectionBlock`.
- Info button is **wired** (`SectionShell.tsx:113 onToggleInfo={info.toggle}`); methodology disclosure renders (`:117-124`). The WCAG 4.1.2 dead-stub defect is **resolved**. `def.methodology` is now a real field.
- Export is wired **per-panel, not per-section**: `PanelExportBar` (DI `ExportBar` via `createDefaultUI.ts:34`) is rendered in `ChartShell:52`, `GaugeShell:60`, `TableShell:61`. `ExportBar`/`useExport` are NOT orphaned. Section-level export is a documented YAGNI deferral (`SectionShell.tsx:126`), not a gap.

**Path naming:** real layout is `packages/{contracts,expr,core,charts,styles,react,plugins}` (npm scope `@statdash/*`). The old `engine/*` directory naming is RETIRED — any memory saying `engine/core` etc. means `packages/core`.

**Divergent tsconfig (likely still real — re-verify before trusting):** `apps/geostat/tsconfig.app.json` historically typechecked all engine/package source through the app resolution context → hundreds of errors. The ROOT `tsconfig.json` (project references) is the authoritative green build. Do not trust per-app tsconfig error counts as platform health.

**How to apply:** the section node is no longer a migration site — treat it as canonical reference for shell anatomy (variants→data-attrs, useDisclosure info, per-panel export). [[project-platform-maturity]]
