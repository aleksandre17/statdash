---
name: project-grammar-of-interaction
description: AR-42 Grammar of Interaction SPEC — interaction = declared relation between Parts (ADR-041) on the existing cross-filter spine; 3 primitives not 4; generalizes AR-38 via op:directional
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-grammar-of-interaction.md` (I authored, 2026-07-12, AR-42). Decision-grade, no code. Lead-championed; owner to bless.

**Core thesis:** an interaction is a **declared relationship between Parts** (ADR-041 address space) — a gesture on Part A writes a shared Param, Part B references it. NOT new plumbing: statdash already implements the field's converged trio at the NODE level.

**The minimal primitive set = THREE, not four** (field convergence: Vega-Lite `param`+`selection`+`condition`; Grafana variables; Superset cross-filter):
1. **Param** — named state; our filter-param/`vars` SSOT (URL-permalink). EXISTS.
2. **Selection** (emit) — our `NodeBase.on[]` → `useNodeInteractions.emit` → `applySelection` → ONE CommandBus point (`filter:set`/`setMany`). EXISTS at node level; GENERALIZE to Part (emit carries `PartAddress`, enumerated via `enumerateParts`).
3. **Reference** (read) — our `{$ctx}`/`{$ref}` via `resolveRef` in query-filter + encoding (`resolveEncodingRefs`, AR-36) + pipe (`resolvePipeRefs`). EXISTS.
The brief's "**Link**" is NOT a 4th primitive — it is Selection∘Reference over a shared Param (Observer-as-data); surfaces only as authoring SUGAR (`LinkDef`) that lowers to the triad. A first-class Link runtime = rejected (forks the spine).

**Action = discriminated union, OCP** (`NodeAction`, today only `FilterAction`): add `HighlightAction` (transient param, no requery), `PivotAction` (AR-36), `ScopeAction` (re-base, composes AR-50 `MetricInput.at`), `DrillAction` (fold existing `dataLinks` navigate). New capability = new arm.

**AR-38 Strangler proof (the retirement):** AR-38's emit+consume already generic; the ad-hoc part = SIX hand-authored `vars` derives (`_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir`, nested `op:if` sector-priority truth-table). Collapse to ONE dim-blind var op `{op:"directional",focus,co,priority,emit:"axis"}` → pure `resolveDirectional` in core returning the identical assignment, riding `evalVarMap`/encoding/pipe seams, zero new plane. A/B/C/D matrix byte-identical, old derives Strangler-deleted after parity.

**Phases:** P0 name · **P1 widen Action union + `interval:brush` trigger + `applySelection` interval mode** (additive, packages/react+core) · **P2 `op:directional` (recommended first slice — Strangler proof, zero ADR-041 dep, provisioning+1 op)** · P3 Part-level emit source (`usePartInteractions`, **depends on ADR-041 Phase 2 adapters**) · P4 `LinkDef` sugar + Constructor UI (port-projected palette). Only latent one-way = later demote node-level `on[]` → Part-only (NOT in plan; gate like ADR-023 R2).

**Interplay verdict:** AR-40 (semantic layer) PRECEDES and already LANDED — the governed substrate. AR-41 (reactive dataflow) does NOT precede — orthogonal Consumer-recompute optimization, YAGNI until linked-view fan-out has a measured perf need. AR-42 is the right next VOCABULARY epic; bless P1+P2 now.

**Key seams (code-grounded):** `packages/react/src/engine/node-events.ts` (`NodeAction`/`FilterAction`/`ActionField=string|CtxScopeRef`) · `useNodeInteractions.ts` (the ONE adapter) · `packages/core/src/data/applySelection.ts` (reducer) · `ref/ref.ts resolveRef` (ctx/param/row/var/dim dispatcher) · `commands.ts` (`filter:set`/`setMany`/`nav:drill`) · `partPort.ts` (ADR-041 address space). See [[project-cross-filter-capability]] (READ works, WRITE port), [[project-root-concept-foundation]] (Part port), [[maximal-orthogonality]].
