---
name: project-panel-canvas-chromeconfig-defect
description: Live Constructor canvas can't render page nodes in a real browser — CanvasView omits chromeConfig; NodeErrorBoundary + a compensating jsdom test mask it
metadata:
  type: project
---

The Constructor **live canvas cannot render page nodes in a real browser** (found by the new Playwright harness on its first run — a textbook "green ≠ works").

**Root cause:** `apps/panel/src/canvas/CanvasView.tsx` builds its `<SiteProvider>` WITHOUT a `chromeConfig`, but the `inner-page` shell (`packages/plugins/pages/inner-page/default/InnerPageShell.tsx`) unconditionally mounts `<ChromeSlot slot="InnerSidebar" />` → `InnerSidebarShell` calls `useChromeConfig()` → throws `"chromeConfig not provided to <SiteProvider>"` → `NodeErrorBoundary` swallows it into a "Failed to load component" card, so the page's children (charts/tables) never render.

**Why it stayed green:** jsdom returns 0-rect geometry (so canvas selection was never real-browser-tested) AND the sibling proof `apps/panel/src/save/authorRender.e2e.test.tsx` passes `chromeConfig` to its OWN SiteProvider — i.e. the test compensates for what the product omits.

**How to apply:**
- Documented as a `test.fixme` in `apps/panel/e2e/boot.e2e.ts` ("the live canvas renders the chart node"). When fixed, delete `.fixme` → it becomes the direct canvas-frame bind proof.
- The fix is RUNTIME/product (was out of scope for the test-infra task that found it). Architectural call: CanvasView passing a default `chromeConfig`, vs. the chrome shells null-guarding `chromeConfig` (the "fail-soft chrome" direction per [[project_failsoft_chrome_and_app_boundary]] — that memory already flags "shells must null-guard chromeConfig"). Prefer the shell null-guard (packages-level, fixes ALL chrome-less SiteProvider mounts) over an app-level patch.
- Related boot-gap history: [[project_panel_m0_boot_gaps]]. Harness: [[project-panel-playwright-e2e]].
