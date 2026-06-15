---
id: "0004"
title: "6.3: Delete dead Track-B config surface"
status: done
class: M
priority: P2
owner: —
links:
  - docs/plan/roadmap-phase-5-6.md
---
**Goal** — Remove dead Track-B types from engine/core and engine/react public API.
Pre-flight grep (2026-06-15) confirmed ZERO live imports outside source definitions.

Dead types confirmed: SectionDef, SectionView, WidgetDef, TabsDef, TabEntry, TabsMap,
PageHeaderDef, FilterBarDef, KpiStripDef, LinksDef, LinkDef, groupSectionsByWidth,
groupWidgetsByWidth.

Live — KEEP: DataSpec, ColumnDef, RowSpec, TableConfig, VisibilityExpr, KpiDef,
ChartDef, FieldConfig, LinkIconKey, resolveTemplate, evalVisibility.

**DoD**
- [ ] Dead types deleted from engine/core/src/config/section.ts.
- [ ] Dead exports removed from engine/core/src/index.ts and config/index.ts.
- [ ] Dead re-exports removed from engine/react/src/index.ts.
- [ ] `npx tsc --noEmit` = 0 errors; app boots.

**Notes** — Class-M: touches public package API index files. Risk: LOW (zero consumers
confirmed by grep). Two-way door (git revert). Closes gap #12.
