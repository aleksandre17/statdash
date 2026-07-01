---
name: project-extension-points
description: Architecture 3 — typed extension point registry (VS Code contribution-points pattern) implemented and wired
metadata:
  type: project
---

Extension point system (Architecture 3) is complete as of 2026-06-17.

**Why:** Plugins need to contribute into named slots inside shells they don't own, without modifying the shell. Implemented the VS Code / Eclipse contribution-points pattern.

**Core files created:**
- `engine/react/src/engine/extensions/ExtensionPoint.ts` — typed slot class, identity by string id (HMR-safe)
- `engine/react/src/engine/extensions/ExtensionRegistry.ts` — contribute/resolve with order + when filter
- `engine/react/src/engine/extensions/useExtensions.ts` — React hook wrapping resolve()
- `engine/react/src/engine/extensions/points.ts` — PANEL_TITLE_BADGE + SECTION_HEADER_ACTIONS canonical points

**RenderContext change:** `extensions: ExtensionRegistry` added as required field (runtime services "B" half). Three construction sites patched: `auth.test.ts`, `a11y.test.tsx`, `html.tsx`. Tests using `as unknown as RenderContext` cast are unaffected.

**App singleton pattern:** `apps/geostat/src/extensions/registry.ts` — module-level `extensionRegistry` singleton, same pattern as `modeRegistry`. `setupExtensions()` called from `setupRegistrations.ts`. Registry passed to `<NodePageRenderer extensions={extensionRegistry} />` in `PageLoader.tsx`.

**Contributions registered:**
- `PANEL_TITLE_BADGE` with `when: host.preliminary === true` → `PreliminaryBadge`
- `SECTION_HEADER_ACTIONS` order 10 → `SharePermalinkButton`

**i18n keys added** to `feedback` namespace: `preliminary.label`, `preliminary.title`, `share.permalink` (ka + en).

**How to apply:** When plugins need to inject UI into a shell slot, define a point in `points.ts`, consume it in the shell via `useExtensions(ctx.extensions, POINT, host)`, and register contributions in `apps/geostat/src/extensions/setupExtensions.ts`. Passes `extensionRegistry` via `NodePageRenderer.extensions` prop — not a React context, not a global singleton read inside engine/react.
