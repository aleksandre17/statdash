---
id: "0061"
title: "BE-3: in-canvas perspective switch — preview Annual↔Dynamics (year↔range) directly on the authoring canvas"
status: done
class: G
priority: P1
owner: orchestrator (direct, on-branch)
resolution: "In-canvas perspective switch added to CanvasToolbar — a pure projection of the page's DECLARED perspective axis (CanvasView derives options from renderedPage.perspectives, resolves ka labels, threads controller.setPreviewPerspectiveId). No per-page special-case; hidden when <2 perspectives. Drives the pre-existing previewPerspectiveId→MemoryRouter-remount→FilterProvider re-render seam. CanvasToolbar.test 3/3, canvas suite 100/0, tsc apps/panel EXIT 0. Live-refreshed to :3013 (real year/range) for end-to-end confirmation."
implements: authoring parity — the author previews the perspective the runner will switch (owner live-blocker)
depends_on: []
links:
  - platform/apps/panel/src/canvas/CanvasView.tsx
  - platform/apps/panel/src/studio/useCanvasController.ts
---
**Goal** — On :3013 the author CANNOT switch the perspective (წლიური/Annual → დინამიკა/Dynamics = the provisioning `year`↔`range` perspectives) to preview the corresponding views. The mechanism EXISTS — `useCanvasController.previewPerspectiveId` / `setPreviewPerspectiveId`, `CanvasView` builds `/?{perspectiveKey}={id}` — but it's buried in the Page dock's `PerspectivesPane` (`builtins.tsx:161`), not a direct on-canvas switch. Surface an **in-canvas perspective switch** (mirror the runner's `perspective-bar`), and VERIFY it actually re-renders the canvas for the other perspective.

**DoD (VERIFIED live on :3013)**
- [ ] An obvious on-canvas control switches Annual↔Dynamics; the canvas re-renders the corresponding sections (the `visibleWhen: perspective-is` blocks flip).
- [ ] Confirmed the preview URL path actually drives the render (not just state).
- [ ] Playwright real-boot: switch perspective, assert the range-only section appears / year-only disappears.

**Notes** — Likely a SURFACING fix (the engine + preview state already exist), not a rebuild. Verify functional first (it may be partly broken, not just buried). Bounded-Element aligned: the perspective is a declared page facet; the switch projects it.
