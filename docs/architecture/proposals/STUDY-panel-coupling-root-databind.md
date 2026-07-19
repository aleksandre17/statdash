# STUDY — the panel's coupling root: the un-ported *binding* axis

**Lens:** internal architecture — coupling & separation of concerns (NOT reference-platform UX; a parallel architect owns that).
**Trigger:** owner (Aleksandre) circle-break signal — *"still not fully loosely-coupled; concepts and logic are not separated; assembling an object is still hard for a non-expert."*
**Status:** DIAGNOSIS + recommendation. Decision-grade. Read-only study; no code changed.
**Date:** 2026-07-19.

---

## TL;DR

Assembling a bound element has **three axes**: (1) *identity/props* — what it IS, (2) *containment* — what PARTS it has, (3) *binding* — what DATA it resolves. Axes 1 and 2 are fully **declaration-driven** (generic Inspector over `PropSchema`; ADR-041 Part port). **Axis 3 never got its port.** DataSpec binding is still authored by a **hand-wired `switch (spec.type)`** over N bespoke editor components — the exact "external `if type == X`" anti-pattern the Bounded-Element law refuses.

**Verdict: mis-factored, and under-built at exactly one seam** — the identical shape ADR-041 diagnosed one axis over ("under-built at the root, over-built one level above, causally linked"). ADR-041 closed the *containment* circle; the *binding* circle is still open, same root.

**The one missing primitive:** a **DataSpec authoring-contract registry** — each kind DECLARES its default factory + its authoring surface (a `PropSchema` *or* a registered rich editor). The panel's two switches collapse into one generic renderer. **Recommendation: Option A.**

---

## 1. The concepts, and where concept entangles with logic

### The GOOD half (proof the pattern works — this is the template)

The property side of authoring is genuinely loosely coupled. Two open registries, no per-type UI:

- `Inspector.tsx` renders the **whole** property panel generically from a `PropSchema`; dispatch is `type → nodeRegistry.getSchema(type)` and `field → fieldControlRegistry.resolve(field)` (`Inspector.tsx:112-189`). *"A new node type = a new schema (no panel change). A new field type = a new control registration (no Inspector change)."* (`Inspector.tsx:1-18`).
- The `SchemaSource` port (`inspector/schemaSource.ts:28-44`) lets the SAME Inspector author nodes, chrome, filter params, and transform steps — DIP + Strategy.
- **Crucially, the binding *sub-parts* already prove the pattern reaches into the data layer:** a transform STEP carries its own `PropSchema` in the engine step-registry and is authored by the generic Inspector with zero bespoke form (`transformStepSchemaSource.ts:13-21`); a filter PARAM does the same via `getParamSchema` (`filterParamSchemaSource.ts:15-23`). Rich fields that exceed a flat form register a custom `FieldControl` (value-mapping, thresholds — side-effect-registered at boot, `App.tsx:36-37`). The escape hatch for "this field needs a rich editor" **already exists inside the generic mechanism.**

Concept (what a field IS = its `PropField` declaration) and logic (how it's rendered = the resolved control) are cleanly separated. This is the homoiconic ideal, working.

### The COUPLED half — the DataSpec kind

One rung UP from the transform-step, at the **DataSpec-kind** level (query / timeseries / growth / ratio-list / row-list / transform / pivot / metric), the pattern breaks. `DataSpecEditor.tsx` is the object-assembly surface for *binding*, and it is hand-wired **three times over**:

- **`SpecBody` — a `switch (value.type)`** mapping each discriminant to a bespoke editor import (`DataSpecEditor.tsx:108-121`). This is the coupling seam: an external composer hardcoding concrete types.
- **`defaultSpec` — a second parallel `switch (type)`** hardcoding each kind's initial shape (`DataSpecEditor.tsx:35-56`). The "what a kind IS structurally" concept lives here, in panel logic.
- **`SPEC_CATALOG`** (`packages/core/src/spec-catalog.ts:13-21`) — the engine DOES have a self-describing concept registry for DataSpec kinds… but it is a **stub**: it declares `label` / `description` / `constructorReady` / `example` and **nothing about the authoring surface** (no default factory, no schema, no editor binding). So the panel must bridge the gap with the two switches above.

**The entanglement, named:** the concept of a DataSpec kind is split across two layers — its metadata in `SPEC_CATALOG` (engine), its *shape* and *authoring UI* in the panel's switches. A kind does not DECLARE its authoring surface; an external switch HAND-WIRES it. Adding one bind-kind costs **five coordinated edits across two layers**: engine union → `SPEC_CATALOG` entry → panel `defaultSpec` case → panel `SpecBody` case → a bespoke editor. Contrast a new node type: *register a schema, done.* That asymmetry is precisely what "assembling an object is still hard" reports from the inside.

**Why this is the same root as ADR-041.** ADR-041 found containment had grown four parallel grammars because the root relation "element HAS PARTS" was never a first-class primitive; the fix was ONE Part port that every mechanism recurses over. The binding axis has the identical defect one axis over: the root relation "a DataSpec kind HAS an authoring contract" was never a primitive, so it grew N bespoke editors behind a switch. The bespoke editors are **not wrong to exist** (drag-drop FieldWells / "Show Me" / a pipeline builder are legitimate rich modalities the owner values — see `TransformEditor.tsx:10-13`); they are wrong to be **dispatched by a switch** instead of **resolved by a declaration.** Over-built above (7+ editors + 2 switches + a stub catalog) *because* under-built at the root (no authoring-contract port) — causally linked, exactly ADR-041's phrase.

---

## 2. Verdict

| Axis of "assemble a bound element" | Mechanism | Declaration-driven? |
|---|---|---|
| identity / props (what it IS) | `objectRegistry` → generic Inspector over `PropSchema` | ✅ |
| containment (what PARTS it has) | ADR-041 Part port (`enumerateParts`/`writePart`) | ✅ |
| **binding (what DATA it resolves)** | **`DataSpecEditor` `switch` → N bespoke editors** | ❌ **the miss** |

**Over-built / under-built / mis-factored → mis-factored, under-built at one seam.** Not a rewrite target; a single missing port. The precedent that it is bridgeable already sits **one rung below** the gap: transform-steps and filter-params are binding constructs that ALREADY carry a `PropSchema` and route through `SchemaSource`. The Strangler anchor is to extend that proven pattern **up** one level, to the DataSpec kind itself.

---

## 3. Options (root-concept level)

### Option A — DataSpec **authoring-contract registry** (RECOMMENDED)

Promote `SPEC_CATALOG` from a metadata stub to a full concept declaration. Each kind declares, next to its label:
- `make(): DataSpec` — the default factory (absorbs `defaultSpec`).
- **one of** `schema: PropSchema` (renders through the generic Inspector, like every node) **or** `editorKey: string` (resolves a registered rich editor — the SAME escape hatch value-mapping/thresholds already use for rich `FieldControl`s).

`DataSpecEditor` becomes generic: read the registry, seed via `make()`, dispatch schema-via-Inspector *or* the registered editor — **no switch, no per-type import.** A new bind-kind = ONE declaration (+ optionally one registered editor), zero composer edits.

- **Trade-off (ISO 25010):** modifiability/extensibility ++ (one declaration, one layer); it is B's "one seam" win **without** B's UX loss, because a kind may still resolve to a rich registered editor. Cost: a small resolution indirection and a boot-time editor-registration step (already an established panel idiom, `App.tsx:36-37`). Concept ownership returns to the engine (`make`+`schema` are pure/React-free); only genuinely React-rich editors stay in the panel, *registered* not *switched* — restores the dependency arrow's intent.
- **Strangler path (Law 7, all additive):** (1) add the registry beside `SPEC_CATALOG`, populate `make()` for all kinds (lift `defaultSpec`); (2) register the EXISTING bespoke editors under `editorKey`s at boot, replace `SpecBody` with `registry.resolve(type)` — delete both switches; (3) migrate the FLAT kinds (`timeseries` = code+years, `growth`, `ratio-list` = pairs[]) from bespoke editor → declared `PropSchema`, deleting those editors; rich kinds (`query`/`transform`/`pivot`) stay registered editors, collapsing later as `FieldControl`s absorb their sub-modalities; (4) fitness gate.
- **Fitness functions:** `FF-NO-DATASPEC-SWITCH` — no `switch (spec.type)` / no static per-kind editor import in the panel composer (mirrors `FF-NO-EXTERNAL-SPECIAL-CASE`); `FF-DATASPEC-AUTHORING-COMPLETE` — every `SPEC_CATALOG` kind has a registry entry resolving to a schema-or-editor (mirrors the node `FF-SCHEMA-COMPLETE`).

### Option B — Full `PropSchema` unification (delete all bespoke editors)

Give every DataSpec kind a `PropSchema` (like transform-steps already have), add a `dataSpecSchemaSource`, route 100% through the generic Inspector, delete the bespoke editors and both switches.

- **Trade-off:** purest one-language outcome, maximal uniformity. **Rejected as the wholesale target:** the rich modalities (drag-drop FieldWells / Tableau "Show Me" / the pipeline builder) genuinely exceed a flat property form; flattening them **under-builds the authoring UX** the owner explicitly values and forfeits the "full benefit of standards" (Show-Me is a real pattern, Law 4). B is the *asymptote* Option A migrates toward per-kind — correct as a direction, wrong as a big-bang. Option A **contains** B (a kind whose schema is expressive enough simply declares `schema` and needs no editor).

### Option C — Status quo (keep the switch, tidy at most)

- **Rejected:** it IS the circle. The switch is the "external `if type == X`" anti-pattern; every new bind-kind stays a 5-edit / 2-layer change; the concept-vs-logic split the owner named persists. This is the deliberate non-fix.

---

## 4. Recommendation

**Adopt Option A.** It is the minimal ROOT seam, additive and Strangler-expressible onto existing code, and it is the *same shape* as the fix that closed the containment circle — one declaration-driven port replacing a hand-wired switch. It preserves the rich editors the owner values (as registered strategies, not switch arms) while making the common case ("bind this element to data") a pure declaration. The precedent is already in the tree one rung below the gap (`transformStepSchemaSource` / `filterParamSchemaSource`); Option A extends it up to the DataSpec kind.

**One-line framing for the owner:** *"Element IS" and "element HAS PARTS" are declarations; "element BINDS TO data" is still a switch. Give binding the same port the other two axes already have — then adding a new way to bind is a declaration, not a rebuild.*

**Scope note (deliver-and-stop):** this is a foundation study — ADR + phased plan next, then the lead routes phases. Recommended follow-up: promote to `ADR-0xx — DataSpec authoring-contract registry (binding-axis port)`, extending ADR-038/ADR-041 (never forking), with the two fitness functions landed as regression-guards **first** (ratchet), before the switch is dismantled.

---

## Evidence index (files read)

- `docs/architecture/decisions/ADR-041-part-grammar-and-part-port.md` — the containment-axis precedent + its "under-built root / over-built above" framing.
- `platform/apps/panel/src/features/data-layer/DataSpecEditor.tsx:35-56, 108-121` — the two coupling switches (`defaultSpec`, `SpecBody`).
- `platform/packages/core/src/spec-catalog.ts:13-21` — `SPEC_CATALOG` (the stub concept registry: metadata, no authoring contract).
- `platform/apps/panel/src/inspector/Inspector.tsx:1-18, 112-189` — the generic, declaration-driven property path (the template).
- `platform/apps/panel/src/inspector/schemaSource.ts:28-44` — the `SchemaSource` port.
- `platform/apps/panel/src/inspector/fieldControl.types.ts:1-47` — the open `FieldControl` registry (rich-editor escape hatch).
- `platform/apps/panel/src/features/data-layer/editors/query/steps/transformStepSchemaSource.ts` · `platform/apps/panel/src/features/filters/filterParamSchemaSource.ts` — binding sub-parts ALREADY declaration-driven (the Strangler anchor).
- `platform/apps/panel/src/features/data-layer/editors/TransformEditor.tsx:10-13` — evidence the rich modalities are legitimate (why Option B is wrong wholesale).
- `platform/apps/panel/src/App.tsx:36-37` — boot-time rich-control registration idiom (the mechanism Option A reuses for `editorKey`).
