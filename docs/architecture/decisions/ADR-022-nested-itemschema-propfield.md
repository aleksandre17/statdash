---
title: Additive PropField.itemSchema — the nested-item authoring seam
status: Accepted
date: 2026-07-10
authors: engine-specialist
extends: SPEC-deep-authorability (D7), AR-49 (metric-first authoring), Constructor C0 fitness (FF-SCHEMA-COMPLETE / AssertSchemaCovers)
---

# ADR-022 — Additive `PropField.itemSchema` nested-item authoring seam

**Status:** Accepted (D7.0 — engine seam only; the nested editor UI is D7.1, backlog drain D7.2).

## Context

The Constructor renders a node/panel/chrome property panel GENERICALLY from its
co-located `PropSchema` (a `PropField[]`) — one Inspector, no per-type form (OCP).
This is complete at **breadth**: every placeable's top-level props are inspectable
(FF-SCHEMA-COMPLETE, `schema-completeness.fitness.test.ts` + the compile-time
`AssertSchemaCovers`). It is NOT complete at **depth**.

`PropField` (`packages/core/src/config/prop-schema.ts`) carries `type`, `options`,
`source`, `showWhen`, `coverage`… but had **no way to describe the shape of an
item inside an `array`/`object` field**. So `FieldControlRegistry` resolves an
`array`/`object` field to a single OPAQUE control — a raw-JSON `<textarea>`
(`JsonControl`). An author cannot reach an individual `kpi-strip.items[i]`,
`hero.cards[i]`, `stats-carousel.slides[i]`, `table.columns[i]`, chart axis, link,
crumb, or gauge step through a structured control; they must hand-edit JSON. This
is the last authorability gap: 13 fields, all enumerated in the shrinking
`SCHEMA_TODO` backlog, whose `isOpaqueNested()` predicate **already keys off
`'itemSchema' in field`** — the codebase pre-reserved this exact seam name and
shape. `KpiStripNode.ts` names the fix verbatim: *"a core `PropField` widen + a
panel array-item resolver."*

The full converged design is `docs/architecture/proposals/SPEC-deep-authorability.md`
(§2, §8). This ADR formalizes the **engine change** (D7.0); the generic recursive
nested editor (`ArrayOfControl`/`ObjectControl`, drill-in/breadcrumb) is D7.1 in
`apps/panel` and needs no further engine change.

## Decision

Add **three OPTIONAL fields** to the existing `PropField` interface in
`packages/core` (the SSOT; re-exported unchanged through `@statdash/react/engine`
via `slice-meta`):

```ts
export interface PropField {
  // …existing…
  itemSchema?: PropSchema        // per-ITEM schema (array) / object-field schema (object)
  itemLabel?:  string            // dot-path into an item used as its list display title
  itemGroups?: PropertyGroup[]   // item-level accordion groups (mirrors PropertyGroup)
}
```

- `itemSchema` present ⇒ the `array`/`object` field is a STRUCTURED nested
  container, authored item-by-item via the recursive nested editor. Recursive: an
  `itemSchema` sub-field may itself carry an `itemSchema` (arbitrary depth).
- `itemSchema` absent ⇒ the field is OPAQUE and gracefully falls back to the
  existing `JsonControl`. **Every current config is byte-identical and un-migrated.**

**Wire bridge (lossless round-trip).** `propSchemaToSubSchema`/`propSchemaToJsonSchema`
(`packages/react/src/engine/propSchemaToJsonSchema.ts` — the emitter
`generatePageConfigSchema` uses) gains a recursion in `buildProperty`: a field
WITH `itemSchema` emits a proper `items` sub-schema (array) or `properties`
(object) instead of a bare `{type:'array'}`/`{type:'object'}`. WITHOUT `itemSchema`
the emission is unchanged. Recursion is free — `propSchemaToSubSchema` calls back
into `buildProperty`, so nested `itemSchema` descends to arbitrary depth.

**Path plumbing already exists.** `prop-path.ts` `getAtPath`/`setAtPath` treat a
numeric segment as an array index for BOTH read and write, so the nested editor's
deep dot-paths (`items.0.value.measure`) resolve with ZERO new path machinery.
Proven in `prop-path.test.ts` (read/write parity, immutability, on-demand
container creation).

**Detector is a forcing function.** `isOpaqueNested()` uses a runtime `'itemSchema'
in field` check on the actual field object — so adding the optional TYPE field
changes NOTHING for existing metas (no meta populates the key yet); `SCHEMA_TODO`
is unchanged and green. The moment a meta (D7.2) populates `itemSchema`, that field
stops being opaque and the fitness `stale` check FORCES its removal from the
allowlist. A visible, shrinking backlog, not a hope.

## Why an additive field on `array`/`object`, NOT a new `PropFieldType`

- `isOpaqueNested()` already tests `'itemSchema' in field` and keys off the
  *existing* `array`/`object` types — the codebase pre-committed to the additive
  shape. A new type would fork every existing `array`/`object` meta and break that
  predicate.
- A field *without* `itemSchema` stays valid and gracefully falls back to JSON —
  zero migration, zero blast radius. New capability = a populated optional field;
  `PropField`, `SliceMeta`, `NodeRegistry`, and `Inspector` interfaces are
  UNCHANGED (Law 8 / OCP).
- It keeps **one** authoring vocabulary (`PropSchema`) at every depth, rather than
  importing JSON Schema `items` (rejected alt D).

## Rejected alternatives (full ceremony)

- **(A) Bespoke per-item editors** (`KpiItemEditor`, `HeroCardEditor`, …).
  *Rejected:* violates the one-Inspector / OCP mandate; N editors to build and
  maintain; a new nested type needs new UI — the exact anti-pattern the
  schema-driven Inspector was built to kill.
- **(B) Status quo — raw-JSON textarea.** *Rejected:* not authorable by
  non-programmers, zero discovery, error-prone; fails the 100%-authorable
  invariant. This is the defect being fixed. (Retained ONLY as the honest fallback
  for genuinely free-form bags — `OPAQUE_BY_DESIGN`.)
- **(C) New `PropFieldType` `'array-of'`/`'object-of'`.** *Rejected:* forks the
  `array`/`object` types, breaks every existing meta and the `isOpaqueNested`
  predicate (which already keys off `'itemSchema' in field`), and gives a field no
  graceful opaque fallback. Additive property = smaller blast radius, OCP-cleaner,
  pre-committed by the codebase.
- **(D) Adopt JSON Schema `items` wholesale for nesting.** *Rejected:* the
  platform's authoring vocabulary is `PropSchema` (richer: `enum-ref`+`source`,
  `coverage:'localized'`, `showWhen`). `itemSchema = PropSchema` keeps ONE
  vocabulary at all depths; `propSchemaToSubSchema` already bridges to JSON Schema
  at the *wire* boundary. Forking the vocabulary at depth would split the model.

## Consequences

- **Positive:** any typed nested array/object becomes structurally editable by
  populating one optional field; one generic recursive editor (D7.1) serves all
  depths; the wire schema is lossless at depth; `SCHEMA_TODO` gains a real forcing
  function toward `SCHEMA_TODO === {}`.
- **Trade-off named (ISO 25010):** buys *usability* (deep authorability) +
  *maintainability* (one generic editor) at a small *complexity* cost in the
  nested editor (D7.1) and, when consumers exist, coverage recursion. Reversible
  (additive) → **not a one-way door**: a stored config with no `itemSchema`-authored
  nested value is byte-identical before/after.
- **Deferred (deliberately out of D7.0 scope):** the generic nested editor
  (`ArrayOfControl`/`ObjectControl` + drill-in/breadcrumb) — D7.1; draining
  `SCHEMA_TODO` field-by-field (`kpi-strip.items`→`KpiSpec`, `hero.cards`→…) — D7.2;
  `validateConfig`/`AssertSchemaCovers` depth-recursion — lands WITH its first
  consumer in D7.1/D7.2 (no consumer exists at D7.0, so building it now would be
  speculative machinery — YAGNI). The seam is the contract everything above
  depends on and is got right once, here.

## Invariants honored

- **Dependency arrow (Law 3):** `itemSchema` lives in `packages/core` (importable
  by all); the wire bridge in `packages/react`; editors in `apps/panel`. No upward
  import; the arrow does not bend.
- **Config is data, logic in the renderer (Law 2):** `itemSchema` is pure data (a
  nested `PropSchema`), Constructor-serializable; no functions/`fetch`/`eval`.
- **OCP (Law 8):** new nested type = a populated optional field; interfaces
  unchanged.
- **FF-SCHEMA-COMPLETE preserved:** `SCHEMA_TODO` and `AssertSchemaCovers` are
  unchanged and green this phase; the detector now has a live forcing function.
