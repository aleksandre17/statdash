---
name: drop-port-geometry-falsified
description: The "container/page drop-ports collapse to 4x4 at (0,0)" diagnosis was FALSE; ports measure real boxes. Real drop-into-container blocker is the atomic-CDP mount race, not geometry. jsdom can't pin geometry — a Playwright e2e that reveals ports then measures is the only pin.
metadata:
  type: project
---

Card 0102 R1 handed a plausible-but-WRONG root cause: "CanvasOverlay `measure()` derives each container/page drop-rect from the anchor's `firstElementChild`, which collapses to a 4×4px box at viewport (0,0) because container/page anchors are `display:contents`." Presented as a real, human-facing geometry defect blocking the owner's PRIMARY gesture (drop a layout element INTO a container).

**Falsified with ground truth (real Chromium, real Vite bundle).** `platform/apps/panel/src/canvas/CanvasOverlay.tsx:150-156` reads `anchor?.firstElementChild ?? anchor`. The `data-part-node-id` anchor IS `display:contents` (its own `getBoundingClientRect()` = {0,0,0,0}, stamped by `setupCanvasRegistry.ts:118-136`), but `firstElementChild` resolves the container's REAL rendered box in every case. Measured live:
- `dropzone-page-drop:main` → 603×640 (whole `.inner-page` body)
- `dropzone-grid-empty:children` → 539×72 (`.layout-grid-ctx`, R1's `[data-node-empty] > *` min-height at work)
- `dropzone-sec-empty:children` → 539×72 (`.panel-col`)
- `dropzone-grid-pop:children` → 539×92 (populated grid)

And a real HTML5 drop (`dragover`+`drop` carrying `dataTransfer.setData('nodeType',…)`) on the empty-grid port LANDS the node as a CHILD (0→1 nested anchor). So a human CAN drop into a container/page (empty or populated). **R1 is closeable on geometry.**

**Why the live-verify agent saw "drop never lands":** the drop ports mount only while `dragging===true` (`CanvasOverlay.tsx:355`), flipped at palette `onDragStart` (`NodePalette.tsx:90-94`). React commits that mount synchronously after the dragstart handler, so a real human drag (hundreds of ms of dwell) always finds the port — but an ATOMIC trusted CDP `drag(from,to)` fires dragstart→drop in one synchronous turn before the mount commits, so the port doesn't exist at drop time. A harness-timing artifact, NOT a product bug. Do NOT "fix" the measure or force-mount the ports (they carry pointer-events and would hijack selection when not dragging).

**Methodology trap:** the diagnosis was falsifiable only in a browser — jsdom computes NO layout, so EVERY `getBoundingClientRect` is 0×0 and a unit fitness can neither reproduce nor pin drop-port geometry. The pin lives in Playwright e2e: `platform/apps/panel/e2e/dropTargetGeometry.e2e.ts` reveals the ports via a genuine `dragstart` on a palette tile (the dwell a real drag has), then (1) asserts every container/page port has a non-degenerate box, (2) drops and asserts the child nests. Reuses the `responsiveAuthoring.e2e.ts` route-mock harness (`**/api/**`). Related: [[probe-methodology-hard-vs-soft]] — replicate the REAL interaction path, not an atomic shortcut.
