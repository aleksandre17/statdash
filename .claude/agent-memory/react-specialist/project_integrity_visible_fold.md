---
name: integrity-visible-fold
description: page data-integrity fold gates on NodeVisibilityContext — mounted-but-hidden (view-toggle) panels clear their report; visibleWhen already unmounts
metadata:
  type: project
---

The page-header data-integrity chip (AR-39/AR-40, `NodeStatusContext` page scope) now folds only VISIBLE panels. Fix branch `fix/integrity-visible-fold` (commit feb2e65).

**The two hiding mechanisms (the load-bearing distinction):**
- `renderNode` visibleWhen/perspective gate → returns `null` = UNMOUNTS. An unmounted panel never runs `useReportNodeStatus`; unmount cleanup clears its report. Already correct — no gate needed there. (SiteRenderer re-memoizes `sectionCtx.perspectiveState` on perspective change, so switching perspective genuinely remounts.)
- view-toggle (`SectionShell`/`GeographShell` `resolveViewState(isHidden)` → `data-view=hidden`/`display:none`) keeps the inactive chart/table view MOUNTED. THAT panel kept publishing preliminary=true into the fold while off-screen — the leak.

**The seam:** `NodeVisibilityContext` (boolean, default true) + `NodeVisibilityProvider` + `useNodeVisible` in `packages/react/src/engine/NodeStatusContext.tsx`, exported from `engine/index.ts`. `useReportNodeStatus` reads it: hidden ⇒ `collector.clear(id)` and publish nothing; shown ⇒ report. Providers AND with their parent (nested composition). The owning container (information-expert) wraps each hidden view-slot in `<NodeVisibilityProvider visible={!hidden}>` — done in SectionShell + GeographShell.

**Why:** the fold must reflect the VISIBLE data slice (owner rule: preliminary disappears when no preliminary data is shown). Declarative signal (the shell already computes `isHidden`) preferred over DOM `useContainerVisible` — deterministic, jsdom-testable, zero ResizeObserver.

**How to apply:** any NEW mounted-but-hidden view-slot must wrap its subtree in `NodeVisibilityProvider` or its publishers pollute the fold. Fitness `FF-INTEGRITY-VISIBLE-FOLD` in `data-integrity.fitness.test.tsx` locks it. NOTE: `GeographShell` computes its OWN preliminary via `PANEL_TITLE_BADGE`/`resolvePreliminary` and does NOT call `useReportNodeStatus` — the map itself is not consolidated into the page fold (only its table child is). Out-of-seam: a VISIBLE panel computing preliminary from a non-selected-year slice (kpi-strip fold / `resolvePreliminary`) is a separate data-correctness seam, not this visibility gate.
