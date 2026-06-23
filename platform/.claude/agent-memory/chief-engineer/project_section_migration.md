---
name: project-section-migration
description: Stalled Strangler-Fig migration from legacy SectionBlock to new SectionShell — divergent twins, orphaned ExportBar, divergent geostat tsconfig
metadata:
  type: project
---

The section node has TWO shells mid-migration (Strangler-Fig stalled): legacy `engine/plugins/nodes/section/default/components/SectionBlock.tsx` and new `engine/plugins/nodes/section/default/SectionShell.tsx`.

**Why it matters:** functionality is split across the twins, so "is feature X built?" depends on WHICH shell you read.
- Legacy `SectionBlock.tsx`: hardcoded Georgian strings (`ექსპორტი`, `ინფორმაცია`), but has a WIRED export button (`onClick={onExport}`, line 129).
- New `SectionShell.tsx`: i18n via `useT`, but the info button (line ~152) is a dead stub (no onClick, WCAG 4.1.2 defect) and there is NO export wiring.
- `ExportBar` + `useExport` (`engine/react/src/components/feedback/ExportBar.tsx`, `engine/react/src/engine/hooks/useExport.ts`) are fully functional (Blob download, CSV+SDMX-JSON registry) but have ZERO render-tree callers — N16 capability shipped but never connected to SectionShell.
- `SectionNode.ts` has no `methodology`/`info` field — the info button is UI ahead of its data contract. `KpiCard.tsx` already has the correct conditional `methodologyUrl` pattern to copy.

**Divergent tsconfig:** `apps/geostat/tsconfig.app.json` is NOT on the green path. It `include`s `../../engine` and typechecks all engine source through the app resolution context → 284 errors (peer-dep TS2307, erasableSyntaxOnly TS1294, duplicate re-exports in `engine/plugins/registry.ts:18-22`). The ROOT `tsconfig.json` (project references) is the authoritative green build (0 errors). Do not trust per-app tsconfig error counts as platform health.

**How to apply:** when auditing section/export/info features, check both shells and the root tsconfig (not tsconfig.app.json). The live render path uses SectionShell. Wiring ExportBar into SectionShell + retiring SectionBlock is the obvious next migration step. [[project-platform-maturity]]
