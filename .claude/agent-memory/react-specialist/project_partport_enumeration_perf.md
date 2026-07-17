---
name: partport-enumeration-perf
description: Measured verdict on the ADR-041 Part-port whole-tree enumeration (partFieldsOf + CanvasOverlay frameNode) — LINEAR, plus the constant-factor optimizations deliberately NOT applied
metadata:
  type: project
---

The Part-port whole-tree enumeration (`partFieldsOf` + `valueParts`/`slotParts`, enumerated once per node by `apps/panel` `CanvasOverlay.frameNode` recursion + the transitional `walkNodes` fallback) is **LINEAR, no pathology**. Measured 2026-07-12 by the perf fitness `packages/react/src/engine/partPort.perf.fitness.test.ts`.

**Numbers:** whole-tree enumeration of a ~5,400-node synthetic page ≈ 12-17ms pure (min-of-7), ~2.7µs/node; doubling nodes costs ~2.0-2.5× (never ~4×). Deterministic guard: enumeration output scales EXACTLY 2× per node doubling; wall-time gate at 3.0× per doubling (linear target ~2.2×, gate loosened for flake margin — a false-red perf gate is worse; the exact guard is the output-scaling assertion).

**Why:** the lead flagged this as an unmeasured O(nodes×depth) risk before AR-42's interaction fan-out amplifies enumeration FREQUENCY. Verdict: complexity is fine; frequency is the AR-42 concern.

**How to apply — constant-factor optimizations FLAGGED but deliberately NOT applied** (port is already linear, so scope said no source edit). When AR-42 makes enumeration hot, these are the reversible wins, in order:
1. `partFieldsOf(meta)` is re-derived (fresh array alloc) per node though it's invariant per `meta` object → WeakMap-memo keyed by meta.
2. `valueParts.enumerateParts` re-builds a projected single-field `PropSchema` per value-band node → hoist/cache the projection per PartField.
3. The tree is walked ~2× (port `frameNode` recursion + the `walkNodes` fallback in `CanvasOverlay`). The fallback is a Strangler remnant removed "in a later contract phase once every container child is a declared slot part" — retiring it drops the second full traversal.
4. **The real super-linear risk is NOT the pure path:** `CanvasOverlay.frameNode` does a `rootEl.querySelector([data-part-node-id=…])` per node → O(nodes × DOM) ≈ quadratic in the DOM. Out of the pure fitness's scope (no DOM). If AR-42 selection/render churn shows jank, batch the anchor lookups (one `querySelectorAll` → Map by id) BEFORE touching the pure enumeration.
