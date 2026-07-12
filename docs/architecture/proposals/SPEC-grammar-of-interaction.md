# SPEC — The Grammar of Interaction (AR-42): the explorable-instrument layer on the Part substrate

> **Status:** DESIGN (decision-grade; no code). Lead-championed direction for the owner to bless.
> **Registry:** AR-42 (PROPOSED → this SPEC). **Governed by:** ADR-038 (Bounded Element Law) · **ADR-041** (the Part grammar + Part port — the address space an interaction links across). **Extends (never forks):** AR-36 (`DESIGN-grammar-of-interaction.md`, runtime pivot — P0–P3 in code) · AR-38 (`DESIGN-directional-sector-crossfilter.md`, the ad-hoc directional cross-filter this generalizes). **Interplay:** AR-40 (semantic layer, LIVE — the governed substrate) · AR-41 (reactive dataflow, PROPOSED — the Consumer-recompute optimization).
> **Author:** platform-architect. **Design-only run** — no packages/apps/provisioning touched.

---

## 0. Thesis in one paragraph

The platform already renders a static config-driven dashboard where every element is a declared **Part** reachable through ONE port (`enumerateParts`/`writePart`, ADR-041). An **interaction** is therefore not new plumbing — it is a **declared relationship between Parts**: a gesture on Part A writes a shared **state cell**, which Part B **references** and recomputes from. That triad — *state cell · a producer that writes it · consumers that read it* — is exactly the primitive set the whole visualization field converged on (Vega-Lite `param`), and **statdash already implements all three** (filter-param SSOT · `on[]`→`useNodeInteractions`→CommandBus · `{$ctx}`/`{$ref}` refs in DataSpec/encoding/pipe). The Grammar of Interaction is the act of (a) **naming** that triad as ONE authorable vocabulary, (b) **lifting its source and target from the node to the Part** (so a KPI card, a filter control, a table column can each drive or receive a scope — for free, via the port), and (c) **retiring the one ad-hoc instance** (AR-38's hand-authored six-derive directional truth-table) into ONE declared, reusable, dimension-blind relation. Static dashboard → explorable analytical instrument, with **no new runtime plane** and **no functions in config** (Law 2).

---

## 1. What the field converged on (benchmark → the minimal canonical set)

The question the brief poses — *"the minimal canonical primitive set for «a selection on one view parameterizes another»"* — has a well-attested answer. Every mature system reduces to the same three roles under different names:

| System | The state cell | The producer (emit) | The consumer (read) |
|---|---|---|---|
| **Vega-Lite / Vega** | `param` (value param **or** `selection` point/interval) | a `selection` bound to a mark gesture (`on`, `bind`) | conditional encoding (`condition`), `filter` transform, scale domain referencing the param |
| **Observable Plot / Framework** | a reactive `view`/input value | `Plot.pointer` / an `Inputs.*` control | any cell that *references* the reactive value (dataflow auto-recompute) |
| **Superset / PowerBI / Tableau** | a cross-filter / dashboard filter | click-to-cross-filter, a filter control, an "action" | every chart whose query is scoped by the filter |
| **Grafana** | a dashboard **variable** | a variable dropdown / a data link setting a var | `${var}` / `__value`/`__field` interpolation in queries & links |
| **Malloy / Cube** | a governed drill path / parameter | a drill gesture on a governed field | the re-run governed query at the drilled grain |

**The converged minimum is THREE primitives, not four:** a **Param** (named state), a **Selection** (a view-gesture that writes a Param), and a **Reference** (a place a Param is read). Vega-Lite is the crispest statement: `param` + `selection` + `condition`/`filter`. The "link" the brief names ("source Part → target scope") is **not a fourth primitive** — it is the *composition* of a Selection writing a Param that a Reference reads, matched by the shared Param name (the Observer pattern rendered as data). Treating the Link as first-class runtime would fork the spine; the field never does, and neither should we (§7 rejected alt 1).

**Where statdash already stands against this trio** (code-grounded, not aspirational):

| Primitive | Statdash today | Seam (file) |
|---|---|---|
| **Param** | a filter param (URL-permalink SSOT) + a derived page/node `var` | `RenderContext.filterParams` · `vars` · `SectionContext.dims` |
| **Selection** | `NodeBase.on[] : NodeEventHandler[]` → `useNodeInteractions.emit(trigger,row)` → `applySelection` reducer → ONE CommandBus write (`filter:set`/`filter:setMany`) | `node-events.ts` · `useNodeInteractions.ts` · `applySelection.ts` · `commands.ts` |
| **Reference** | `{ $ctx: dim }` / `{ $ref: var }` resolved by the ONE dispatcher, in query-filter, **encoding channel** (AR-36), **pipe param** (AR-36) | `ref.ts resolveRef` · `resolveEncodingRefs` · `resolvePipeRefs` |

**Conclusion:** we are not building the grammar from zero — we are **completing and generalizing a grammar that is 80 % present and already at reference grade at the node level.** The two genuine gaps are *(i)* the source/target are node-scoped, not Part-scoped, and *(ii)* the one non-generic instance (AR-38) hand-codes its relation. This SPEC closes exactly those two.

---

## 2. The primitives, on the Part substrate (the declared vocabulary)

Four declared vocabularies, ONE runtime spine (the existing CommandBus write point). All JSON, all Constructor-authorable, all function-free (Law 2). Each is either *present* or an *additive union arm* — never a new mechanism.

### 2.1 `Param` — the shared state cell (EXISTS, unchanged)

A named entry in the filter-param / `vars` space. It is the **only** medium an interaction flows through — no parallel selection store (Law 1, SSOT, `FF-XF-ONE-WRITE-POINT`). It round-trips through the URL (permalink) and lives in `SectionContext.dims` (the OLAP coordinate) or a derived `var`. *Vega-Lite `param`; Grafana variable.* **No change** — this is the invariant every other primitive rides.

### 2.2 `Selection` — a Part emits when interacted-with (GENERALIZE node → Part)

Today `on[]` is declared on `NodeBase` and `useNodeInteractions` reads it at the node shell. Under ADR-041 a **value-band item** (a KPI card, BE-1), a **sourced control** (a filter control, BE-4), and a **slot child** (a section panel, BE-5) are all Parts enumerated through `enumerateParts`. The generalization:

> **A `Selection` is an `on[]` handler declared on a Part's contract; the emit carries the emitting `PartAddress` `(nodeId, partPath?)`; it is discovered through the Part port, not through a per-type registry.**

- **Trigger set** (widen additively): `point:click | interval:brush | row:hover | row:click | input:change | selection:change`. `interval:brush` is the one genuinely new gesture (brush → a range Param); it rides `applySelection` with a new `interval` mode (§2.3). Everything else exists.
- **Source = a Part.** A KPI card declares `on[]` in its `itemSchema`; a table column declares it on its column `itemSchema`; a filter control already emits via the filter-bar. The runtime adapter generalizes `useNodeInteractions(def,ctx)` → **`usePartInteractions(part,ctx)`**, where `part` is an `EnumeratedPart` (its `subject` supplies the clicked datum, its `address` tags the emit). Because the port enumerates parts uniformly, **no shell special-cases which kinds can emit** (the `FF-NO-EXTERNAL-SPECIAL-CASE` tooth extends to interaction sources).
- **Declaration** (unchanged shape, now legal on any Part contract):
```jsonc
"on": [{ "event": "point:click",
         "actions": [{ "type": "filter", "key": "sector", "fromField": "sector", "mode": "toggle", "max": 10 }] }]
```

*Vega-Lite `selection` bound to a mark; Superset click-to-cross-filter. Part-port tie-in: the emit source is a `PartAddress`, so "click THIS card" is expressible — which node-level `on[]` cannot say.*

### 2.3 `Action` — what the emit does to the target scope (WIDEN the union — OCP)

`NodeAction` is today a one-arm union (`FilterAction`). The grammar is the **discriminated union**, each arm a capability, each folding through the **same CommandBus point** (`FF-XF-ONE-WRITE-POINT`):

| Arm | Effect | Target scope | State today |
|---|---|---|---|
| `FilterAction` | scope a Param (`replace`/`toggle`/`clear`) | a filter param | **LIVE** (`node-events.ts`) |
| `HighlightAction` | write a **transient** highlight Param a Consumer reads in an encoding *condition* — **no requery** | a highlight param | NEW arm (linked highlighting) |
| `PivotAction` | rotate encoding channels (re-encode) | the pivot/axis param | DESIGNED, AR-36 P4 (`applyPivot`) |
| `ScopeAction` | re-base / normalize (index-to-100, share-of-total, per-capita) by pinning a base coordinate | a base-coordinate param (composes with `MetricInput.at`, AR-50 M3.2) | NEW arm (drill/scope) |
| `DrillAction` | navigate / drill-through, carrying the source `PartAddress` as params | `nav:drill` (EXISTS as `dataLinks` navigate) | fold the existing `dataLinks` drill branch into the union |

New capability = **new arm = OCP** (interpreter/union interface unchanged) — the identical "new kind = declaration" property the Part grammar has. Every arm targets a **scope descriptor** that is a Param key today and — once §2.2 lands — may be a **Part-scoped** Param (a param namespaced to a target `PartAddress`, so "A filters only B" is expressible without a page-global param).

`applySelection` (the pure reducer) gains one mode: `interval` (a `[lo,hi]` range Param encode, peer of the CSV `= ANY` encode) — so `interval:brush` and range consumers round-trip through the same encode/decode SSOT (`splitMultiValue`'s range peer).

### 2.4 `Link` — the declared source→target relation (SUGAR that compiles to §2.1–2.3; Constructor-facing)

The brief's "link/binding (source Part → target scope)." **It is not a runtime plane** — it is an authoring projection that lowers to (a Selection on the source) + (a Param) + (a Reference on the target). Its value is threefold: it lets the Constructor author "A drives B" as ONE object (drag from Part A to Part B), it makes the relation **introspectable/lineage-visible**, and it lets a *reusable relation law* (the directional-pivot of §3) be named once instead of hand-derived per page.

```jsonc
// page-level `links: LinkDef[]` (peer of `vars`) — endpoints are PartAddresses the port enumerates
{ "from":   { "nodeId": "filter-bar", "partPath": "page-filters.sector" },  // a sourced Part (BE-4)
  "on":     "input:change",
  "to":     { "nodeId": "sectors" },                                        // a slot Part (the composition)
  "action": "directional-pivot",                                            // a NAMED relation law (§3)
  "focus":  "sector", "co": "geo", "priority": ["sector", "region"] }
```

**Composition with the Part port (the homoiconic point):** a Link is *itself an authorable declared relation over the Part address space* — its `from`/`to` are `PartAddress`es the port supplies, and a canvas-authored Link is written through `writePart`/`updatePage` like any declared edit. The Part grammar owns **constituents** (what an element *has*); the Interaction grammar owns **relations between constituents** (what an element *drives*) — two orthogonal declared layers, the second built strictly on the first's address grammar. No fifth mechanism; the Link *reuses* the enumeration it does not fork.

---

## 3. Generalizing AR-38 — the Strangler proof (retire the special case)

**AR-38 today** (`DESIGN-directional-sector-crossfilter.md`): selecting a sector reorients the regional composition (`x=geo, series=sector`, narrowed) via **six hand-authored `vars` derives** (`_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir`), each a nested `op:if` truth-table keyed on `region ∧ sector` with a sector-priority tiebreaker. The emit (a filter control writing `sector`) is already generic; the consume (`{$ctx:_xDim}` in encoding/pipe) is already generic. **The ad-hoc part is precisely those six derives** — the directional *law* is smeared across per-page config, so "give any two dims a directional cross-filter-pivot" means re-authoring six nested `op:if`s by hand every time. That is the interaction analogue of ADR-041's "four containment grammars": the model re-asks *"who is the focus, who is the co-dim?"* once per page, answered each time by a locally-lawful hand-derivation.

**Under the grammar, the six derives collapse to ONE declared, dimension-blind relation** — the directional-pivot law named once:

- **As a runtime derive (the minimal, recommended form):** one new generic var op — `{ "op": "directional", "focus": "sector", "co": "geo", "priority": ["sector","region"], "emit": "axis" }` — resolved by a pure, dim-blind `resolveDirectional(params, spec)` in `packages/core` that RETURNS the same `_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir` assignment the six `op:if`s produce. It rides the existing `evalVarMap`/expr seam (a new op = OCP, exactly like any expr op) and the existing `resolveEncodingRefs`/`resolvePipeRefs` consumers — **zero engine change beyond the one op, zero new plane.** The directional law ("selected dim → `series`+pinned; co-dim → `x`; priority breaks compound ties") becomes reusable canon: any two dims get it by declaring the op.
- **As authoring sugar (Phase 4):** the `Link` of §2.4 with `action:"directional-pivot"` compiles to (the emit on the controls, already live) + (the `op:directional` var) + (the `{$ctx}` consumers, already live).

**The Strangler retirement:** the regional page's six `op:if` derives are replaced by ONE `op:directional` var; the A/B/C/D state matrix (`DESIGN-directional-sector-crossfilter.md` §2) is asserted byte-identical (`FF-DIRECTIONAL-TRUTH-TABLE` re-pointed at the op); the old derives are deleted only after parity verifies. **This is the proof the grammar generalizes:** AR-38 stops being a bespoke design doc and becomes ONE declared instance of a reusable relation — the same "the next kind is a declaration, not a bridge" property ADR-041 proved for containment.

---

## 4. Capability model — what becomes possible for free once declared

Each capability is a **declaration** (a trigger arm, an action arm, a var op, or a Reference site) — never a new subsystem. This is the payoff, mirroring the Part grammar's "new kind = declaration":

| Capability | The declaration | New mechanism? |
|---|---|---|
| **Cross-filter** (any Part → any Part) | a `FilterAction` Selection on the source Part + a `{$ctx}` Reference on the target | none (LIVE at node level; Part-level via §2.2) |
| **Brush-to-filter** | trigger `interval:brush` + `applySelection` `interval` mode → a range Param | one trigger + one reducer mode |
| **Drill-through** | a `DrillAction` → `nav:drill`, carrying the source `PartAddress` | fold existing `dataLinks` navigate into the union |
| **Linked highlighting** | a `HighlightAction` → a transient highlight Param read in a Consumer's encoding *condition* (no requery) | one action arm |
| **Pivot / re-encode** | `PivotAction` + state-bound encoding channels | AR-36 (P0–P3 in code; P4 the verb) |
| **Param bound to a control** | a sourced filter-control Part *is* this (BE-4); generalize "any Part binds a Param" | none (Vega-Lite `bind`, already our BE-4) |
| **Directional cross-filter-pivot** | one `op:directional` var (§3) | one generic var op (retires 6 hand-derives) |
| **Scope / re-base** (index-100, share, per-capita) | a `ScopeAction` pinning a base coordinate, composed with `MetricInput.at` | one action arm (rides AR-50) |

**The introspection property:** because sources and targets are Parts enumerated through the port, the Constructor's interaction palette is a **projection of `enumerateParts`** — it browses "which parts can emit / receive" with zero bespoke per-type interaction registry. Interaction authorability is *derived from the same declaration* as selection, inspection, and lineage — the homoiconic ideal extended from structure to behavior.

---

## 5. Phased build (Strangler-Fig · reversible increments · fitness-gated)

Each phase is `expand`-only and independently shippable. **One-way steps are flagged;** there are none through Phase 3.

| Phase | Deliverable | Layer | Reversible? | FF gate |
|---|---|---|---|---|
| **P0 — name the grammar** | this SPEC; register AR-42 canonical; document that Param+Selection+Reference already = the Vega-Lite param model (the gap is Part-source + union breadth + the AR-38 special case) | docs | yes | — |
| **P1 — widen the Action union + Trigger set** | add `HighlightAction` arm; add `interval:brush` trigger + `applySelection` `interval` mode; fold the existing `dataLinks` navigate branch into a `DrillAction` arm | `packages/react` (`node-events.ts`, `useNodeInteractions.ts`) + `packages/core` (`applySelection.ts`) — **additive** | yes (revert union arms) | `FF-ACTION-UNION-OCP` (a new arm needs no interpreter edit) · `FF-XF-ONE-WRITE-POINT` (holds) |
| **P2 — generalize AR-38 → `op:directional`** (the Strangler proof) | one pure dim-blind `resolveDirectional` var op in core; re-author the regional page's six `op:if` derives as ONE `op:directional` var; **delete the six derives after parity** | `packages/core` (one op) + provisioning | yes (Strangler: old derives live till parity) | `FF-DIRECTIONAL-TRUTH-TABLE` (A/B/C/D byte-identical) · `FF-DIRECTIONAL-AGNOSTIC` (no dim literal in the op — Law 1) |
| **P3 — Part-level emit source** ⟂ *needs ADR-041 Phase 2* | promote `useNodeInteractions` → `usePartInteractions`; a value-item / column / control declares `on[]` in its `itemSchema`; the emit carries the emitting `PartAddress`, enumerated via `enumerateParts` | `packages/react` (adapter) + `packages/plugins` (shells read the port) | yes (adapter alias) | `FF-EMIT-SOURCE-IS-A-PART` (any enumerated part with a declared `on[]` emits; no per-type wiring) · extends `FF-NO-EXTERNAL-SPECIAL-CASE` |
| **P4 — the `Link` + Constructor surface** (AR-10/AR-42) | page-level `links: LinkDef[]` sugar compiling to §2.1–2.3; an authoring UI that enumerates interaction-capable Parts via the port and authors a Link by picking (source, trigger, target, action), written through `writePart` | `packages/react` (compile) + `apps/panel` (authoring) | yes | `FF-LINK-LOWERS` (a Link produces byte-identical runtime to the hand-authored triad) · `FF-INTERACTION-ROUNDTRIP` (lossless authoring) |

**Sequencing constraint (flag):** **P3 depends on ADR-041 Phase 2** (the three Part-port adapters — `slotParts`/`valueParts`/`sourcedParts` — being live). P1/P2/P4-sugar are independent of ADR-041 and ride the proven node-level spine now. **The only latent one-way step** is a *later, deferred* contract move — demoting node-level `on[]` in favor of Part-only emit — which is NOT in this plan; if ever taken it is gated exactly like ADR-023 R2 / ADR-041 Phase 6 (owner sign-off, corpus-green). Nothing here forces it.

**Recommended P1 slice (highest proof, lowest risk):** **P2 — the `op:directional` generalization of AR-38.** It rides the in-code AR-36/38 spine (zero ADR-041 dependency), delivers the Strangler proof (six hand-derives → one declared reusable relation), is provisioning + one additive core op (fully reversible), and demonstrates the whole thesis — *"one declared relationship, not per-page logic"* — before P3's Part-source generalization needs the port. Pair it with P1's `HighlightAction`+`interval:brush` (additive union arms) for a visibly-explorable first increment (brush + linked highlight) that needs no engine re-seam.

---

## 6. Trade-offs (ISO 25010) + interplay with AR-40 / AR-41

**What the grammar buys:** *usability* (a static dashboard becomes explorable — the ONS/Eurostat explorable class and beyond) · *maintainability/modifiability* (a new interaction = a declaration, not a subsystem; AR-38's bespoke design doc dissolves into one declared op) · *reusability* (the directional law, brush, highlight are ship-once capabilities the Constructor browses) · *reliability* (one CommandBus write point, URL-permalink SSOT — no parallel selection store to desync).

**What it costs:** a widened `NodeAction` union + one reducer mode + one var op (a small, bounded additive surface) · the Constructor interaction-authoring UI is genuine new UX work (P4, YAGNI-gated behind a real authoring consumer) · P3 is *coupled to ADR-041 Phase 2 landing* — a scheduling dependency, not a technical risk.

**Interplay — is AR-42 the right next epic, or does one precede it?**

- **AR-40 (semantic layer) — DONE/LIVE; it is a completed *enabler*, not a blocker.** The Params an interaction scopes are governed dims/measures; a cross-filter that rescopes a governed metric ("one number everywhere") is only *meaningful* because AR-40 landed. AR-42 builds ON it. `ScopeAction`/re-base compose with AR-50 M3.2's `MetricInput.at` coordinate. **AR-40 precedes AR-42 and already has.**
- **AR-41 (reactive dataflow) — an *optimization of the Consumer recompute*, orthogonal to the vocabulary; it does NOT precede AR-42.** Today's Reference side recomputes via React memo deps on `ctx.dims`/`vars` — coarse-grained but correct, and the cross-filter is live at that grade. AR-41 makes many-linked-view fan-out *incremental*; AR-42 makes the *vocabulary* rich. AR-42 needs no AR-41; AR-41 becomes worth building **when a real linked-view fan-out creates a measured perf need** (YAGNI). Build AR-42 first; reach for AR-41 when explorability scales past coarse recompute.
- **ADR-041 (Part grammar) — mid-build; gates only AR-42's P3.** P1/P2/P4-sugar proceed independently now.

**Recommendation for the owner:** **Bless AR-42 as the next vocabulary epic, starting with P2 (the `op:directional` generalization of AR-38) + P1 (highlight + brush arms).** These are additive, reversible, ride the proven in-code spine, and deliver the Strangler proof plus a visibly-explorable increment with no engine re-seam and no ADR-041 dependency. Sequence P3 (Part-level emit) behind ADR-041 Phase 2. Treat AR-41 as a later, need-driven optimization, not a prerequisite.

---

## 7. Rejected alternatives (≥2)

1. **A first-class `Link`/interaction RUNTIME plane** (a wiring graph resolved independently of `on[]`+param). *Rejected:* forks the spine — a second state path competing with the filter-param SSOT, violating `FF-XF-ONE-WRITE-POINT` and Law 1. No reference system does this; Vega-Lite's `selection` writes a `param`, it is not a sidecar. The Link stays **authoring sugar that lowers to the triad** (§2.4).
2. **A parallel `SelectionContext` (a dedicated selection store beside filter params).** *Rejected:* the platform proved (cross-filter memory + AR-36/38) that *selection IS a filter param* — URL-permalink, one CommandBus write, store-read as `= ANY`. A second store re-introduces the manual-invalidation bug-class AR-41 exists to kill and breaks permalink determinism.
3. **Functions/expressions-as-callbacks in config** (`onClick: (ctx) => …`). *Rejected:* Law 2 — not serializable, not Constructor-ready. Behavior lives in the renderer/registry; config declares intent (`action`/`op`) only.
4. **Keep AR-38's six hand-authored derives (do nothing).** *Rejected:* that is the interaction analogue of ADR-041's "four grammars" — the directional law re-asked per page, each answer a locally-lawful hand-derivation; every next two-dim cross-filter-pivot re-authors six nested `op:if`s. The `op:directional` op retires the class.
5. **A dedicated `interaction` node type / DataSpec kind.** *Rejected:* speculative generality (YAGNI) and it forks the resolve path; an interaction is a *relation over Parts*, expressed by the existing `on[]` + ref + var seams, not a new node/spec kind.

---

## 8. The three required closers

**The minimal primitive set (1 paragraph).** The field converged on **three** primitives, not four: a **Param** (named state — our filter-param/`vars` SSOT, URL-permalink), a **Selection** (a view-gesture that writes a Param — our `on[]`→`useNodeInteractions`→CommandBus, generalized from node to **Part** so the emit carries a `PartAddress`), and a **Reference** (a place a Param is read — our `{$ctx}`/`{$ref}` in query-filter/encoding/pipe). The brief's "link" is the *composition* of a Selection and a Reference over a shared Param, not a fourth mechanism; it surfaces only as **authoring sugar** (`LinkDef`) that lowers to the triad. Statdash already implements all three at reference grade at the node level — the grammar is *completion + Part-lift*, not greenfield.

**The AR-38-generalization proof.** AR-38's emit and consume are already generic; its only ad-hoc part is the **six hand-authored `vars` derives** encoding the directional-pivot law per page. The grammar collapses them into ONE declared, dimension-blind var op — `{op:"directional", focus, co, priority, emit:"axis"}` — resolved by a pure `resolveDirectional` that returns the identical `_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir` assignment, riding the existing `evalVarMap`/`resolveEncodingRefs`/`resolvePipeRefs` seams with zero new plane. The A/B/C/D state matrix is asserted byte-identical, the old derives Strangler-deleted after parity: AR-38 stops being a bespoke design and becomes ONE declared instance of a reusable relation — the "next kind is a declaration, not a bridge" property, now for interaction.

**Recommended Phase-1 slice + AR-42 vs AR-40/AR-41.** Start with **P2 (the `op:directional` generalization of AR-38) + P1 (add `HighlightAction` + `interval:brush` union arms)** — additive, reversible, provisioning + one core op + additive union arms, riding the proven in-code AR-36/38 spine with **no ADR-041 dependency and no engine re-seam**, delivering both the Strangler proof and a visibly-explorable increment (brush + linked highlight). Sequence P3 (Part-level emit source) behind **ADR-041 Phase 2** (the three port adapters). **AR-40 precedes AR-42 and already landed** (the governed substrate that makes a rescoping cross-filter meaningful). **AR-41 does NOT precede AR-42** — it is an orthogonal Consumer-recompute optimization, worth building only when linked-view fan-out creates a measured perf need (YAGNI). **AR-42 is the right next epic;** bless P1+P2 now.
