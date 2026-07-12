---
id: "0066"
title: "REFORM: the Bounded-Element SHELL — universal 'select → edit only its contract, live' + a clean, simple IA"
status: ready
class: M
priority: P1
owner: —
implements: owner's full-picture directive 2026-07-12 (be the leader/ideologue — SEE it fully, drive it) — the systemic reform
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - docs/architecture/ARCHITECTURE-REGISTRY.md
---
**The synthesis (owner's ~13 points → 3 roots).**
- **ROOT 1 — Bounded-Element Law not universal:** chrome not fully contract-configurable · right-dock page-config misplaced + shows foreign params · filter items not selectable · section view-toggle broken · drop-3rd composition incomplete · styles/events not per-element authorable · logic mixed with visual. → *not every element is consistently a bounded object where select → see+edit ONLY its own contract, live.*
- **ROOT 2 — Shell disorganized + over-complex:** Studio surfaces not canonically arranged (some should merge/move/disappear); too complex to find things (even the owner). → *the IA (where-things-live) is incoherent; power without simplicity/discoverability.*
- **ROOT 3 — plain broken:** section toggle · filter selection · drop-3rd.

**Ideologue thesis (the ONE principle that solves all three):** *"Select anything → see + edit ONLY its declared contract, live" — UNIVERSAL* (element·chrome·filter·section·page·style·event) **+ a clean IA with progressive disclosure** (simple by default, power on demand). Bounded-Element Law made into the WHOLE UX. Reference: Figma/Framer (select→contextual props) · Webflow (clean IA) · Notion (progressive simplicity). SURPASS: statistics-grade AND non-programmer.

**Bold plan — visible-first, ordered by felt-impact:**
- **P0 — fix the BROKEN (immediately visible):** section view-toggle · filter-element selection (BE-4/0062) · drop-3rd composition.
- **P1 — right dock purely CONTEXTUAL:** page-config ONLY when page/nothing selected; every element shows ONLY its own params (owner #3).
- **P2 — simplify the Studio IA:** merge/remove surfaces; make "where what lives" obvious.
- **P3 — universal contract-editing:** chrome · per-element StyleField (BE-2/AR-11) · events (`on[]`/dataLinks) authorable from the panel.
- Deferred: dark-mode colours (owner said not now).

**ROOT-CAUSE found (P0 · section toggle):** the authoring canvas is a TWO-LAYER model (`CanvasView`): Layer 1 (`.canvas-layer--renderer`) is `pointer-events:none`; Layer 2 (`.canvas-overlay`) owns ALL interaction (clicks → SELECT via `.canvas-node` frames, `canvas.css`). So the rendered section's `.section__view-toggle` (wired to `setActiveRole`) is **architecturally unreachable** — the overlay intercepts every click for selection. This is the SAME class as the perspective switch (surfaced to the CanvasToolbar). **Fix options (needs LIVE verify):** (a) raise the toggle above the overlay (z-index + pointer-events opt-in) and reconcile with the overlay's select region; or (b) an authoring-chrome view-toggle affordance on the selected section. Decide via the "operate-vs-select" UX (Figma: a selected element's own controls become operable). NOT ship-blind — the two-layer hit-test must be proven on :3013.

**DoD (each sub-item VERIFIED live on :3013, visible-first):** the owner opens :3013 and SEES it work — no buried features, no blind CSS. Every fix deployed + confirmed by a real click.

**Notes** — This is the master reform card (owner-originated). Drive P0 first (broken = immediately visible), one bold slice → one deploy → owner reacts. Reformed working model: experience-first (not code-first), visible-by-default (not buried), tight vision→visible→feedback loop.
