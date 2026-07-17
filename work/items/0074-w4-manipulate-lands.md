---
id: "0074"
title: "W4 — MANIPULATE LANDS: ADR-042 Slices 1–2 (one dnd-kit transport · placePart on every surface · keyboard move) + dead-strata sweep"
status: BLOCKED on 0073 (⚠️ contains the owner-GO one-way transport flip)
class: M
priority: P0
owner: — (senior/apex build agent, Opus)
implements: ADR-042 D2 (the designed-but-unbuilt Manipulate projection) per STUDY-authoring-canon-circle-break §F5/§W4
depends_on: ["0073"]
links:
  - docs/architecture/decisions/ADR-042-authoring-triprojection-and-placement-port.md   # §The first buildable slice + §9 plan — build as accepted
  - docs/architecture/proposals/STUDY-authoring-canon-circle-break.md
---
**Intent.** The third projection finally reaches the author's hands: move/nest/reorder on the CANVAS (today `moveNode` exists only in the outline; the canvas is insert-only; two drag dialects coexist — the felt "hard coupling in UI").

**Scope (per ADR-042, already accepted — this card is delivery, not re-design).** Slice 1: ONE dnd-kit transport spanning canvas+navigator+palette (native `dataTransfer` path deleted — ⚠️ the flagged ONE-WAY step, owner GO before the delete); Slice 2: `placePart` drives canvas drag-to-move/reparent via the ONE `PlacementPlan` (OutlineTree's heuristic deleted, byte-identical plan shared); keyboard-only move end-to-end (Law 9). **Rides along (G10 housekeeping):** delete `FilterBarControlsBridge` + its keeper fitness; collapse the `walkNodes` fallback onto recursing `enumerateParts` (gated by FF-COMPOSITE-INTEGRITY).

**Hard boundaries.** Residence-routed adapters, never type-keyed (ADR-041 law). Every ADR-042 manipulation FF lands with its slice (`FF-ONE-PLACEMENT-GRAMMAR`, `FF-ONE-DRAG-TRANSPORT`, `FF-CANVAS-KEYBOARD-MOVE`, `FF-EVERY-PART-ANCHORED`, `FF-PLACEMENT-PLAN-TOTAL`). Reversible until the flip; the flip only on owner GO + green journey walk.

**DoD.** **Journey J3 re-walked live WITH restructuring** (drag a block between sections on canvas, keyboard-move it back, reorder in navigator — one transport, one plan) · suite green · deployed · owner shown.
