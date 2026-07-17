---
name: chrome-authoring-state
description: Live-verified state of chrome/frame authoring in the Strata Studio (AR-49) + the canvas-vs-runner InnerSidebar fidelity gap
metadata:
  type: project
---

As of 2026-07-10 the owner was evaluating whether chrome authoring is a gap worth
building, and whether a reported canvas-vs-runner "left bar" mismatch is a real bug.
Read-only diagnosis produced this ground truth (verify against code before acting —
this is a point-in-time snapshot).

**Chrome IS wired and functional, but discoverability-limited (NOT dead like Model mode was).**
- Author entry: `ChromePalette` (`src/inspector/ChromePalette.tsx`) at the BOTTOM of the
  Insert surface under the "გარსი" overline — below ~25 node blocks, needs scrolling.
- Live palette lists 3 slots (app-footer, app-header, InnerSidebar) → clicking opens
  `ChromeInspectorPanel` in the right dock (Element tab) = variant + per-slot schema
  fields via the generic Inspector (JSON/LocaleString editors). Proven live.
- **Chrome is NOT canvas-selectable**: `CanvasOverlay` only frames NODES; clicking the
  canvas header/sidebar selects nothing (falls to Page context). Wave 7's chrome
  right-dock context has no canvas trigger.
- **Frame** (page `frame:` field) is separately authorable via the Page-inspector
  "ჩარჩო" dropdown (default/landing/minimal).

**Canvas-vs-runner fidelity: the "left bar" is REAL but INVERTED from the owner's words.**
- Both Studio canvas AND runner render `.inner-sidebar` (data-layout=sidebar).
- Runner (:3009 /ka/regional): POPULATED — 3 nav sections + active highlight.
- Canvas (:3008): HOLLOW — same 260px rail + brand glyph, but 0 nav links, no brandTitle.
- Root cause: `CanvasView` mounts `<SiteProvider nav={[]}>` with no chrome/chromeConfig/
  ChromeOverrideProvider, while `toNodePageConfig` stamps `type:'inner-page'` →
  `InnerPageShell` unconditionally emits `<ChromeSlot slot="InnerSidebar" />`. So the
  canvas shows the chrome frame WITHOUT its data — a dataless scaffold, not a false bar.

**Why:** feeds the owner's decision on (a) building a real chrome-authoring affordance
(canvas selection + preview) and (b) fixing canvas chrome fidelity.
**How to apply:** if asked to "build chrome authoring" or "fix the left bar", the gap is
discoverability + canvas fidelity, NOT missing machinery — the reducers/registry/inspector
already exist. Related: [[canvas-siteprovider-chromeless]] (not yet written).
