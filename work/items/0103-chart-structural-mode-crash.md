---
id: "0103"
title: "Chart node crashes (console) in STRUCTURAL mode — useNodeRows flatMap on undefined; NodeErrorBoundary catches, 'No data' renders, but the console lies. Canon: canvas-never-lies."
status: OPEN (2026-07-19 — surfaced during 0102 R1 live-verify; tracked, not yet scheduled)
class: S-M (data-honesty / structural-mode guard)
priority: P2 (isolated to chart-in-structural; clears on reload / in live-data mode; grid/section unaffected)
owner: lead → (react-specialist / debugger when scheduled)
relates:
  - CLAUDE.md Law 11 (Authoring Canon C2 — the canvas never lies; honest states, not silent errors)
  - work/items/0102-canonical-panel-ia.md
---
**Symptom (live, :3013, structural mode):** dropping/rendering a **chart** node in Structural mode throws 4 console errors — `TypeError: Cannot read properties of undefined (reading 'flatMap')` at `platform/packages/react/src/engine/useNodeRows.ts:233` → `AsyncRows` (`renderNode.ts:259`), caught by `NodeErrorBoundary` (`[renderNode] shell crashed {type: chart}`). The chart's honest "No data" state DOES render (boundary fallback), but the console logs the boundary catch. Grid/section containers do NOT crash. Clears on reload / in live-data mode.

**Why it matters:** structural mode is the *authoring* view (live data off by design). A chart there hits a code path that assumes rows exist (`flatMap` on undefined) instead of degrading to the declared honest empty/structural state. Per the Authoring Canon (Law 11 C2), the canvas must show a *declared honest state*, never a silent error/crash — even a caught one that logs.

**Fix direction (when scheduled):** `useNodeRows.ts:233` must treat the no-rows / structural-mode case as an honest empty state (guard the `flatMap`), so a chart in structural mode renders its representative/empty state without a boundary crash. Add a fitness: a chart node in structural mode renders without throwing.

**Not in R1 scope** (R1 = drop-affordance projection). Tracked as a standalone data-honesty defect.
