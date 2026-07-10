---
title: One Type System, One Tree, Two Residences — ObjectMeta + kind-as-facet
status: Accepted
date: 2026-07-10
authors: engine-specialist
extends: SPEC-rendering-core-object-model.md (Fable study 1), MASTER-PLAN-canonical-rearchitecture.md (object-model track R0/R1), ADR-022 (itemSchema value band)
supersedes: nothing — reframes the 5-tier SliceMeta taxonomy as ONE ObjectMeta
---

# ADR-023 — One Type System, One Tree, Two Residences

**Status:** Accepted. This ADR is R0 (the decision + fitness scaffolds) and R1 (the
type-system unification) of the object-model track. R2+ (kpi-card promotion) is a
separate, owner-gated one-way door and is NOT decided here.

## Context

The rendering core has a **five-tier plugin taxonomy** — `node` / `page` / `panel` /
`chrome` / `control` — expressed as five META shapes (`slice-meta.ts`) discriminated
on `sliceType`. But the fragmentation is not "five mechanisms":

- **F1** — `registerSlice.ts` already collapses `node`/`page`/`panel` into ONE
  `nodeRegistry`; page-ness (`rootOnly: true`) and panel-ness (`canHaveChildren:
  false`) are already *literal-pinned facets*, illegal states unrepresentable. So
  "kind is a facet" is already the design for the node tier.
- The real debt is **three registries** (`nodeRegistry` / `chromeRegistry` /
  `filterControlRegistry`), **two composition mechanisms** (`SlotDef` tree slots vs
  `ChromeSlot` positional resolution), and **one unregistered tier** (nested items
  are plain data with no type identity).
- **F2** — nested items (`KpiSpec`) re-invent node facets per shell, ad hoc
  (`id` + `when` + `color` + own value data), duplicating the render pipeline in
  miniature. This is the growth-vector DRY violation.
- **F3** — `sliceType` NEVER touches the wire; the config is already a uniform typed
  object grammar (`type` discriminants at every depth). So the fix is
  **engine-internal only — zero config migration**.

The commissioning question (owner): "we're building a SYSTEM — everything composable
should be its own type, edited uniformly." The tension: uniform vs semantic honesty.

## Decision

Adopt **One Type System, One Tree, Two Residences** (the intersection of Figma
kind-as-facet, Puck residence-at-the-composition-site, Sanity one-schema-registry,
Grafana/Vega statistics-grade value band):

1. **One Type System — `ObjectMeta`.** Collapse the five META shapes into ONE base
   whose kinds are **refinements** (`slice-meta.ts`):
   ```ts
   type PageSliceMeta     = ObjectMeta & { sliceType:'page';  type:string; rootOnly:true }
   type PanelSliceMeta    = ObjectMeta & { sliceType:'panel'; type:string; category:SliceCategory; canHaveChildren?:false }
   type NodeSliceMeta     = ObjectMeta & { sliceType:'node';  type:string }
   type ChromeSliceMeta   = ObjectMeta & { sliceType:'chrome'; slot:string; key:string; label:LocaleString; defaultRegion:string; defaultOrder:number }
   type FilterControlMeta = ObjectMeta & { sliceType:'control'; controlType:string; label:string; dimension?:string }
   ```
   "Kind" is a **pinned facet**, not a fifth mechanism. The facet vocabulary is
   *shared* (Figma-mixin style); refinements pin the illegal-state facets where
   they are load-bearing.

2. **One registry — `objectRegistry`.** A single, kind-agnostic type-descriptor
   registry (`objectRegistry.ts`). `registerSlice` feeds it through **one
   unconditional ingestion path** for every kind; the three legacy registries stay
   as **typed behaviour stores** (renderers / shells / codecs) keyed by the same
   identity. Discovery (the Constructor palette, capability queries) browses ONE
   registry. Responsibility split (ISP · Grafana canon): `objectRegistry` = *which
   object types exist* (serializable descriptors); behaviour stores = *how to render
   / encode* (non-serializable behaviour).

3. **One Tree, Two Residences — residence is a property of the composition site**
   (Puck's law): a **slot** (`SlotDef`) holds node instances (tree band); a **field
   with `itemSchema`** (ADR-022) holds typed values (value band). Both are canonical
   and retained — the value band is a feature every reference platform keeps, not a
   stopgap.

4. **The Promotion Law** (decided as principle here; *applied* in R2+): an element
   belongs in the tree band iff it carries **≥2 node facets** {identity, visibility
   expression, per-item style/variant, own DataSpec, RBAC, independent reorder}.
   At/above the threshold, a value re-inventing those facets is forbidden — it must
   be a registered node type. Below, it is a value (`itemSchema`).

## What R1 changes (this step) — and what it does NOT

**Changed (engine-internal, byte-identical, alias-reversible):**
- `ObjectMeta` introduced; the five META names are now derived refinements
  (re-exported under the same names — every import site byte-identical).
- `objectRegistry` + `normalizeObjectIdentity` added; `registerSlice` ingests every
  kind through the one path (before behaviour routing).
- Six fitness functions established (see below).

**NOT changed (the reversibility boundary):**
- **No config / wire change.** `sliceType` never serializes (F3); no stored page
  field changes. `PageConfigBase` / `NodeBase` untouched. Proven by the existing
  `roundtrip-pages.fitness.test.ts` (byte-identical round-trip) staying green.
- **No promotion.** `kpi-card` / `hero-card` are NOT node types yet (R2/R3, owner
  one-way doors D-ROM-2/3). Pinned by FF-PROMOTION-LOSSLESS.
- **No behaviour-store merge / no contract.** The three registries keep their exact
  lookup signatures; nothing is removed. R1 is Strangler **expand** only.

## Alternatives rejected

- **ALT-A — Node maximalism** (everything a tree node). Rejected: promotes
  projections (12 table columns → 13 nodes of outline noise), destroys the
  statistical grammar's spec locality (Vega/Grafana counter-canon), violates Law 4
  grammar minimality; Builder.io deliberately chose `subFields`. Uniformity of
  *mechanism* ≠ uniformity of *residence*.
- **ALT-B — Status quo** (5-tier + itemSchema everywhere). Rejected: facet
  reinvention (F2) is unchecked and growing; three capability surfaces the
  Constructor must browse; the owner's system-question stays unanswered.
- **ALT-C — Schema-only unification** (extend itemSchema, never touch registries).
  Rejected as symptom patch: leaves chrome/control types un-browsable in the one
  palette and the duplicate `kpiVisible`-style seams alive.
- **Physical behaviour-store merge in R1** (one heterogeneous `Map` of
  renderers+shells+codecs). Rejected for R1: the three behaviour contracts are
  genuinely different ( `(def,ctx,children)=>ReactNode` vs `()=>ReactNode` vs a
  rich codec slice); a single Map regresses to stringly-typed heterogeneous values
  with casts at every read — trading *type* fragmentation for *type-safety* loss
  (Law 6 / ISP). The canonical answer is behaviour side-tables keyed by object
  identity, which lands with R2/R4 when a promotion actually needs it. R1 unifies
  the **type system + discovery**, which is the keystone R2 builds on.

## Reversibility strategy (the point of R1)

R1 is fully reversible: revert `slice-meta.ts`, delete `objectRegistry.ts` + the one
`objectRegistry.register(…)` call in `registerSlice.ts` + the three barrel line-adds
(`types/slice.ts`, `types/index.ts`, engine `index.ts`). No config, no stored data,
no behaviour store touched. The five META names remain thin aliases over the unified
base throughout — consumers never see the change.

## Fitness functions (invariants)

Real at R1 (`object-model.fitness.test.ts`, react/engine):
- **FF-ONE-TYPE-SYSTEM** — one `objectRegistry` ingestion path; every kind is a
  refinement of `ObjectMeta` (compile-time assignability); the engine registry set
  is frozen (a new kind = a facet, never a 4th parallel type registry).
- **FF-KIND-IS-FACET** — kind facets are literal-pinned refinements (page `rootOnly`,
  panel `canHaveChildren` — illegal states unrepresentable, `@ts-expect-error`
  pinned); NO `sliceType` branching outside the registry-view layer (renderNode is
  zero — locked).

Scaffolds (assert current state honestly; harden at R2–R4):
- **FF-ONE-COMPOSITION-GRAMMAR** (R4) — `SlotDef` is the one tree-band grammar; the
  single known second mechanism (chrome positional resolution) is allow-listed and
  becomes `[]` when R4 folds chrome into `SlotDef`.
- **FF-NO-FACET-REINVENTION** (R2/R3, `object-model-residence.fitness.test.ts`,
  plugins) — no value-band `itemSchema` aliases a reserved node facet (visibility
  expression). The lone pending offender (`kpi-strip`'s `when`) is allow-listed;
  flips to a hard `[]` gate at R2-contract.
- **FF-TWO-RESIDENCES-ONLY** (R3) — both residences are live in the corpus (not
  collapsing to one).
- **FF-PROMOTION-LOSSLESS** (R2) — no promotion has leaked into R1 (`kpi-card` /
  `hero-card` are not node types); becomes the DOM-parity gate at R2-expand.

## Consequences

- The Constructor gains one capability-discovery surface (`objectRegistry`) spanning
  all kinds — the palette taxonomy R2 promotions register into.
- Minor deliberate trade: the shared facet vocabulary slightly *widens* the optional
  surface of chrome/control/page/panel metas (they may now carry unused optional
  facets). This is the intended one-type-system design (Figma mixins); the
  load-bearing illegal-state pins (`rootOnly`, `canHaveChildren`) are preserved.
- Owner one-way doors remain held: D-ROM-2 (kpi-card contract), D-ROM-3 (hero-card),
  D-ROM-4 (chrome residence / R4). R1 removes the urgency of all three by delivering
  every kind into the one type system now.
