# PLAN — The Part Grammar + Part Port: phased Strangler-Fig build (ADR-041, ROOT-1..4)

> **Status:** EXECUTABLE PLAN for **ADR-041 — ACCEPTED binding canon (owner GO 2026-07-12)**; it governs from landing, not a proposal. Owner routes the phases. **Decides:** ADR-041 (Option A · D-F2 retire shadow-promotion · D-F3 port-first). **Source of truth:** `SPEC-object-model-foundation-diagnosis.md` §5/§6. **Method:** Strangler-Fig / Law 7 — the existing tested platform is NOT rewritten; it migrates onto the root. Phases 1–5 are `expand`-only + alias-reversible; **Phase 6 is the sole one-way `contract` step**, gated like ADR-023 R2.
>
> **The owner's protecting directive (2026-07-12):** the Fable diagnosis (0067) named the failure mode — the model asked *"what are this element's parts?"* once per grammar, and each BE-x answered with a locally-lawful **bridge**. §0.5 (THE PROTECTION LAYER) makes that failure mode **mechanically un-reintroducible** and lands the fence EARLY (Phase 1.5), before the migration it guards — never as an afterthought at the end.

---

## 0. Orientation — the layer split every phase must respect

| Tier | Where | Build consequence |
|---|---|---|
| **dist-baked** | `packages/react` (tsup → dist), `packages/plugins`, `packages/core` | a change is invisible to the running apps until **`pnpm -r --filter "./packages/*..." run build`** rebuilds dist |
| **app source-mounted** | `apps/panel/src` (Vite dev on **:3013**), `apps/geostat/src` | a change is live on save; no dist rebuild |

**The green-gate (run at the END of every phase — a phase is not "done" until all pass):**
1. `pnpm lint` → **0 errors** (the arrow + `no-restricted-imports` hold).
2. `npx tsc -b apps/panel` → clean (typechecks `packages/react` + `packages/plugins` sources in context).
3. `npx tsc -b --force` (root) → clean (whole graph).
4. **vitest PARSE** the run for `Tests N failed` — N MUST be 0 for the touched suites + all listed FFs (do not trust exit code alone; grep the summary line).
5. **dist rebuild** for any `packages/*` touched: `pnpm -r --filter "./packages/*..." run build`.
6. **live-verify :3013** (`pnpm dev:panel`) for every UX-visible phase — a one-line note of the gesture confirmed (e.g. "click a filter control → bounded selection, dock fits").

**Reversibility gate (per phase, Phases 1–5):** name the exact revert (added files + barrel lines); confirm no config/stored-data/behaviour-store-contract touched; confirm the surface aliases still resolve byte-identical.

---

## 0.5 THE PROTECTION LAYER — the fence that CANNOT be drifted past (owner directive, first-class)

> Landed at **Phase 1.5**, immediately after the port, so it **fences Phases 2–6**. Not a proof we ran once — a set of **regression guards** that FAIL the build if a future change reintroduces any old shape, plus an enforcement + discoverability layer so no future agent/session re-opens the circle unknowingly.

### 0.5a The three FFs are REGRESSION GUARDS (the ratchet), not one-shot proofs

Each guard runs in two modes and **ratchets monotonically**: it forbids any NEW old-shape site from day one (guard mode, Phase 1.5), while a **shrinking allowlist** grandfathers the sites the migration will still remove. A meta-assertion (`expect(ALLOWLIST.length).toBeLessThanOrEqual(BASELINE)`) fails the build if anyone *grows* the allowlist — the allowlist can only get smaller. As each phase removes a grandfathered site, its entry is struck; the last strike flips the guard to a zero-tolerance `[]` gate. (ESLint-baseline / "no new violations" applied to architecture.)

| FF | Exactly what it SCANS | Exactly what TRIPS it (the illegal old shape) | Guard mode from | `[]` at |
|----|----------------------|----------------------------------------------|-----------------|---------|
| **FF-ONE-PART-GRAMMAR** | every module that ENUMERATES constituents — canvas selection/overlay, controller, inspector projection, lineage — via `import.meta.glob(?raw)` structural scan + a behavioural pass over the registered corpus | a **NEW containment grammar**: any constituent enumeration NOT flowing through `enumerateParts` — a function iterating a residence container directly (`element.props[field].map`, `node.children.map`, a `filterSchema` walk) from **outside** a registered `PartSource` adapter. Allowlist = the still-un-migrated direct enumerators; anything outside it trips | Phase 1.5 | Phase 2 (all three adapters live) |
| **FF-RESIDENCE-AT-FIELD** | every registered `ObjectMeta` + every `PartField`, walked from the registry | a residence declared on the **NODE** — a `band:`/residence key on the META root instead of on a field — or a `PartField` missing its `residence`. Allowlist = the one grandfathered node-level `META.band` | Phase 1.5 | Phase 1 fold or Phase 6 de-alias (when `band?` moves onto the field) |
| **FF-DERIVED-CONTAINMENT** | the containment/wrapper code path (modules answering "does this contain? what does it accept?") + every registered META | a **KIND/flag read used to answer a containment question** (`sliceType ===`, `.canHaveChildren` read in a containment decision), OR a stored kind that **contradicts** the declared part fields (kind says leaf, contract declares ≥1 part field). Allowlist = the grandfathered containment kind-reads Phase 6 removes | **Phase 1.5** (NOT Phase 4 — the fence exists before the work it guards) | Phase 6 (one-way, R2-gated) |

**Reframe vs. the phase bodies below:** where a phase says a guard is "scaffold" then "hard," read that as *guard-mode from Phase 1.5, hardening to `[]` at the phase named*. FF-DERIVED-CONTAINMENT in particular lands in guard mode at Phase 1.5 (forbids any NEW kind-as-containment read) — Phase 4's anchor work and Phase 6's de-alias only *tighten* it; they do not first introduce it.

### 0.5b Extend FF-NO-EXTERNAL-SPECIAL-CASE — the per-kind-bridge tooth

The existing gate (`apps/panel/src/canvas/noExternalSpecialCase.fitness.test.ts`) forbids `'kpi-strip'|'kpi-card'|registerNodeProjector|nodeProjection` in the generic layers. **Add one clause:** a Part-port adapter registered under a concrete **type** rather than a **residence** — the exact new per-kind bridge this architecture must refuse. Adapters are keyed by residence (`'slot'|'value'|'sourced'` — a closed set), never by node type:

```
/registerPartSource\(\s*['"](?!slot|value|sourced)/   // a source keyed by a concrete TYPE literal = a per-kind bridge
```

Plus the positive pass: `enumerateParts` over a synthetic (name-free) declaration yields the same shape as over the real `kpi-strip` — proving the port special-cases nothing.

### 0.5c Enforcement + discoverability — the minimal set (so no future session re-opens the circle)

Assigned by the codebase's own SSOT doctrine (`post-edit-laws.py` header: *eslint owns import-shaped boundaries; content/purity invariants are the fitness tests' job, with a non-authoritative check-laws tripwire on the highest-blast edges*):

| Carrier | Guards | Authority | Lands |
|---------|--------|-----------|-------|
| **The 3 FFs + extended FF-NO-EXTERNAL-SPECIAL-CASE** | all four content invariants | **SSOT** — machine-green gate | Phase 1.5 |
| **check-laws `law_pattern`** (`Part-grammar-no-bridge`) | the two *never-legitimate* reintroductions a regex sees cleanly: a string-keyed port registration, and re-creation of retired modules by name | **non-authoritative** fast pre-lint tripwire (SSOT = the FFs) | Phase 1.5 |
| **eslint `no-restricted-imports`** | re-creation of DELETED modules (`promotionMode`, the `kpi-card` promotion surface, `nodeProjection`) — genuinely **import-shaped**, so it belongs here | build-gate error | Phase 5, *as each module is deleted* |
| **CLAUDE.md LAW** + **Registry §0 line** + **resume-brief root-law-first line** | human + agent discoverability — ADR-041 is the FIRST thing a session reads before touching containment | doctrine | owner pastes (§0.5d) |

Why the `sliceType`/`canHaveChildren` reads are NOT pushed into eslint `no-restricted-syntax`: they are **grandfathered** through Phases 1–5 and removed by the ratchet, not banned outright — a blunt AST ban would red the build on legal migration-window code. They are content invariants on a *shrinking* set → the FF ratchet is the correct instrument; keep the eslint boundary import-shaped only.

**Exact check-laws entry** (append to `.claude/project.json` `law_patterns`; regex `re.I`, whole-file):
```json
{
  "id": "ADR041-part-grammar-no-bridge",
  "glob": "platform/apps/panel/src/**",
  "forbid": "registerPartSource\\(\\s*['\"](?!slot|value|sourced)|\\b(promotionMode|kpiSpecToCardNode|nodeProjection|registerNodeProjector)\\b",
  "msg": "ADR-041: containment flows through the Part port. Adapters are keyed by RESIDENCE ('slot'|'value'|'sourced'), never by a concrete type — a string-keyed registerPartSource is a per-kind bridge. The promotion/projector modules are retired (D-F2). SSOT = the FF suite (FF-ONE-PART-GRAMMAR/RESIDENCE-AT-FIELD/DERIVED-CONTAINMENT/NO-EXTERNAL-SPECIAL-CASE); this is a fast non-authoritative tripwire.",
  "sample_violation": "registerPartSource('kpi-strip', src)"
}
```

**Exact eslint sliver** (add to the `apps/panel` block's `no-restricted-imports` patterns, at Phase 5 once the modules are deleted):
```js
{ group: ['**/promotionMode', '**/kpi-strip/card', '**/kpi-strip/card/**', '**/nodeProjection'],
  message: 'ADR-041 D-F2: the KPI-card shadow promotion + node-projector are retired. Containment is the Part port; a KPI card is a value-band part. Do not re-create these modules.' }
```

### 0.5d Exact law text to paste (owner owns registering ADR-041 into these)

**(a) Module law — append to `platform/packages/CLAUDE.md` "Go deeper":**
> **The Part grammar is the ONE containment law (ADR-041, under ADR-038).** Every element's constituents — tree children, value-band items, sourced items, chrome regions — are declared as `PartField`s (**residence on the FIELD, never the node**) and enumerated/written ONLY through the Part port (`enumerateParts`/`writePart`; adapters keyed by **residence**, never by type). Wrapper/leaf is a **derived** predicate (declares ≥1 part field), never a stored kind. Build-forbidden: a NEW containment grammar · a node-level residence · a kind/flag read answering a containment question · a per-kind port adapter. Guards: `FF-ONE-PART-GRAMMAR` · `FF-RESIDENCE-AT-FIELD` · `FF-DERIVED-CONTAINMENT` · `FF-NO-EXTERNAL-SPECIAL-CASE`.

**(b) Root law — append to `CLAUDE.md` root laws (as law 10):**
> 10. **One containment grammar (ADR-041).** Constituents are declared `PartField`s with residence-at-field, reached only through the Part port. A new element kind is a **declaration**, never a new bridge/grammar. (Extends the Bounded-Element law; the four historical grammars are being unified — never add a fifth.)

**(c) Registry §0 line — add under the ADR-038 governing block:**
> **ADR-041 — The Part Grammar + Part Port** (ACCEPTED 2026-07-12; the missing root under ADR-038). One `PartField` grammar (residence-at-field) · one Part port · adapters by residence · wrapper/leaf derived. Plan: `PLAN-part-grammar-strangler-build.md`. Fences: FF-ONE-PART-GRAMMAR · FF-RESIDENCE-AT-FIELD · FF-DERIVED-CONTAINMENT. **Status: BUILDING (port-first).**

**(d) Resume-brief root-law-first line:**
> ROOT LAW FIRST: containment = ADR-041 (one Part grammar, port, residence-at-field, wrapper/leaf derived). Before ANY authoring/containment work read ADR-041 + `PLAN-part-grammar-strangler-build.md`. Never add a per-kind bridge — the three FFs will red the build. A new kind is a declaration.

---

## Phase 1 — ROOT-3 the Part port + ROOT-2 the PartField grammar (aliases) · **engine-specialist**

**Delivers:** the engine-level Part port and the unified `PartField` reading — additive, reversible, **zero config migration, zero import-site change.**

**Seams touched:**
- `packages/react/src/engine/partPort.ts` — **already scaffolded (types-only, inert, unwired).** Phase 1 promotes it to live: `PartField`, `PartResidence`, `PartAddress`, `EnumeratedPart`, `PartMutation` (= `BandMutation`, KEPT), `PartSource`, `PartSourceContext`. *(dist-baked)*
- `packages/react/src/engine/slice-meta.ts` — add the UNIFIED reading: a derivation `partFieldsOf(meta) → PartField[]` that reads `slots` (→ `slot` residence), value `PropField`+`itemSchema` (→ `value`), and `band` `BandDescriptor` (→ `sourced`) into ONE list. `SlotDef` / `BandDescriptor` / value-`PropField` stay **exactly as today** (surface forms) — re-exported, byte-identical. *(dist-baked)*
- `packages/react/src/engine/index.ts` — one barrel line exporting the port types + `partFieldsOf`. *(dist-baked)*

**FF (lock):** `FF-ONE-PART-GRAMMAR` (scaffold form — asserts `partFieldsOf` enumerates ALL three fragments for the registered corpus, and that the port type is the sole part-enumeration contract) + `FF-RESIDENCE-AT-FIELD` (every `PartField` carries a residence; the derivation reads residence from the field, not the node kind). Home: `packages/react/src/engine/object-model.fitness.test.ts`.

**Reversibility:** delete `partPort.ts` + the `partFieldsOf` block + one barrel line. No consumer imports it yet → nothing else moves. **One-way risk: none.**

**Gate:** full green-gate incl. dist rebuild of `packages/react`. Not UX-visible → no :3013 note required (but tsc + vitest mandatory).

---

## Phase 1.5 — THE FENCE (land the protection layer BEFORE the migration it guards) · **architect + engine-specialist**

**Delivers:** §0.5 made real — all four guards in regression-guard mode + the enforcement/discoverability layer — so Phases 2–6 build **inside a fence**, not toward one. This is the owner's explicit "guardrails early" directive; it is a distinct, named phase precisely so it cannot be treated as an afterthought.

**Seams touched:**
- `packages/react/src/engine/object-model.fitness.test.ts` — `FF-ONE-PART-GRAMMAR` + `FF-RESIDENCE-AT-FIELD` (already begun in Phase 1) hardened into the shrinking-allowlist **ratchet** form (§0.5a): the meta-assertion (`ALLOWLIST.length ≤ BASELINE`) + a **BITES test** (a planted new grammar / node-level residence IS caught). *(dist-baked)*
- `packages/react/src/engine/derivedContainment.fitness.test.ts` (**new**) + a `packages/plugins` counterpart — `FF-DERIVED-CONTAINMENT` in **guard mode from here** (forbids any NEW `sliceType`/`canHaveChildren` containment read; grandfathered reads allowlisted; semantic pass proves `kpi-strip`'s kind-vs-contract is reconciled, not contradictory). *(dist-baked / app)*
- `apps/panel/src/canvas/noExternalSpecialCase.fitness.test.ts` — add the **per-kind-bridge clause** (§0.5b) + the synthetic-vs-real positive pass. *(app)*
- `.claude/project.json` — add the `ADR041-part-grammar-no-bridge` `law_pattern` (§0.5c). *(repo config)*
- **owner** pastes the CLAUDE.md / root-law / Registry §0 / resume-brief text (§0.5d).

**FF (lock):** the fence itself — all four guards green in guard mode (grandfathered sites allowlisted, no NEW violation possible), each with its BITES test proving it is not vacuous.

**Reversibility:** yes (test files + one manifest entry + doc lines) — but by design it stays for the life of the platform.

**Gate:** full green-gate + dist rebuild `packages/react` + `packages/plugins`. Not UX-visible → no :3013 note (vitest + the BITES tests mandatory). **Do not start Phase 2 until this phase is green** — the fence must exist first.

---

## Phase 2 — the three adapters (`slotParts` / `valueParts` / `sourcedParts`); BE-4 re-homes · **react-specialist** (engine adapters) + **senior-frontend-developer** (sourced app adapter)

**Delivers:** the port made real by three adapters; **BE-1/BE-4/BE-5 become three adapters of ONE mechanism**, with BE-4's HELD (uncommitted) `bandSource.ts` re-homing as the first `sourcedParts` adapter — one layer down.

**Seams touched:**
- `packages/react/src/engine/` — `valueParts` (= `bandItemsOf` reading, promoted engine-side as the `value` `PartSource`) and `slotParts` (walks `children` by the declared `slot` PartField, `accepts`-gated — its enumeration reuses the `FF-COMPOSITE-INTEGRITY` accept-set logic). Both pure, no React, no store. *(dist-baked)*
- `apps/panel/src/canvas/bandItems.ts` → its `bandItemsOf`/`BandItemRef` become the engine `valueParts` reading; the app file becomes a thin re-export (alias — byte-identical call sites). *(app source)*
- `apps/panel/src/canvas/bandSource.ts` (**BE-4, untracked/held**) → re-home: `filterSchemaBandSource` becomes the **`sourcedParts` adapter** implementing `PartSource` (residence `'sourced'`), staying in `apps/panel` because it touches the app-owned `filterSchema` SSOT (`toBarViews`/`setBarParams`/`getParamSchema`). `propsBandSource` collapses into the engine `valueParts`. The `BandMutation` union is imported from the port (KEPT verbatim). The `registerBandSource` service-locator generalizes to `registerPartSource(residence, source)`. *(app source — this is where BE-4 finally lands, under the port)*
- `apps/panel/src/studio/useCanvasController.ts` — `selectedBandSource`/`selectedBand` resolve through `enumerateParts` instead of `getBandSource(...).enumerate` (behaviour byte-identical). *(app source)*

**FF (lock):** `FF-ONE-PART-GRAMMAR` hardens (every live enumeration — kpi items, filter controls, section children — routes through the port; no adapter is reachable except via the port). **Kept green:** `FF-FILTER-ITEMS-DECLARED-BAND`, `FF-NO-EXTERNAL-SPECIAL-CASE`, `FF-COMPOSITE-INTEGRITY`. Existing e2e `bandItemSelect.e2e.ts` + `filterItemSelect.e2e.ts` stay green.

**Reversibility:** revert the adapters to the standalone `bandSource.ts`/`bandItems.ts` (still uncommitted for BE-4). No config touched.

**Gate:** full green-gate + dist rebuild `packages/react`. **:3013 live-verify:** click a KPI card → bounded selection; click a filter control → bounded selection; both docks fit.

---

## Phase 3 — the selection-triple collapse → one `PartAddress` · **senior-frontend-developer**

**Delivers:** `selectedNodeId` · `selectedItemPath` · `chromeSelection` → ONE address type (ADR-039's Composite address completed).

**Seams touched (all app source):**
- `apps/panel/src/store/constructor.store.ts` (+ `constructor.selectors.ts`, `constructor.chrome.ts`, `constructor.history.ts`) — collapse the three fields behind ONE `PartAddress` selection state; `selectNode`/`selectItem`/`selectChrome` become three constructors of the ONE `select(address)` (kept as named ergonomic wrappers so call sites stay stable). Persisted selection shape migrates behind an internal adapter — **no stored PAGE config change** (selection is session state, not page wire).
- `apps/panel/src/store/constructor.store.ts` selectors `useSelectedNode`/`useSelectedItemPath`/`useChromeSelection` become derived reads of the ONE address (byte-identical returns).
- Consumers already listed by grep (`CanvasView`, `CanvasOverlay`, `RightDock`, `builtins.tsx`, `OutlineTree`, controller) read the derived selectors → **no consumer edit beyond the store**.

**FF (lock):** a new `FF-ONE-SELECTION-ADDRESS` scaffold (the store exposes ONE address; the three legacy fields are derived, not independently settable). **Kept green:** all selection/dock fitness (`rightDock`, `dockZones`, `focusView`, `filterControlDrill`).

**Reversibility:** the address is an internal store shape; revert = restore the three fields. Session-only, no config.

**Gate:** full green-gate (app-only — no dist rebuild). **:3013 live-verify:** node select, item select, chrome select all still frame + project correctly.

---

## Phase 4 — the anchor merge → ONE part-anchor · **react-specialist**

**Delivers:** `BandItemBoundary` and the canvas node-anchor middleware (`data-node-id`) unify into ONE `PartAnchor` contract (same `display:contents`, one implementation).

**Seams touched:**
- `packages/react/src/engine/bandAnchor.tsx` → generalize to `partAnchor.tsx`: ONE `<PartAnchor residence field index>` (or `nodeId` for slot parts) emitting the SAME inert `display:contents` wrapper, keyed by a single attribute family (`data-part-*`), inert off-canvas (Fragment). `BAND_ITEM_FIELD_ATTR`/`BAND_ITEM_INDEX_ATTR` stay re-exported (alias). *(dist-baked)*
- `packages/plugins` shells that wrap band items (`KpiStripShell`, `FilterBarShell`) — one-line swap `BandItemBoundary` → `PartAnchor` (alias keeps it byte-identical). *(dist-baked)*
- `apps/panel/src/canvas/CanvasOverlay.tsx` — the overlay queries ONE attribute family for both node anchors and part anchors (the two measurement paths merge). *(app source)*

**FF (lock):** `FF-DERIVED-CONTAINMENT` scaffold begins (the overlay derives frames from anchors, not from kind). **Kept green:** `FF-PROMOTION-LOSSLESS` is *already gone* by Phase 5's ordering only if Phase 5 precedes — here it is still present and must stay green (anchor is inert off-canvas → byte-identical runtime); e2e overlay tests green.

**Reversibility:** revert to the two anchor modules (aliases make it a swap). No config.

**Gate:** full green-gate + dist rebuild `packages/react` + `packages/plugins`. **:3013 live-verify:** node frames AND item frames both draw over the real DOM.

---

## Phase 5 — D-F2: retire the shadow promotion machinery · **engine-specialist** + **plugins-specialist**

**Delivers:** the two-theories fight ends — BE-1 band selection is THE answer; the `kpi-card` promotion residence is removed (render-side; it was never wired live).

**Seams touched:**
- `packages/react/src/engine/promotionMode.ts` — **deleted** (`enablePromotion`/`disablePromotion`/`isPromotionEnabled`/`withPromotion`). *(dist-baked)*
- `packages/plugins/panels/kpi-strip/card/` — **deleted** (`KpiCardNode.ts`, `KpiCardShell.tsx`, `kpiSpecToCardNode.ts`, `meta.ts`, `index.ts`, `promotion-lossless.fitness.test.tsx`). The `kpi-strip` value-band path is the sole residence. The one genuine render-facet win (visibility) is preserved on the value-band render path: `when → view.visibleWhen` gated by `renderNode` step 0.5, retiring the private `kpiVisible` seam **without** a second residence. *(dist-baked)*
- `packages/plugins/panels/index.ts` — drop the `kpi-card` registration. *(dist-baked)*
- `packages/plugins/__tests__/object-model-residence.fitness.test.ts` — drop the `FF-NO-FACET-REINVENTION` promotion allow-list entries now moot.

**FF (lock):** `FF-PROMOTION-LOSSLESS` **retired** (no second residence to prove parity against — recorded in ADR-041). `FF-ONE-PART-GRAMMAR` tightens (no shadow node type shadows a value band). **Kept green:** kpi-strip render + `bandItemSelect.e2e.ts` (the live path is unchanged).

**Reversibility:** this is still `expand`→`contract` on a **dark** (never-live) surface, so it is behaviourally reversible from git, but it is the first *deletion*. Confirm via grep that no live code path calls `isPromotionEnabled`/`kpiSpecToCardNode` before deleting (the flag defaults OFF → dead).

**Gate:** full green-gate + dist rebuild `packages/react` + `packages/plugins`. **:3013 live-verify:** kpi-strip renders + cards selectable exactly as before (no visual change — the retired path was dark).

---

## Phase 6 — derive wrapper/leaf; remove kind-as-mechanism reads · **engine-specialist** · **⚠️ ONE-WAY (gated like ADR-023 R2)**

**Delivers:** the owner's wrapper/leaf split gets its ONE home — wrapper ⇔ declares ≥1 part field — and no mechanism reads the KIND to answer a containment question. **This is the sole irreversible step.**

**Seams touched:**
- `packages/react/src/engine/` — replace every *read* of `sliceType`/`canHaveChildren` used **as a containment mechanism** with the derived predicate `isWrapper(meta) = partFieldsOf(meta).length > 0`. `sliceType` **remains** as a palette/behaviour-routing discriminant (page/chrome/control identities are real — diagnosis §1a #2); only its use as a *containment* signal is removed. `PanelSliceMeta.canHaveChildren?: false` may stay as a compile-time refinement, but no runtime path branches on it for "does this contain?". *(dist-baked)*
- `packages/react/src/engine/slice-meta.ts` — de-alias `BandDescriptor` into the `sourced` `PartField` form as the canonical declaration (the `band?:` field either becomes a `PartField` of residence `sourced`, or stays as a thin documented alias — the de-alias contract decides). *(dist-baked)*

**FF (lock):** `FF-DERIVED-CONTAINMENT` becomes a **hard `[]` gate** — machine-green over EVERY registered META and every stored corpus config that no kind/flag contradicts the declared part fields, and no containment read of `sliceType`/`canHaveChildren` survives outside the registry-view layer.

**Reversibility:** **NONE — this is the one-way door.** Gate exactly like ADR-023 R2: land ONLY when FF-DERIVED-CONTAINMENT is green across the whole corpus, reviewed by the owner. If any META still needs a kind-read for containment, HALT and treat that META as under-declared (fix the DECLARATION, don't keep the read).

**Gate:** full green-gate + dist rebuild + full corpus fitness + **owner sign-off** on the one-way step. **:3013 live-verify:** every wrapper (section, kpi-strip, filter-bar) and every leaf (chart) behaves identically.

---

## The DoD proof — the circle is structurally closed (NO new bridge)

After Phase 2 (all three residences live under the port), add **table columns** as a NEW selectable/authorable kind **through DECLARATION ONLY**:

- In `packages/plugins/panels/table/` META, declare `columns` as a **`value` PartField** carrying an `itemSchema` (each column's per-column contract) — reusing the `value` residence, **zero new adapter, zero engine change, zero app change.**
- Result: each table column is immediately selectable on the canvas (`valueParts` enumerates it), framed by the ONE part-anchor, projected into the dock as its own bounded contract — with **no `if type === 'table'`, no new bridge, no BE-x**.

This is the structural test the diagnosis names: BE-1/BE-4/BE-5 were bridges because containment had four grammars; once it is ONE port, the next kind is a declaration. *(Parallel proof available with **hero-card items** — also `value` residence — if the owner prefers a content node over a data panel; either closes the circle identically.)*

---

## Phase list (owner routing) — in order

| # | Phase | Owner-role | FF locked | Gate |
|---|---|---|---|---|
| **1** | ROOT-3 Part port + ROOT-2 PartField grammar (aliases) | **engine-specialist** | `FF-ONE-PART-GRAMMAR` (guard) · `FF-RESIDENCE-AT-FIELD` (guard) | green-gate + `packages/react` dist |
| **1.5** | **THE FENCE** — regression guards + enforcement/discoverability (§0.5) | **architect + engine-specialist** | all 4 guards in **ratchet form** + `law_pattern` + CLAUDE.md/registry/resume law text | green-gate + dist (**gate Phase 2 on this**) |
| **2** | Three adapters (`slotParts`/`valueParts`/`sourcedParts`); BE-4 re-homes | **react-specialist** + **senior-frontend-developer** | `FF-ONE-PART-GRAMMAR` → `[]` · keep `FF-FILTER-ITEMS-DECLARED-BAND`/`FF-COMPOSITE-INTEGRITY`/`FF-NO-EXTERNAL-SPECIAL-CASE` | green-gate + dist + :3013 |
| **3** | Selection-triple → one `PartAddress` | **senior-frontend-developer** | `FF-ONE-SELECTION-ADDRESS` (scaffold) | green-gate (app-only) + :3013 |
| **4** | Anchor merge → one `PartAnchor` | **react-specialist** | `FF-DERIVED-CONTAINMENT` (scaffold begins) | green-gate + `react`+`plugins` dist + :3013 |
| **5** | D-F2 retire shadow-promotion | **engine-specialist** + **plugins-specialist** | retire `FF-PROMOTION-LOSSLESS`; tighten `FF-ONE-PART-GRAMMAR` | green-gate + `react`+`plugins` dist + :3013 |
| **6** | Derive wrapper/leaf; kill kind-as-mechanism reads **⚠️ one-way** | **engine-specialist** | `FF-DERIVED-CONTAINMENT` → hard `[]` gate | green-gate + full corpus + **owner sign-off** |

**What Phase 1 delivers, in one sentence:** the engine-level Part port (`enumerateParts`/`writePart`, one `(nodeId, partPath?)` address, `BandMutation` kept) plus the unified `PartField` reading of `SlotDef`/value-band/`BandDescriptor` via byte-identical aliases — additive, reversible, zero config migration, the root every later phase migrates onto.
