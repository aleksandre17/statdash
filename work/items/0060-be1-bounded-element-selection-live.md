---
id: "0060"
title: "BE-1: generic per-element canvas selection + BOUNDED inspector — click any element (incl. a KPI card) → only ITS declared contract, LIVE on :3013"
status: done
resolution: "Delivered via ADR-039 (Bounded-Element Selection Projection). Composite selection address (node, item-path); declaration-driven band discovery (bandItemsOf/bandFieldsOf); generic BandItemBoundary render anchor; bounded item Inspector over itemSchema. FF-NO-EXTERNAL-SPECIAL-CASE (0057) GREEN. Playwright real-bundle e2e bandItemSelect.e2e.ts PASSES; existing summaryCardInspector drill-in not regressed. Gates: panel vitest 776/0, tsc -b apps/panel 0, root tsc --force 0, lint 0 errors."
class: M
priority: P1
owner: —
implements: ADR-038 Bounded Element Law (governing) — the owner's #1 live-panel symptom
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - docs/architecture/ARCHITECTURE-REGISTRY.md
  - platform/apps/panel/src/inspector/Inspector.tsx
  - platform/apps/panel/src/studio/RightDock.tsx
---
**Goal** — Deliver the capability the reverted `nodeProjection` was reaching for, the RIGHT (declaration-driven) way, VISIBLE on the live panel. On :3013: (a) you can **click an individual element on the canvas — including a KPI card (a value-band `items[]` member)** — and it selects as a bounded unit; (b) the right dock shows **only THAT element's own declared contract**, a bounded projection, drilled one at a time — NOT the whole nested schema expanded.

**Root cause (found in live code, 2026-07-11)** — (1) value-band items (kpi-strip `items[]`) are not canvas-selectable elements → clicking a KPI selects the whole strip (`useCanvasController.selected`). (2) `Inspector.tsx` renders the selected node's schema as an accordion that **defaults every group open** (`collapsed` starts empty) + renders the whole `items[]` band → "everything comes out, doesn't fit." Both violate ADR-038: not bounded, not per-element.

**The Bounded-Element mechanism (NO external special-case)** — the canvas selection model must treat any element that DECLARES a value-band (`schema` field with `itemSchema`) as offering selectable child elements generically — keyed by the DECLARATION, not by `type==='kpi-strip'`. Selecting an item projects the Inspector over that item's own `itemSchema` (bounded). Works for ANY future element with a declared band (hero cards, R3) with zero new code — that is the law.

**DoD (VERIFIED live — not tsc/unit-green)**
- [ ] On :3013: click a single KPI card → it selects (bounded highlight); the dock shows ONLY that card's contract (Label/Value/Unit/Colour/Trend/…), not the whole strip expanded.
- [ ] Right side FITS — bounded/drill presentation, no overflow dump.
- [ ] Mechanism is generic: no `type === 'kpi-strip'`/hand-wired projector (FF-NO-EXTERNAL-SPECIAL-CASE, 0057, stays green).
- [ ] Proven by a **Playwright e2e on the real boot path** (the project's adopted real-browser harness) — clicks the card, asserts the bounded dock — plus a manual :3013 confirmation.
- [ ] No regression to strip-level selection or the existing itemSchema drill-in.

**Notes** — This is the heart of the owner's "big change isn't visible." Build DIRECTLY on-branch, serialized, no worktree. Verify LIVE — "BUILT" ≠ done. Likely needs an architect design pass on the generic selection-projection seam (declaration-driven), then implementation. Pair with the inspector defaulting groups COLLAPSED / summary-first so a bounded view fits.
