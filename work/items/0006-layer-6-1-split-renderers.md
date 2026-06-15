---
id: "0006"
title: "6.1: Split oversized renderers (toApexOptions, DataTable, SectionShell)"
status: done
class: G
priority: P3
owner: —
links:
  - docs/plan/roadmap-phase-5-6.md
---
**Goal** — No renderer exceeds size budget. Each file is one readable unit.

**Scope**
- plugins/panels/chart/default/utils/toApexOptions.ts (910 lines) — decompose by
  concern: axis mapping, series mapping, per-chart-type builders. One file per transform.
- plugins/panels/table/default/components/DataTable.tsx (408 lines) — extract footer
  aggregation, pivot-column building, bar-gauge rendering into co-located helpers.
- plugins/nodes/section/default/SectionShell.tsx (152 lines) — split view-toggle
  group and collapse header into co-located subcomponents.

**DoD**
- [ ] Each touched file within size budget (renderer ≤ 80, hook ≤ 100, types ≤ 150).
- [ ] No behavior change; existing render output identical.
- [ ] `npx tsc --noEmit` = 0 errors.

**Notes** — Closes gap #31 (size half). M effort (half-day). MED risk — large
mechanical refactor; pin behavior with visual check per page. P3 (after 6.2/6.3).
