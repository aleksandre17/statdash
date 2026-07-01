---
name: perspective-axis-p7
description: P7 FINAL POLISH (landed 2026-06-27) — two design-in items reaching 100%: (1) CanvasView live perspective preview wired via router-URL seam (zero engine edit), (2) permalink default-elision in usePerspectiveContext (Law-9 URL=permalink). Builds on [[perspective-axis-p6]].
metadata:
  type: project
---

# Perspective-axis P7 — final polish (LANDED 2026-06-27, NOT committed)

Two additive, fitness-locked items closing the refactor. Arrow intact (no core/react app-specific edit for Item 1). YAGNI honored — no deferred doors built. NOT committed (orchestrator green-gates + commits).

## Item 1 — CanvasView live perspective preview (the P-final follow-up)
**The seam (no engine/react edit):** the renderer's perspectiveState SSOT derives ENTIRELY from the URL filter param — `FilterProvider` reads `location.search` on MOUNT → `usePerspectiveContext.current` reads `state[param]`. CanvasView already wraps `NodePageRenderer` in a `MemoryRouter`. So previewing a perspective = SEED the router URL. ZERO arrow violation, no new vocabulary.
- `CanvasView.tsx`: new `previewPerspectiveId?: string` prop. `perspectiveKey = Object.keys(renderedPage.perspectives ?? {})[0]` (SAME derivation as SiteRenderer:99). `previewEntry = key && id ? '/?<key>=<id>' : '/'`. `<MemoryRouter key={previewEntry} initialEntries={[previewEntry]}>` — `key` forces FilterProvider REMOUNT on preview switch (it seeds from URL only on mount). Absent preview ⇒ '/' ⇒ engine folds to perspectives[0] (SSOT default).
- Lift preview state to **PageStep.tsx** (transient view-state, like `dragging` — NOT a store slice): `previewPerspectiveId` useState → into `<CanvasView previewPerspectiveId>` + `<PerspectivesPane onPreviewChange={setPreviewPerspectiveId}>`.
- **PerspectivesPane.tsx**: new `PerspectivesPaneProps.onPreviewChange?` → threaded to `AxisEditor`. AxisEditor: `selectedId` raw useState; EFFECTIVE `activeId = perspectives.some(id===selectedId) ? selectedId : perspectives[0].id` (derived-at-render — a reorder/remove dropping the selected id falls back to default with NO corrective setState-in-effect, which lint `react-hooks/set-state-in-effect` FORBIDS). `useEffect(()=>onPreviewChange?.(activeId),[activeId,onPreviewChange])` mirrors up (incl. perspectives[0] on mount). Switcher onClick → setSelectedId.
- **Test** (CanvasView.test.tsx +2): container-page (renders children.rendered, NO sidebar chrome — `inner-page` throws `chromeConfig not provided`) with a section gated `view.visibleWhen:{op:perspective-is,perspective:range,param:mode}`. Oracle = canvas-node-anchor `[data-canvas-node-id=...]` (setupCanvasRegistry middleware stamps every node). No preview ⇒ sec-range ABSENT (default=year); previewPerspectiveId='range' ⇒ PRESENT.

## Item 2 — permalink-from-registry (Law-9: URL=permalink)
**What HELD pre-P7** (confirmed, no edit): deep-link round-trip (FilterProvider seeds from URL → current reads it) + derived param (perspectiveKey = `Object.keys(page.perspectives)[0]`, not hardcoded 'mode'). **What was MISSING:** default-elision — toggle `set(def.id)`→`filterSet(param,id)` wrote `?mode=year` even for the default.
- **FIX in `usePerspectiveContext` (PerspectiveContext.tsx)** — the SSOT toggle write-point that KNOWS `available[0]` (the registry/axis default): `defaultId = available[0]?.id`; `set(id) = filterSet(param, id===defaultId ? '' : id)`. FilterContext.set already `delete`s on empty value ⇒ default elided. `current` already folds absent-param → defaultId ⇒ elided default round-trips byte-identically. The `perspective:set` COMMAND path (SiteRenderer:220) is a separate programmatic escape hatch that doesn't know available[0] — NOT elided there (acceptable: user-facing toggle goes through usePerspectiveContext.set).
- **Fitness** (NEW `packages/react/src/context/perspectivePermalink.fitness.test.tsx`, 6 cases, real FilterProvider+MemoryRouter, no URL mock): deep-link non-default restores; absent→default; param DERIVED (a 'view'-keyed axis ignores 'mode'); default-elision clears param; non-default written; full round-trip non-default→URL→default-elides.

## Green: panel tsc -b exit 0 · geostat typecheck exit 0 · lint 0-err/43-warn (baseline; 2 PerspectiveContext.tsx react-refresh warns PRE-EXISTING) · check-laws all-clean · FULL suite 1779 pass/66 skip/0 fail (+26 from P6's 1753). All 6 touched files <400 lines. NOT committed/deployed.
