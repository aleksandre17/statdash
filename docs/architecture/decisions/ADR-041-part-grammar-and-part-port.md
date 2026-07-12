# ADR-041 — The Part Grammar + the Part Port (object-model foundation, ROOT-1..4)

**Status:** ACCEPTED (owner GO, 2026-07-12). **Decision authority:** owner (near-one-way-door, chose Option A · D-F2 retire shadow-promotion · D-F3 port-first).
**Extends (never forks):** ADR-038 (The Bounded Element Law — governing; this settles its missing root) · ADR-039 (Bounded-Element Selection Projection — its Composite address is completed here; BE-4's `BandSource` becomes the first adapter of the root, one layer down) · ADR-023 (One Type System, One Tree, **Two → N Residences** — extended, not contradicted).
**Source of truth:** `docs/architecture/proposals/SPEC-object-model-foundation-diagnosis.md` §5 (ROOT-1..4) + §6 (the accepted decision).
**Executable plan:** `docs/architecture/proposals/PLAN-part-grammar-strangler-build.md` (the phased, gated Strangler-Fig build).

---

## Context — the diagnosis in one paragraph (why this ADR exists)

The platform is **under-built at the root and over-built one level above it, causally linked.** Exactly ONE root concept was never laid down as a first-class primitive: the relation *"this element HAS CONSTITUENT PARTS."* Because that root was missing, containment grew **four parallel grammars** — tree slots (`SlotDef`), props value-bands (`PropField`+`itemSchema`), sourced bands (`META.band`+`BandSource`), chrome regions (positional) — each with its own enumeration, address, write path, validation, and anchor. On top of them grew **three selection species** (`selectedNodeId` · `selectedItemPath` · `chromeSelection`), **two anchor mechanisms** (`BandItemBoundary` vs the canvas node-anchor middleware), and **two competing theories of the KPI card** — ADR-023's promotion-to-node (`kpi-card` slice + `kpiSpecToCardNode` + `promotionMode`, flag-dark) AND ADR-038/039's generic band selection (BE-1, live, e2e-verified) — both in-tree at once. Every BE-x was a locally-lawful bridge (generic, declared, fitness-gated) and a globally-visible symptom: the model asking the same question — *"what are this element's parts?"* — once per grammar, forever. That is the circle.

The owner's recurring **wrapper-vs-single-element** intuition is essential and canonical (it is the Composite pattern itself), but today it is smeared across five disagreeing signals (`sliceType`, `canHaveChildren`, `slots`, `array+itemSchema`, `META.band`) — which is exactly why he cannot place it (`kpi-strip`: kind says LEAF, contract says WRAPPER).

---

## Decision — adopt ROOT-1..4 (Option A)

Adopt the four root concepts. Three exist (one whole, two in fragments); one is new. **Everything else in the platform becomes a projection of these four.** Net concept count goes DOWN (~9 containment-adjacent moving parts → ~4).

### ROOT-1 — **Element** *(exists — keep verbatim)*
A registered `(type, variant)` identity with ONE declared contract (`ObjectMeta`) in ONE discovery registry (`objectRegistry`). Built by ADR-023 R1. Unchanged.

### ROOT-2 — **The Part grammar** *(exists in four fragments — unify)*
**An element's contract declares its PARTS as fields.** A *part field* states, per field: what the parts are (their per-part contract), what it accepts, and — the load-bearing correction — **where the parts reside**. **The residence-at-field law:** residence is a property of the **composition SITE (the field)**, never of the node (Puck's law, which our own ROM spec already cites). One grammar, N residences:

| Residence (closed set, extensible) | Parts are… | Today's fragment (becomes a surface form) |
|---|---|---|
| `slot`    | node instances of registered types (accepts-gated)                             | `SlotDef` (already carries `field:`) |
| `value`   | typed values on `node.props` (per-part contract = `itemSchema`, homogeneous)     | `PropField` `array + itemSchema` (ADR-022) |
| `sourced` | projections of an external SSOT (per-part contract resolved by the adapter, e.g. `getParamSchema`) | `META.band` (`BandDescriptor`) + BE-4 `BandSource` |

`SlotDef`, value-`PropField`, and `BandDescriptor` become **three surface forms of ONE `PartField`** — unified via ALIASES / re-exports, so **every import site stays byte-identical** (the R1 alias discipline, already proven). Chrome regions fold in later as a `slot`/`sourced` adapter of a `site-frame` element (ROM R4, still deferred).

**Wrapper/leaf as a derived predicate** *(the owner's intuition, given ONE home)*: **WRAPPER ⇔ the contract declares ≥1 part field; SINGLE ELEMENT ⇔ it declares none.** One question, one place to look. `canHaveChildren` / panel-leafness become *derived* predicates; compile-time pins may remain as refinements, but **no mechanism reads the KIND (`sliceType`, `canHaveChildren`) to answer a containment question** (FF-DERIVED-CONTAINMENT). ROM's "Two Residences" is hereby extended to **One Type System · One Tree · One Part Grammar (N declared residences)** — BE-4 had de-facto already added the third residence; the model catches up with its own reality.

### ROOT-3 — **The Part port** *(the missing primitive — add)*
ONE engine-level interface every authoring / validation / lineage / overlay / inspector mechanism recurses over — the generalization of BE-4's app-level `BandSource` to "ALL parts, engine-level." Signature (scaffolded, types-only, at `packages/react/src/engine/partPort.ts`):

```
enumerateParts(element, partField, ctx) → EnumeratedPart[]   // { address, contract, subject, residence }
writePart(element, address, subfield, value, ctx) → PartMutation | null   // residence-tagged (BandMutation, KEPT)
```

- **One address grammar:** `(nodeId, partPath?)` — ADR-039's Composite address completed. Whole-node = `partPath` undefined; a slot part is reached THROUGH the enumeration as the child's own nodeId; a value/sourced part by its `${field}.${index}` path. The **selection triple collapses to one** `PartAddress`.
- **One anchor:** `BandItemBoundary` and the canvas node-anchor middleware merge into ONE part-anchor contract (same `display:contents` technique, one implementation).
- **Adapters, not bridges:** `slotParts` (walks `children` by the declared slot) · `valueParts` (= BE-1 `bandItemsOf`) · `sourcedParts` (= BE-4 `filterSchemaBandSource`, staying app-level where it touches an app SSOT — the PORT is engine; adapters live with their residence). **BE-1 / BE-4 / BE-5 fall out as ONE mechanism** (KPI card = `valueParts` of kpi-strip's `items`; filter control = `sourcedParts` of filter-bar's page-filters; section children = `slotParts` gated by `accepts` — `FF-COMPOSITE-INTEGRITY` becomes the port's validation projection). **The actual test:** the NEXT kinds (hero cards, table columns, repeat instances, chrome items) are **declarations only** — no new bridge.

### ROOT-4 — **Facet** *(exists — keep; one reframe with teeth)*
Capabilities and kind refinements as declared opt-ins (`caps`, `rootOnly`, variants, chrome/control identity). The reframe: **the Promotion Law becomes a RENDER-side law only** (D-F2). Authoring reach is residence-independent under ROOT-3 (any part is selectable / authorable wherever it lives), so promotion is **never again justified by authorability** — only by render-pipeline facets (own DataSpec routing, per-part RBAC, error boundary, `renderNode`-level visibility). This resolves the two-theories fight: **BE-1 stays as THE authoring answer; the `kpi-card` shadow promotion is retired** (D-F2, the owner's choice — see below).

---

## The owner's gates, recorded

- **D-F1 — adopt ROOT-1..4** as the foundation: **YES.**
- **D-F2 — the KPI card: RETIRE the shadow promotion machinery.** BE-1 band selection is THE answer. `kpi-card` slice, `kpiSpecToCardNode`/`cardNodeToKpiSpec`, `promotionMode`, and the `KpiCardShell`/`KpiCardNode`/`meta` promotion surface are removed on the **render side** (they were never wired live; the value-band path is the sole residence). The `kpiVisible` render seam is retired in favour of `renderNode`'s engine-level visibility gate (the promotion's one genuine render-facet win is preserved by moving `when` → `view.visibleWhen` on the value-band render path, not by keeping a second residence).
- **D-F3 — sequencing: PORT-FIRST.** Engine ROOT-3 lands first; BE-4's held (uncommitted) code re-homes as the first `sourcedParts` adapter one layer down. BE-4 was held uncommitted for exactly this reason — landing it under the port costs less than migrating it later.

---

## Alternatives rejected (≥2, per ADR practice)

- **Option B — Node-maximalism** (everything a tree node; promote all bands to nodes). *Gains:* one mechanism trivially. *Rejected:* counter-canon — Builder.io (`subFields`), Sanity (`of:[{type}]`), Grafana (`fieldConfig`), and Vega-Lite all deliberately keep a **value band**; grammar noise (12 table columns ⇒ 12 nodes of outline noise, destroying statistical spec-locality); **filter items cannot be nodes without forking the page `filterSchema` SSOT** (ADR-039 rejected-alt 1); config migration everywhere. Rejected THREE times now (ROM ALT-A, ADR-023 ALT-A, here) — still wrong. The insight it misses: uniformity of *mechanism* (type system, part grammar, address grammar) does not require uniformity of *residence*.
- **Option C — Status quo / keep bridging** (accept slots · value-bands · sourced · chrome as separate species; keep the kpi-card double answer dark). *Gains:* zero cost now. *Rejected:* the two languages (declaration vs authoring) persist; every next kind (table columns, chart encodings, repeat instances, hero cards, chrome items) re-asks *"what are this element's parts?"*; the two card theories stay unresolved in-tree; the owner's wrapper/leaf intuition stays homeless. This is the circle, chosen deliberately.
- **Physical behaviour-store merge / one heterogeneous parts map** (carried from ADR-023's rejected-alt). *Rejected:* the residences' write contracts are genuinely different (`node-props` vs `filter-schema` vs `node-children`); a single map regresses to stringly-typed heterogeneous values with casts at every read (Law 6 / ISP loss). The canonical answer is a residence-tagged mutation union + adapters keyed by residence, which ROOT-3 provides.

---

## Consequences

**Positive.** The circle ends structurally — every future "X isn't an object" is a **declaration**, not a bridge; the wrapper/leaf intuition gets ONE home; concept count drops; both SPECs and all three ADRs are extended, not forked; BE-1/BE-4/BE-5 become three adapters of ONE mechanism.

**Costs / trade-offs (ISO 25010 named).** A deliberate one-time engine re-seam (**maintainability +**, short-term **modifiability −** during the migration window). One genuine one-way step: the **final de-alias** (Phase 6 — removing `sliceType`/`canHaveChildren` *reads* as containment mechanisms once wrapper/leaf is derived), gated exactly like ADR-023's R2 contract step.

**Hard invariants (locked, verified against the code):**
1. **Zero config migration.** The stored `type`-discriminated tree is already uniform at every depth (ROM F3, ADR-023: `sliceType` never serializes). `PartField` and `band?` are META (registration-time), not wire; every `PartMutation` targets an existing store action. Proven ongoing by `roundtrip-pages.fitness.test.ts` staying green.
2. **Alias-reversibility until the final contract step.** `SlotDef` / `BandDescriptor` / value-`PropField` remain re-exported surface forms; import sites byte-identical through Phases 1–5. Only Phase 6's de-alias is one-way.
3. **Platform green after every phase.** Each phase is expand-only Strangler-Fig (Law 7); the existing tested platform migrates onto the root, never rewritten.

---

## Fitness functions (the invariants, as executable gates)

New (this ADR):
- **FF-ONE-PART-GRAMMAR** — ALL constituent enumeration flows through the Part port; no parallel discovery survives. (Scaffold at Phase 1 — asserts the port is the sole enumerator over the corpus; hardens as adapters land.) Home: `packages/react/src/engine/object-model.fitness.test.ts` (+ app-side counterpart).
- **FF-RESIDENCE-AT-FIELD** — residence is declared on the **field**, never on the node; no `PartField` omits its residence and no node carries a node-level residence flag once `META.band` migrates to the field. Home: engine fitness.
- **FF-DERIVED-CONTAINMENT** — no kind (`sliceType`) or flag (`canHaveChildren`) may **contradict** the declared part fields, and no *mechanism* reads the kind to answer a containment question; wrapper/leaf is a pure predicate of "declares ≥1 part field." Home: engine + plugins fitness. Hardens to a `[]` gate at Phase 6.

Kept green throughout (regression guards):
- **FF-COMPOSITE-INTEGRITY** (BE-5) — children ∈ declared `slots.accepts`; becomes the `slotParts` validation projection. (`apps/panel/src/canvas/compositeIntegrity.fitness.test.ts`)
- **FF-NO-EXTERNAL-SPECIAL-CASE** (ADR-038/039) — no composer/generic layer hardcodes a concrete element type. (`apps/panel/src/canvas/noExternalSpecialCase.fitness.test.ts`)
- **FF-FILTER-ITEMS-DECLARED-BAND** (BE-4) — the filter band is chosen by declared descriptor + registered adapter, resolved through `getParamSchema` + written through `setBarParams`. (`apps/panel/src/canvas/filterItemsDeclaredBand.fitness.test.ts`)
- **FF-ONE-TYPE-SYSTEM** / **FF-KIND-IS-FACET** (ADR-023) — one `objectRegistry` ingestion; kind is a facet, not a fifth mechanism.

Retired by D-F2:
- **FF-PROMOTION-LOSSLESS** — removed with the promotion machinery it guarded (there is no longer a second residence to prove byte-parity against; the value band is the sole residence).

---

## Delta 1 (2026-07-12) — the `sourced` address convention (decided at zero consumers)

**Context.** Phase 1 flagged a gap: `PartField.field` is required, but a `sourced` part (a filter-bar `band: { source: 'page-filters' }`) has only a `source`, and the band is still node-level (Phase 6 moves it onto a field). Phase 1 set `field = meta.band.source` as a documented *placeholder*. This is the address grammar Phase 2's `sourcedParts` adapter emits and Phase 3's selection-triple collapses onto, so it is settled NOW — while there are ZERO consumers (cheapest possible), an in-codebase, reversible call with no config impact.

**Decision.**
1. **`field` is the ADDRESS coordinate; `source` is the ADAPTER id — two distinct roles that may coincide today.** `PartField.field` stays **required** (one grammar — every part field carries an address coordinate; no optional-field special case for `sourced`). For a `sourced` part, `field` = the declaring-field handle of the band. While the band is node-level (Phases 1–5, exactly one band per node) that handle **coincides with `source`** (`'page-filters'`). At Phase 6 the band moves onto a real field: `field` gets its own name while `source` keeps naming the same registered adapter — a **rename behind the same grammar slot**, so no `PartAddress` changes shape. The Phase-1 "placeholder" framing is retired: `field = source` is the *decided* node-level convention, not a temporary hack.
2. **A dynamic sourced item is addressed by a STABLE KEY, not a positional index.** `PartAddress = (nodeId, partPath?)`; for a `sourced` part `partPath = ${field}.${key}` where `key` is the item's stable external-SSOT id (the filter `barId` / control key). Additive port refinement: `EnumeratedPart.key?: string` carries that coordinate (the `sourcedParts` adapter fills it; `value`/`slot` parts leave it undefined and address by positional `index` / the child's own `nodeId`). Result: a selected filter control has ONE stable `PartAddress` — `(filterBarNodeId, 'page-filters.<barId>')` — that survives reorder/insert in the page `filterSchema`.

**One grammar, three residences (the address table this settles):**

| Residence | `PartField.field` | `PartAddress.partPath` of one part | Coordinate kind |
|---|---|---|---|
| `slot`    | slot field (`'children'`) | *undefined* — the part IS the child node (`nodeId`) | node identity |
| `value`   | value-band field (`'items'`) | `${field}.${index}` | positional index (parts live in `node.props`) |
| `sourced` | declaring-field handle (`= source` today) | `${field}.${key}` | **stable key** (parts live in an external keyed SSOT) |

**Why (trade-off, ISO 25010).** Stability of reference (reliability +) — a filter selection keyed by `barId` cannot be silently rebound by a reorder, which a positional index would allow. Consistency (maintainability +) — one `${field}.${coordinate}` shape spans `value` and `sourced`; `slot` stays node-addressed because a slot part already IS a node (ADR-039's completed Composite address). Keeping `field` required (vs. making it optional for `sourced`) avoids a per-residence branch in every downstream address builder (ISP / one-grammar) at the cost of `field == source` redundancy during Phases 1–5 — paid down at Phase 6 by the rename, not by a schema change.

**Rejected alternatives (≥1, per ADR practice).**
- **Make `field` optional for `sourced` (address purely by `source` + key).** *Gains:* no `field == source` redundancy today. *Rejected:* it forks the address grammar — every consumer that builds a `partPath` (overlay anchor, selection collapse, inspector crumb, lineage) would need an `if (residence === 'sourced')` branch to fall back from `field` to `source`. That is exactly the per-residence special-case ROOT-3 exists to remove; the one-grammar law (`PartAddress = (nodeId, partPath?)`, `partPath = ${field}.${coordinate}`) is worth one field of transient redundancy.
- **Address a sourced item by positional index (mirror `value` exactly).** *Gains:* uniform `${field}.${index}`. *Rejected:* sourced items live in an external, independently-mutated keyed SSOT (the page `filterSchema` bars); a positional index rebinds a selection on any reorder/insert — a data-integrity defect (Law 9). The stable `key` is the correct coordinate for a keyed residence; `value` keeps `index` because its items are positional in `node.props`.

**Reversibility.** Additive interface field (`EnumeratedPart.key?`) + doc-decided convention on the existing `field = source` derivation; zero consumers, zero config, byte-identical runtime. Revert = delete `key?` + restore the "placeholder" comment. In-codebase, one-way risk: none.

---

## Delta 2 (2026-07-12) — Phase 5 landed: shadow-promotion machinery deleted (D-F2)

**Context.** Phase 5 of `PLAN-part-grammar-strangler-build.md` retired the render-side shadow-promotion surface. Reversibility gate first: grep confirmed NO live code path enabled promotion — `enablePromotion`/`withPromotion` were called only from the (now-deleted) `promotion-lossless.fitness.test.tsx`; `KpiStripShell`'s `isPromotionEnabled('kpi-card')` branch was dead (flag defaults OFF, no enabler), so the value band was always the sole live residence. The surface was dark, exactly as D-F2 recorded.

**Deleted.** `packages/react/src/engine/promotionMode.ts` (+ its barrel export); the whole `packages/plugins/panels/kpi-strip/card/` directory (`KpiCardNode.ts`, `KpiCardShell.tsx`, `kpiSpecToCardNode.ts`, `meta.ts`, `index.ts`); the `kpi-card` registration in `panels/index.ts`; `promotion-lossless.fitness.test.tsx`.

**FF changes.**
- **FF-PROMOTION-LOSSLESS — RETIRED.** No second residence remains to prove byte-parity against; the value band is the sole residence. Its plugins-side scaffold in `object-model-residence.fitness.test.ts` is replaced by a tightened **FF-ONE-PART-GRAMMAR** clause: *no shadow node type shadows a value band* (`kpi-card`/`hero-card` MUST NOT be registered node types).
- **FF-NO-FACET-REINVENTION — reframed to canon.** ADR-041 residence-at-field settled per-item visibility (`when` / `view.visibleWhen`) as a **legitimate `value`-residence facet**, not a node-only facet awaiting promotion. `when`/`visibleWhen` are removed from the reserved-facet set; only genuinely node-only per-item RBAC (`visibleToRoles`) remains reserved. The gate now holds **zero** offenders (the former `['kpi-strip']` allow-list is emptied — not by removing `when`, but by recognizing it as legitimate).

**Visibility preserved (the ONE genuine render-facet win).** kpi-strip per-item visibility stays on the value-band render path: each item's declared `when` drives the strip's `evalVisibility` pre-filter (which also keeps the stable value-band `(field, index)` PartAnchor coordinate) and the engine `kpiVisible` SSOT (`interpretKpis` / `extractKpiRequirements`). No second residence, no `renderNode` node-gate needed for value parts — the value residence owns its own visibility facet.

**Enforcement.** The eslint `no-restricted-imports` sliver (§0.5c) bans re-creating `promotionMode` / `kpi-strip/card` / `nodeProjection` under `apps/panel`; the check-laws `ADR041-part-grammar-no-bridge` tripwire (landed Phase 1.5) already names these.

**Reversibility.** Behaviourally reversible from git (dark surface); first deletion phase, alias-reversible through Phase 5. Phase 6 remains the sole one-way step.

---

## Reversibility & the one-way step

Phases 1–5 are `expand`-only and alias-reversible (revert the added modules + barrel lines; no config, no stored data, no behaviour-store contract touched). **Phase 6 (de-alias / derive wrapper-leaf, remove kind-as-mechanism reads) is the sole one-way `contract` step** — it is gated exactly like ADR-023 R2: it lands only when FF-DERIVED-CONTAINMENT is machine-green over EVERY registered META and every stored corpus config. Until then the surface names stay.
