# ADR-049 — Assembly by Declaration (the binding axis gets its port; the object lands as a composed whole)

**Status:** PROPOSED (2026-07-19 — owner-blessed «გენდობი, მიდი» after the two-lens READ-ONLY root study; card `work/items/0100-assembly-by-declaration.md`).
**Extends (never forks):** ADR-038 (The Bounded Element Law — governing; this closes its *binding* axis exactly as ADR-041 closed its *containment* axis) · ADR-041 (The Part Grammar + Part Port — same root shape, one axis over; this ADR adds NO fifth grammar and touches NO engine object-model). Aligns CLAUDE.md Law 2 (config declarative), Law 7 (Strangler-Fig), Law 8/OCP, Law 11 C (buried-capability activation).
**Source of truth:** `docs/architecture/proposals/STUDY-panel-coupling-root-databind.md` (lens 1 — primitive 1, Option A) + `docs/architecture/proposals/STUDY-panel-assembly-capability-composed-preset.md` (lens 2 — primitive 2, Option A).
**Executable plan:** this ADR §Phased plan (P1 is a self-contained, WIP=1 build-brief seed).

---

## Context — one defect, two levels, four complaints

Assembling a bound element has **three axes**: (1) *identity/props* — what it IS, (2) *containment* — what PARTS it has, (3) *binding* — what DATA it resolves. Axes 1–2 are declaration-driven (generic Inspector over `PropSchema`; ADR-041 Part port). **Axis 3 never got its port**, and above it, insertion never got a *composed starting point*. The result is the same defect at two levels — assembly is **not declaration-driven** — and it maps 1:1 to the owner's four circle-break complaints: (#1) not loosely-coupled, (#2) concept↔logic entangled, (#3) assembly hard for a non-expert, (#4) built capabilities not leveraged.

**Level 1 — assembly by DISPATCH (a `switch(type)` picks the editor).** `DataSpecEditor` is the object-assembly surface for *binding* and it is hand-wired **three times over**: `SpecBody` is a `switch (value.type)` mapping each discriminant to a bespoke editor import (`platform/apps/panel/src/features/data-layer/DataSpecEditor.tsx:108-121`); `defaultSpec` is a second parallel `switch (type)` hardcoding each kind's initial shape (`DataSpecEditor.tsx:35-56`); the engine's `SPEC_CATALOG` (`platform/packages/core/src/spec-catalog.ts:13-21`) *is* the self-describing concept registry — but a **stub** carrying `label`/`description`/`constructorReady`/`example` and **nothing about the authoring surface** (no factory, no schema, no editor binding). The concept of a DataSpec kind is split across two layers — metadata in the engine, *shape* and *UI* in the panel's switches — the exact "external `if type == X`" the Bounded-Element law refuses. Adding one bind-kind costs **five coordinated edits across two layers**; a new node type costs one (register a schema). That asymmetry IS complaint #1/#2 reported from the inside. Same root as ADR-041: over-built above (7+ editors + 2 switches + a stub catalog) *because* under-built at the root (no authoring-contract port) — causally linked.

**Level 2 — assembly BY HAND (a dropped tile is a blank shell).** `NodePalette` inserts a **blank shell** — registry meta carries `label/icon/caps/category/requires` only, no `defaultProps` (`platform/apps/panel/src/canvas/NodePalette.tsx:90-95`); `objectRegistry` has **no preset/defaultProps primitive** (`platform/packages/react/src/engine/objectRegistry.ts`). The object lands empty and unbound; the author then hunts across three surfaces to fill it. The richest capabilities we already built are reachable only by an expert who knows where to escalate — and the DataWorkbench is **gated to `query`/`pipeline`/unbound only** (`platform/apps/panel/src/inspector/controls/DataFacetField.tsx:124`), so a `row-list`/`timeseries`/`growth`/`ratio-list` element hits a capability cliff and drops to the steward raw editor. That IS complaints #3/#4. The whole reference class (Builder Blocks · Puck `defaultProps` · Form.io templates · Grafana viz-suggestions) ships a **composed starting point** primitive; we lack it.

The two levels are causally ordered: a composed whole (level 2) pre-fills a *bound DataSpec*, which only the binding port (level 1) makes declarable. So the port is the foundation and the preset stands on it.

---

## Decision — TWO declarative primitives (both additive, both Strangler, neither touches the engine object-model)

### P1 — **DataSpec authoring-contract registry** (the binding axis gets its port)

Promote `SPEC_CATALOG` from a metadata stub to a full **authoring contract**. Each bind-kind DECLARES, beside its label:
- `make(): DataSpec` — the default factory (absorbs `defaultSpec`, returns to the engine as pure/React-free).
- **one of** `schema: PropSchema` (renders through the generic Inspector, like every node) **or** `editorKey: string` (resolves a registered rich editor — the SAME boot-time escape hatch value-mapping/thresholds already use, `App.tsx:36-37`).

`DataSpecEditor` becomes generic: read the registry → seed via `make()` → **dispatch schema-via-Inspector *or* the registered editor** — **no switch, no per-type import.** The three switches collapse into one generic renderer. A new bind-kind = ONE declaration (+ optionally one registered editor), zero composer edits.

**Strangler anchor (the precedent is already one rung below the gap):** transform-STEPS and filter-PARAMS are binding constructs that ALREADY carry a `PropSchema` and route through the `SchemaSource` port (`transformStepSchemaSource.ts`, `filterParamSchemaSource.ts`). P1 extends that proven pattern **up** one level, to the DataSpec kind itself. Concept ownership returns to the engine (`make`+`schema` are pure); only genuinely React-rich editors stay in the panel, **registered not switched** — which restores the dependency arrow's intent.

### P2 — **Composed-Preset projection** (the object lands as a composed whole)

A **preset = a partial element declaration** (a config sub-tree: `type` + sensible `props` + a bound `DataSpec` (made declarable by P1's `make()`) + pre-wired trend/threshold/visibility/style), registered against the SAME open object registry via ONE additive field, and **projected into the palette** as an insertable whole. Dropping a preset lands a *valid, data-bound, sensibly-styled object*. Non-expert assembly becomes *pick-a-whole, then tweak*. This is the homoiconic move: one declaration → palette entry + dropped instance, zero per-type projector (OCP; a new preset is a new declaration, machinery unchanged).

P2 rides a **substrate un-bury** pass so a preset's pre-wired capabilities are actually reachable after it lands: drop the `DataFacetField:124` gate (every bind-kind reaches the DataWorkbench, not just query/pipeline); wire `VisibilityBuilder` into the ~42 sites that raw-edit `when`/`view.visibleWhen`; build the missing `TrendField` projection (raw JSON in ~33 sites — a *missing projection*, not a buried one; it rides the first preset payload). Shipping a capability then means shipping a preset that uses it — the buried DataWorkbench/VisibilityBuilder/⚡bind/thresholds become the **default surface of every dropped object**, reached by tweaking not hunting.

---

## Why this shape, not the alternatives (≥2 rejected, per ADR practice)

- **Full `PropSchema` flattening** (give every DataSpec kind a schema, delete ALL bespoke editors, route 100% through the Inspector). *Gains:* purest one-language outcome. **Rejected as the wholesale target:** the rich modalities (drag-drop FieldWells / Tableau "Show Me" / the pipeline builder / DataWorkbench) genuinely exceed a flat property form; flattening them **under-builds the authoring UX the owner values** and forfeits the "full benefit of standards" (Law 4). It is the *asymptote* P1 migrates toward per-kind — correct as a direction, wrong as a big-bang. **P1 contains it**: a kind whose schema is expressive enough simply declares `schema` and needs no editor; the flat kinds (`timeseries`/`growth`/`ratio-list`) migrate editor→`schema` and delete their editors, the rich kinds stay registered until `FieldControl`s absorb their sub-modalities.
- **Status quo / keep the switch (tidy at most).** *Gains:* zero cost now. **Rejected — it IS the circle.** The switch is the "external `if type == X`" anti-pattern; every new bind-kind stays a 5-edit / 2-layer change; the concept-vs-logic split the owner named persists; the blank-shell drop-then-hunt model stays. The deliberate non-fix.
- **A new / fifth grammar** (a bespoke "preset language" or a parallel binding-config tree). **Rejected on Law 10 / ADR-041.** A preset is nothing new — it is an *element declaration* on the existing open registry (must resist drifting into a second grammar); the binding contract is nothing new — it is the `SchemaSource`/`PropSchema` pattern extended one level up. Both EXTEND ADR-038/041. No engine verb added, no object-model change, additive/expand-contract only, config-declarative (Law 2 — a preset is pure data+intent, no logic; `make`/`schema` are pure), dependency arrow restored (pure `make`+`schema` re-home to the engine; React-rich editors stay in the panel, registered).

**Framing for the owner:** *"Element IS" and "element HAS PARTS" are declarations; "element BINDS TO data" was still a switch, and a dropped object was still a blank. Give binding the same port the other two axes have, and let an object arrive as a composed whole — then adding a new way to bind, or a new starting object, is a declaration, not a rebuild.*

---

## Phased Strangler plan (Law 7 — all additive; old switch coexists behind the registry until the ratchet bites)

### P1 — DataSpec authoring-contract registry *(self-contained, independently shippable, WIP=1)*

**Seams touched:** `platform/packages/core/src/spec-catalog.ts` (promote stub → contract: add `make()` + `schema?`/`editorKey?` per kind) · `platform/apps/panel/src/features/data-layer/DataSpecEditor.tsx:35-56,108-121` (delete both switches → one generic renderer that reads the registry) · panel boot (`App.tsx:36-37` idiom — register the existing bespoke editors under `editorKey`s) · reuse the `SchemaSource`/Inspector path for `schema` kinds (the `transformStepSchemaSource`/`filterParamSchemaSource` precedent).

**Migration steps (each expand-only, platform green after each):**
1. **Land the ratchet FIRST.** `FF-NO-DATASPEC-SWITCH` as a regression-guard over the corpus (mirrors `FF-NO-EXTERNAL-SPECIAL-CASE`) — initially *allowlisting* `DataSpecEditor`'s two switches (BASELINE = current offenders) so it is green on day one and can only ratchet down. This is the protection-layer-first fence, not an end-of-phase afterthought.
2. Add the registry beside `SPEC_CATALOG`; populate `make()` for ALL kinds (lift `defaultSpec`).
3. Register the EXISTING bespoke editors under `editorKey`s at boot; replace `SpecBody` with `registry.resolve(type)` → **delete both switches**; strike the allowlist to `[]`.
4. Migrate the FLAT kinds (`timeseries` = code+years, `growth`, `ratio-list` = pairs[]) bespoke-editor → declared `schema`, deleting those editors; rich kinds (`query`/`transform`/`pivot`) stay registered `editorKey`s.

**Gates:** `FF-NO-DATASPEC-SWITCH` (no `switch (spec.type)` / no static per-kind editor import in the panel composer — ratchets to `[]` at step 3) · `FF-DATASPEC-AUTHORING-COMPLETE` (every `SPEC_CATALOG` kind resolves to a schema-or-editor; mirrors the node `FF-SCHEMA-COMPLETE`).

**Live-walk DoD:** on :3013, adding/authoring a bind-kind uses the generic renderer (rich editors still fire where declared); a NEW bind-kind is added by a single registry declaration with **zero** `DataSpecEditor` edit — proven by `FF-NO-DATASPEC-SWITCH` at `[]`. Built → gated → deployed :3013 → shown to owner **before** P2 starts.

### P2a — substrate un-bury *(rides on P1; raises the floor)*

**Seams:** drop the `DataFacetField.tsx:124` gate (DataWorkbench opens for ALL spec kinds) · wire `VisibilityBuilder` (`features/visibility`) into KPI/featured-item `when` + node `view.visibleWhen` (~42 raw sites) · build `TrendField` projection (~33 raw-JSON sites).
**Gate:** `FF-WORKBENCH-KIND-AGNOSTIC` (no bind-kind is denied the workbench by composer code) + the existing schema/plane guards stay green.
**DoD:** a `row-list`/`timeseries` element reaches the DataWorkbench and a visibility/trend editor with no raw-JSON fall-through, walked on :3013.

### P2b — Composed-Preset primitive *(stands on P1 + P2a)*

**Seams:** one additive `presets: PartialNodeConfig[]` projection on the registry meta (`objectRegistry.ts`) · project into `NodePalette` as a "Recommended / Starters" band ahead of raw element tiles · seed 2–3 statistics-native presets (KPI-strip-with-trend+threshold · GDP-time-series-bound · regional-table), each pre-wiring the P2a capabilities.
**Gates:** `FF-PRESET-IS-CONFIG` (every preset validates against the target schema and round-trips lossless) · `FF-PRESET-NO-SPECIAL-CASE` (palette projects presets with zero per-type code; mirrors `FF-NO-EXTERNAL-SPECIAL-CASE`).
**DoD:** on :3013, a non-expert picks a composed whole from the palette; it lands **bound + pre-wired** (DataWorkbench/visibility/threshold reachable without escalation), and adding a new preset is a single declaration.

---

## Consequences + guards

**Positive.** The binding circle ends structurally (binding joins identity+containment as declaration-driven); a new bind-kind and a new insertable whole each cost ONE declaration; concept ownership returns to the engine (arrow restored); the buried capabilities become the default surface via presets; ADR-038/041 are extended, not forked; no engine object-model change, no config migration (presets and contracts are additive META, not wire).

**Costs / trade-offs (ISO 25010).** Modifiability/extensibility ++ and usability/learnability ++ (P2), against a small resolution indirection + boot-time editor-registration (an established idiom) and a maintainability risk of **preset sprawl / stale presets** — mitigated because presets are *config snapshots validated by the same schema*, never bespoke code, curatable behind a steward lens. During P1's migration window, modifiability − transiently while both the switch and the registry coexist (bounded by the ratchet).

**Plane law (AR-52 / Law 11).** The steward raw-JSON editor is retained as a **last-resort disclosure**, never the default path — projected to the steward plane, never the author plane. A dropped preset's capabilities are reached by tweaking; raw JSON is the escape hatch, not the assembly surface.

**Invariants a future bind-kind / preset must honor.**
1. A bind-kind DECLARES its authoring surface (`make()` + `schema` **or** `editorKey`); it never adds a `switch` arm or a static per-type import to a composer. (`FF-NO-DATASPEC-SWITCH`, `FF-DATASPEC-AUTHORING-COMPLETE`)
2. `make()` and `schema` are pure/React-free and live in the engine; only genuinely rich editors live in the panel, registered by key.
3. A preset is an *element declaration on the open registry* — pure config, no logic (Law 2), lossless round-trip — never a second grammar. (`FF-PRESET-IS-CONFIG`, `FF-PRESET-NO-SPECIAL-CASE`)
4. No bind-kind is denied a built capability (workbench/visibility/trend) by composer code. (`FF-WORKBENCH-KIND-AGNOSTIC`)
5. No fifth grammar, no engine object-model change, additive/expand-contract only — this ADR stays inside ADR-038/041.

**Reversibility.** P1 steps 1–2 and P2a/P2b are additive and revertible (delete added modules/META, restore the switch/gate). P1 step 3 (delete the switches) is the only structural cut, gated by `FF-NO-DATASPEC-SWITCH` reaching `[]` — a code-only, config-neutral, git-revertible step (no stored-data one-way door, unlike ADR-041 Phase 6).

---

## P2 — Resolved design (2026-07-19, architect · P1 DONE + live-verified on :3013)

> Resolves the three open questions the scout surfaced (`work/items/0100-assembly-by-declaration.md` §P2 ground-truth). This section is **authoritative** where it refines the P2b seam sketch and the P2a visibility scope above (those lines are superseded, not rewritten — Strangler on the doc itself).

### Q1 — Store ownership of the composed preset → a NEW sibling registry `presetRegistry` (NOT `ObjectMeta`, NOT `getDefaults`)

**Decision.** The composed preset OWNS its own store: a new **`PresetRegistry`** singleton in `packages/react/src/engine/` (sibling of `objectRegistry`, same file neighbourhood, same additive Strangler shape). Neither existing store is stretched to hold it — both were rejected on their own stated contracts:

- **Reject `ObjectMeta.preset[]` on `objectRegistry`.** `objectRegistry` is, by its own header (`objectRegistry.ts:11-19`), "which object *TYPES* exist … JSON-serializable **descriptors only**", keyed 1:1 by `(kind,type,variant)`. A preset breaks that on three axes: (a) **cardinality** — N presets per type (three KPI-strip starters) and, later, cross-type multi-node presets, versus one descriptor per identity; (b) **residence** — a preset is a curated *instance-seed* (a partial document), not a *type descriptor*; hanging instance content on a type descriptor makes the "descriptors-only" store a second source of instance truth; (c) **arrow** — a real statistics-native preset ("GDP-time-series-bound") carries **domain indicator codes**, which are shell/plugins concerns and may **not** live in app-agnostic `packages/react`. Cramming them onto `ObjectMeta` would drag domain data below the arrow.
- **Reject extending `NodeRegistry.getDefaults` to return children+binding.** `getDefaults` (`NodeRegistry.ts:173`) returns *scalar props* and is the seed for the **V6 `makeNode`** (`insertNode.ts:38`, `childIds:[]`). It is a behaviour store keyed 1:1 by `(type,variant)` — same cardinality/residence mismatch — and widening it to emit a child subtree + `DataSpec` would mutate the V6 build contract itself (Q2) and bloat "how to render" with "what curated content." Wrong residence.

**The clean seam (mechanism/content split — the same split slices already use).** The *mechanism* (`PresetRegistry` class + `presetRegistry` singleton + palette projection) is **generic and engine-resident** (`packages/react`, arrow-clean). The *content* (the actual curated presets with domain codes) is **registered by the shell/app at boot** (`packages/plugins` / `apps/*`), exactly as `registerSlice` feeds `objectRegistry`. Engine owns the port; shell owns the domain declarations. `objectRegistry`'s "descriptors-only" contract and `getDefaults`' scalar-V6 contract are **both left untouched** — pure add.

**Minimal additive shape (pure config, Law 2 — no functions anywhere in the stored value):**

```ts
// packages/react/src/engine/PresetRegistry.ts  (JSON-serializable; lossless round-trip)
export interface NodeSeed {
  type:     string                    // an EXISTING registered node type (no new type)
  variant?: string
  props?:   Record<string, unknown>   // overlays getDefaults (see Q2 merge rule)
  data?:    DataSpec                   // a bound spec — made declarable by P1's make()
  view?:    { visibleWhen?: VisibilityExpr }   // pre-wired visibility (P2a)
  children?: NodeSeed[]               // recursive — a preset MAY be a small subtree
}
export interface PresetDecl {
  id:        string                   // stable palette identity
  label:     string
  icon?:     string
  category?: string                   // palette band grouping
  caps?:     NodeCap[]                // capability filtering — mirrors ObjectMeta.caps
  seed:      NodeSeed                 // THE partial element declaration (pure data)
}
```

A preset references an existing `type` and *composes* it — it is an **element declaration on the open registry**, never a new grammar (Invariant 3 / Law 10 held). `seed` is inert config; the pre-wired trend/threshold live inside `seed.props`/`seed.data` as ordinary authored values.

### Q2 — V6 byte-identical insert invariant → held by ADDITIVE expansion, `makeNode` untouched, placement resolver SHARED

**Decision.** Do **not** fork `makeNode`/`resolveInsertPlan`. Add ONE pure sibling builder `planPresetInserts(preset, plan, makeId)` that expands a `PresetDecl.seed` into the ordered `InsertOp[]` the existing batched `insertNodes` reducer already commits (ONE history entry). Three properties keep V6 exact:

1. **Placement legality is SHARED, not re-implemented.** The preset root flows through the **existing** `resolveInsertPlan(page, selectedId, seed.type)` (→ direct/wrap/blocked). A preset therefore obeys `nestAccepts`/`slotAdmits` identically to a bare tile — it can never land in an illegal parent, and the never-cliff guarantee extends to presets for free.
2. **The node build is an OVERLAY on `makeNode`, degenerate-identical.** Each seed node is built as `makeNode(seed.type, id, seed.variant)` then overlaid: `props = { ...getDefaults, ...seed.props }`, plus `data`/`view` when present. **A preset whose seed is `{type}` with no overlays produces a node byte-identical to today's palette drop** — this is the pinned invariant (`FF-PRESET-DEGENERATE-IDENTITY`).
3. **Ids assigned in FIXED pre-order via the SAME `makeId` factory** (root, then children depth-first) — mirroring exactly how `planInserts`' wrap branch assigns wrapper-then-child. Two surfaces inserting the same preset with the same factory sequence produce byte-identical trees. V6 is **preserved and extended** to cover preset inserts; the existing `insertNeverCliff.fitness.test.ts` stays green untouched (bare-type path is not modified).

**New guards:** `FF-PRESET-DEGENERATE-IDENTITY` (an all-defaults preset ≡ the bare-type `makeNode` output) · `FF-PRESET-INSERT-NEVER-CLIFF` (a preset insert resolves through `resolveInsertPlan` to a valid tree or an explicit blocked hint — never an invalid tree).

### Q3 — Visibility verdict → node `view.visibleWhen` is **DONE (built + wired)**; the real P2a gap is the **band-item `when`**

**Confirmed in code (the 2026-07-18 audit's "unwired" is STALE for node visibility).** `builtinFacets.ts:90-116` declares a **universal** `visibility` facet (`id:'visibility'`, `readPath:'view.visibleWhen'`, `contract → { field:'view.visibleWhen', type:'visibility' }`) mounted for EVERY renderable element; the generic Inspector dispatches it through `FieldControlRegistry.register('visibility', VisibilityField)` (`FieldControlRegistry.ts:37,159`); `VisibilityField` reuses `VisibilitySection` → `VisibilityBuilder` **verbatim**. So node-level conditional visibility is already declaration-driven and reachable in the node inspector — the `VisibilitySection.tsx:1-11` header claim is correct.

Therefore P2a's visibility work is **NOT** "wire node `view.visibleWhen`" (nothing to do) — it is scoped to the **band-item `when`**: the opaque steward `when` object on `kpi-strip` items / `featured-slider` items (value/sourced part items), which today has no `VisibilityBuilder` surface. This is **pure wiring** (reuse the built `VisibilityField`/`VisibilitySection` into the band-item authoring surface via a declared field on the item schema), not a new build.

### P2a build-brief seed (route now) — substrate un-bury, three independent lanes

**Lane 1 — un-gate the DataWorkbench (build + wire, not a pure drop).**
- *Seam:* `DataFacetField.tsx:124` `canWorkbench` → drop the `spec.type==='query'|'pipeline'` literal → `canWorkbench = !!escalation`. **Caveat:** the open path at `:130` currently discards any non-pipeline spec via `freshPipelineSpec()`. Un-gating must make `openWorkbench` **adopt, not discard** the bound kind — lift a `row-list`/`timeseries`/`growth`/`ratio-list` losslessly into an equivalent workbench spec (or host that kind's P1-registry authoring inside the workbench). This is why it is build+wire.
- *Fitness:* `FF-WORKBENCH-KIND-AGNOSTIC` (no bind-kind literal in the workbench-open gate) + a round-trip test: opening the workbench on a bound `row-list` preserves the binding (no fresh-pipeline data loss).
- *Live-walk DoD:* on :3013 a `row-list`/`timeseries` element opens the DataWorkbench with its binding intact — no capability cliff, no raw-editor fall-through.

**Lane 2 — band-item visibility wiring (pure wiring, per Q3).**
- *Seam:* wire `VisibilityField`/`VisibilitySection` into the `kpi-strip` / `featured-slider` item authoring surface by declaring a `type:'visibility'` field at the item `when` readPath (the same FieldControl already registered). Node `view.visibleWhen` is already done — do **not** re-touch it.
- *Fitness:* `FF-VISIBILITY-NO-RAW-WHEN` (no band-item `when` is authored as a raw `type:'object'` control) — a projection-completeness guard mirroring `FF-DATASPEC-AUTHORING-COMPLETE`.
- *Live-walk DoD:* a KPI-strip item's "show when…" is built through the visibility builder on :3013, no raw JSON.

**Lane 3 — build the missing `TrendField` projection (build + wire).**
- *Seam:* no `TrendField` exists (grep = docs only); trend is authored raw as `type:'object'` at `KpiStripNode.ts:72` + `FeaturedSliderNode.ts:64` (audit A1 = 33 sites). Build a `TrendField` FieldControl (`PropFieldType 'trend'`), register in `FieldControlRegistry`, and re-declare those 33 raw sites' fields as `type:'trend'` so they project through it (a *missing projection*, not a buried one).
- *Fitness:* `FF-TREND-HAS-PROJECTION` (no `trend`-shaped field is authored as a raw `object` control).
- *Live-walk DoD:* a trend is authored through the `TrendField` control on :3013 with no raw JSON.

> Lanes are independent and each independently shippable behind its own fitness ratchet (protection-layer-first). They collectively raise the floor P2b's presets stand on: a dropped preset's pre-wired workbench/visibility/trend are all reachable by tweak, not by escalation.

### P2b build-brief seed (route after P2a) — the composed-preset primitive

- *Seams:* new `packages/react/src/engine/PresetRegistry.ts` (the `PresetDecl`/`NodeSeed` types + `presetRegistry` singleton) · `planPresetInserts` sibling in `apps/panel/src/canvas/insertNode.ts` (Q2) · `NodePalette.tsx` projects `presetRegistry.list()` as a "Starters / Recommended" band ahead of the raw tiles (generic map, zero per-type code) · shell registers 2–3 statistics-native presets at boot (`packages/plugins` / app), each pre-wiring the P2a capabilities.
- *Fitness:* `FF-PRESET-IS-CONFIG` (every preset is JSON-serializable, validates against its target schema, round-trips lossless) · `FF-PRESET-NO-SPECIAL-CASE` (the palette projects presets with zero per-type code — mirrors `FF-NO-EXTERNAL-SPECIAL-CASE`) · `FF-PRESET-DEGENERATE-IDENTITY` + `FF-PRESET-INSERT-NEVER-CLIFF` (Q2).
- *Live-walk DoD:* on :3013 a non-expert picks a composed whole from the palette; it lands **bound + pre-wired** (DataWorkbench/visibility/threshold reachable without escalation); adding a new preset is a single shell-side declaration with zero panel edit.

**Supersedes above:** the P2b "one additive `presets: PartialNodeConfig[]` projection on the registry meta (`objectRegistry.ts`)" line (§Phased plan) is replaced by the `presetRegistry` sibling decision (Q1). The P2a "wire `VisibilityBuilder` into … node `view.visibleWhen` (~42 raw sites)" line is narrowed to the band-item `when` only (Q3 — node visibility is already wired).
