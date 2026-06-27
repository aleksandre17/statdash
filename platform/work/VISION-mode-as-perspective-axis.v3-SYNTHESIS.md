# VISION #3 — `perspective` axis: FINAL HOLISTIC SYNTHESIS (capstone-of-capstones)

> The last paper. Synthesizes the whole `perspective`-axis corpus (`.v3.md` + `.v3-PLAN.md` + `.v3-FULLSTACK.md` + `.v3-FULLSTACK-BENCHMARK.md`) into one verdict, pushed to maximum simplicity + agnosticism + power + quality, with the FUTURE VISIONS shaped into the seams TODAY (doors, not features). Design-only — **zero code changed.** Ground-truth-verified against the live tree 2026-06-27.
> Author: architect (Opus). This doc does not re-derive the design — it adversarially hardens it, cuts what is non-essential, sweeps for any best-concept still missing, defines the deferred doors as proven non-breaking seams, and renders a final build/no-build verdict.
> **Thesis, restated and stress-tested one last time (§7): it holds.** `mode` is not a privileged dimension and not a captured snapshot — it is a *named query-perspective over the cube*, modelled as one generic declarative axis with the active id in a generic `ctx.perspectiveState: Record<string,string>` (Harel orthogonal regions). The corpus is correct. This synthesis makes it *minimal* and *future-shaped*, then says: build it.

---

## 0. Executive summary (the synthesis verdict in one screen)

1. **The design is EXCEPTIONAL and READY. Build it — start P0 + P-opt.** Across four docs the corpus is internally consistent, ground-truth-accurate (every path I re-checked holds: `perspectiveState`/`PerspectiveAxis` are green-field, `SectionContext.timeMode` is the privileged field at `context.ts:58`, `ScopeOverride.compare` is real and half-built at `scopeOverride.ts:37`, `renderNode.ts:229` reads `ctx.mode.current`), Law-1/Law-2/arrow-clean, and competitor-beating. There is **no substantive architectural gap left.** The remaining items are a build sequence and one data-inventory check — not design.

2. **Three SIMPLIFICATIONS to cut now (the only accidental complexity I found, §1):**
   - **Collapse `snapshot` from a config field into a render-call option.** `snapshot:'active'|'all-perspectives'` is *not* an authored property of a page — it is a property of *how a caller renders* (interactive client = active; PDF/bulletin export = all). Putting it in `PerspectiveAxis` config is a category error (it serializes a render intent into the artifact). **Cut it from the contract; pass it as a `renderPage(config, { snapshot })` option.** This removes a field from the contract, from the JSON-Schema, from the served manifest, from the round-trip corpus, and from the coverage gate — and makes the SSR-walker/export the one place that knows it. (The corpus already half-saw this — P-opt threads it through `StaticRenderContext`, the render call, not the config. The full-stack doc then re-froze it into config. Resolve in favour of the render option.)
   - **`PerspectiveDef.when?` is redundant with the default and should stay strictly an escape hatch — name the rule, do not widen it.** The corpus already defaults `when` to `perspective-is(id)`. Confirm: `when` is **omitted in 100% of the geostat migration** (the gate is always `perspective-is(self)`). It exists only for a node that belongs to a perspective by a *non-identity* rule (e.g. "show in year OR compare"). Keep the field (cheap, OCP), but the FF must assert the common path never authors it — an authored `when: perspective-is(self)` is the duplication smell (it restates the id). Add **FF-WHEN-IS-ESCAPE-ONLY**.
   - **Do not introduce `perspectiveAxes` (plural) as a named future field. Make the axis itself a registry, keyed by `param`.** The corpus defers multi-axis as "a future `page.perspectiveAxes` plural." That is a second container for the same concept. Cut it: `page.perspectiveAxis` becomes `page.perspectives: PerspectiveAxis[]` *now in shape* (an array, length-1 today), OR — cleaner — the axis is looked up by `param` from a `Record`. The active-id container is already a `Record<param,id>`; the *definition* container should mirror it (axes keyed by `param`). One container shape for both definition and state. (§4 door D-MULTIAXIS.) This is a naming/shape decision to lock at P0 so the plural never needs a rename.

3. **AGNOSTICISM re-verified clean (§2).** Nothing privileges time/year/range/mode/a tenant/a framework in the shipped core. `timeBinding.dim` is generic; the active id is a generic `Record`; `perspective-is` reads `perspectiveState[param]` with no literal. The one residual leak the corpus correctly flags — the *string* `'perspective'` as the conventional default param name — is a **default, not a privilege** (any page may name its param anything; the engine never branches on the literal). Confirmed. One **new** agnosticism guard I add: the `scope` object must be validated as *generic-key* (a `Record` of registered scope-keys), never a closed `{timeBinding, metric}` interface that would have to be widened per door — see §1.4 and FF-SCOPE-KEYS-REGISTERED.

4. **RESEARCH sweep (§3): the corpus already stole the right things; two genuinely additive concepts are worth shaping in, both as DEFERRED seams, neither built now:**
   - **Statechart *history* + *guards* (XState/Harel, beyond orthogonal-regions which the corpus already has).** The `Record` container is the orthogonal-regions steal. The two not-yet-stolen Harel concepts are (a) **history states** — "return to the perspective I last had on this axis" (deep-linkable, already free because the id lives in the URL) and (b) **guarded transitions** — `PerspectiveDef.when` is already a guard on *visibility*; a guard on *availability* ("range perspective only offered when ≥2 years of coverage exist") is the missing twin. Shape it as `PerspectiveDef.available?: VisibilityExpr` (§4 door D-GUARD) — additive, reuses the evaluator, closes the "perspective offered but empty" UX hole. **Not built now.**
   - **Faceting as a *Grammar-of-Graphics operator*, not a perspective sub-key (Wilkinson/Wickham/Vega-Lite `facet`).** The corpus files `facet` under `scope.facet`. Research says that is the wrong home: faceting is "render f(state) across *all* values of an axis simultaneously" — it is a property of *the axis*, not of *one perspective's scope*. A faceted axis renders every perspective at once (small multiples); a non-faceted axis renders the active one. So `facet` belongs on `PerspectiveAxis` (`mode: 'switch' | 'facet'`), not on `PerspectiveDef.scope`. This is the cleaner seam and it makes trellis a one-line axis flag (§4 door D-FACET). **Not built now** — but locating the seam correctly today costs nothing and saves a rework.

5. **FUTURE DEFINED TODAY (§4 — the roadmap table).** Seven doors, each proven a pure additive change on the P0/P1 seams: D-FACET (axis flag), D-GUARD (availability guard), D-MULTIAXIS (Record-keyed axes), D-COMPARE (the live `ScopeOverride.compare` anchor → a perspective-bound compare), D-STORE (multistore-D1 spine), D-BLEND (D3 `blend` step), D-METRIC-VIEW (semantic-layer R1 metric-level perspective). Each: trigger + attach-point + the one additive change + the FF that keeps it from regressing. **None is built. Each is a fitness-locked open door.**

6. **POWER VIA COMPOSABILITY (§5).** The competitor-beating claim made concrete: the platform's view-power is *the product, not the sum* of the doors, because every door composes on ONE contract (a perspective is a `Record`-keyed axis of named states, each carrying a generic `scope` blob, gated by a generic visibility guard, rendered by `f(state)`). No competitor's view model is closed under composition this way — Power BI bookmarks don't compose with parameters; Tableau parameters don't compose with each other declaratively; Grafana variables don't carry typed effects. Ours do, because they are the same primitive. **More power from a smaller core** — the user's actual ask, satisfied structurally.

7. **The honest critical note (§6):** the user asked for "more power *now*." The canonical answer is **no — power comes from the seams, not from building the doors now.** Building facet/compare/multi-axis today would (a) violate YAGNI (no second caller), (b) add closed interfaces that the door-research above shows we'd mis-locate without a real use-case, and (c) degrade the very N=1-free simplicity that is the design's signature win. The synthesis *increases* future power by **cutting** three things (snapshot-from-config, plural-as-separate-field, scope-as-closed-interface) and **shaping** seven doors — not by adding features. This is the discipline the design demands.

**Verdict (full): this is the plan; build it.** Apply the three cuts (§1) and the two seam-relocations (`snapshot`→render-option, `facet`→axis-flag) as P0 contract refinements, lock the seven doors as fitness-guarded openings, and start P0 (types + contracts JSON-Schema + registry alias + ADR) ∥ P-opt (perspective-aware SSR walkers). No further paper. §8 is the build-order.

---

## 1. Maximum SIMPLICITY — what to CUT (adversarial pass)

The corpus is already lean. I hunted for any second way to express one thing, any field that serializes intent rather than data, any closed interface that a door would have to widen. Four findings — three cuts, one re-shape.

### 1.1 CUT `snapshot` from the contract → make it a render-call option (the clearest cut)

**The smell:** `perspectiveAxis.snapshot: 'active' | 'all-perspectives'` (introduced in `.v3.md` Q7, served in `.v3-FULLSTACK.md` §3.3) is an authored config field that describes **how a caller renders**, not **what the page is**. The same page is rendered `active` by the interactive client and `all-perspectives` by the PDF exporter — *simultaneously, from the same config*. A property that differs by caller for one artifact is, by definition, not a property of the artifact.

**Root cause → standard → fix.** Root cause: render-intent leaked into the SSOT config blob (a Law-2-adjacent violation — config should carry data/intent-of-the-artifact, not intent-of-the-render-pass). Standard: SSOT + separation of concerns — the render policy belongs to the render boundary. Fix: **delete `snapshot` from `PerspectiveAxis`; pass `snapshot` as an argument to the SSR walker / export call** (`renderPageToJSON(config, ctx, { snapshot })`), defaulting `'active'`. P-opt already threads it through `StaticRenderContext` — that is the correct home; the full-stack doc's move to serve it in config is the regression to undo.

**What this removes (the simplification dividend):** one field from the contract type, one property from `perspective-axis.schema.json`, one served field from the bootstrap manifest, one line from the round-trip corpus, and the `snapshot` row from the SSOT table in `.v3-FULLSTACK.md` §1. The permalink derivation no longer has to reason over a snapshot field. **Net: a strictly smaller contract with identical capability.** (The `'all-perspectives'` cross-product caveat in the benchmark doc §3 becomes purely an exporter concern, which is where it belonged.)

### 1.2 CUT the temptation to author `when: perspective-is(self)` — name it an escape-only field

`PerspectiveDef.when?` defaults to `perspective-is(id)`. The corpus is correct to keep the field (a node can belong to a perspective by a non-identity rule). But there is a latent duplication: nothing today *forbids* an author (or a naive Constructor pane) from writing the identity gate explicitly, restating the id. **Add FF-WHEN-IS-ESCAPE-ONLY: a `PerspectiveDef.when` that is exactly `perspective-is(<own-id>)` is a lint failure** (it is the default, written twice = the SSOT smell). The geostat migration authors zero `when` overrides (every gate is identity) — so the common path is *no field at all*. This keeps the field as a true OCP escape hatch and prevents the pane from re-introducing the duplication the reframe exists to kill. Cost: one fitness assertion. Benefit: the field can never become a second way to say the default.

### 1.3 CUT `perspectiveAxes` (plural) as a separate future field — one container shape for definition + state

The corpus defers multi-axis as "a future `page.perspectiveAxes` plural." That is a *second* container concept (singular `perspectiveAxis` today, plural `perspectiveAxes` tomorrow) for the same thing — a rename waiting to happen, and a mismatch with the active-id container which is *already* a `Record<param,id>`.

**The cut:** decide the container shape **once, at P0**, so the plural never needs a rename. Two clean options; I recommend (B):
- **(A) Array:** `page.perspectives: PerspectiveAxis[]` (length-1 today). Simple, but lookup-by-param is a `.find`.
- **(B) Record, mirroring state (RECOMMENDED):** `page.perspectives: Record<param, PerspectiveAxis>` where the key *is* the URL param. This mirrors `ctx.perspectiveState: Record<param, activeId>` exactly — **definition and state share one container shape, keyed by the same thing.** Multi-axis is then literally "a second key," with zero new field and zero rename. The Principle of Least Astonishment is served: the thing that holds the definitions and the thing that holds the active values are the same shape.

Lock (B) at P0. Today the Record has one entry (`{ perspective: {...} }`); the migration and the pane treat it as a Record-of-one. This is the single most future-proofing simplification: **the multi-axis door (D-MULTIAXIS) becomes a no-op on the container** — you add a key. (Trade-off named: a Record loses authored *order* across axes; but axes are orthogonal regions — they have no inter-axis order by definition. Within an axis, `perspectives[]` is still an ordered array. Correct.)

> Note: keeping the *name* `PerspectiveAxis` for the per-axis object and `page.perspectives` for the keyed container reads naturally ("the page's perspectives, keyed by axis param"). The benchmark doc's `perspectiveState: Record` foresight already proves the container generic; this makes the *definition* side match it.

### 1.4 RE-SHAPE `scope` from a closed interface to a registered-key Record (the agnosticism-critical re-shape)

The corpus types `scope: { timeBinding: TimeBindingSpec; metric?: string }` and lists `store`/`dims`/`blend`/`facet` as "future optional fields on `scope`." That means **every door widens the `scope` interface** — a modification, not an extension (OCP tension). Worse, the coverage gate (`PERSPECTIVE_SCOPE_KEYS`, full-stack §2.3) already wants `scope` to be an *enumerable registry of keys*, not a fixed struct.

**Re-shape (root-cause OCP fix):** `scope` is a **`Record` of registered scope-keys**, each key carrying a PropSchema in an engine **scope-key registry** (the same registry pattern as nodeRegistry/param-schema-registry). `timeBinding` and `metric` are the two *registered* keys today; `store`/`dims`/`blend`/`facet` register later (a new key = a `register()` call, the interpreter unchanged = true OCP, Law 8). The Constructor pane is then *driven* by the registry (a key appears in the pane the moment it registers — exactly the full-stack §2.2 "schema-introspectable pane" claim, now structurally true rather than asserted). **FF-SCOPE-KEYS-REGISTERED:** every `scope` key resolves to a registered scope-key schema; an unregistered key is a validation failure (and the coverage gate's 5th axis is satisfied *by construction*, not by a hand-maintained allowlist).

This is the one place the corpus left a closed interface that doors would force open. Closing it now (as a registry) costs one small registry module at P1 and makes all four deferred `scope.*` doors **pure registrations**. It also retires the full-stack doc's hand-maintained `COVERAGE_TODO.perspectiveScope` allowlist in favour of a registry the gate reads directly.

> **YAGNI check on this re-shape:** is a scope-key registry premature? No — it is the *minimum* structure that makes `timeBinding` + `metric` (the two real keys *today*) extensible without interface-widening. We are not building the future keys; we are choosing the container that doesn't need rework when they arrive. That is shape-the-seam, not build-the-feature. Confirmed in-bounds.

**Net of §1:** the contract shrinks (no `snapshot`), the container unifies (Record for both definition and state), the escape hatch is fenced (FF-WHEN-IS-ESCAPE-ONLY), and the one closed interface becomes a registry (so every door is a registration). The design is *smaller* and *more open* after this pass.

---

## 2. Maximum AGNOSTICISM — re-verification across the arrow

Walked `contracts → core → react → panel → api` for any privileged concept. Result: **clean, with the §1.4 re-shape applied.** The table is the audit.

| Layer | Could privilege | Verified | Note |
|---|---|---|---|
| `packages/contracts` | a literal `time`/`year`/`mode` in the JSON-Schema | **clean** | the schema validates `{ param, perspectives:[{id,label,scope,when?}] }` structurally; `scope` is `JsonRecord` at the wire (full-stack §1 layering); no dimension literal. `ManifestPerspectiveKind` (renamed `modes`) carries id→label/icon, no privilege. |
| `packages/core` | `timeBinding.dim` defaulting to `'time'`; a `metric` key that assumes a measure | **clean** | `dim` is generic, written into `ctx.dims[dim]` (the existing TIME_DIM SSOT is a *named constant*, not a branch — `context.ts:64`). `metric` is a generic MetricDef *ref* (R1), not a measure-specific field. With §1.4, `scope` keys are registry-resolved — zero hardcoded key names in the interpreter. |
| `packages/react` | the active-id read branching on `'time'`/`'mode'` | **clean** | `evalVisibility` reads `ctx.perspectiveState[param]` — `param` is data. The 6 mode-reading sites (renderNode:229, both SSR walkers, navUtils:52, SiteRenderer, ModeContext) all migrate to the generic slot per the plan. No literal survives P6. |
| `apps/panel` | the pane hardcoding `year`/`range`/`timeBinding`/`metric` controls | **clean (with §1.4)** | the pane is driven by `perspectiveSchemaSource` over the **scope-key registry** — it renders whatever keys are registered. Today that *is* timeBinding+metric; it is not hardcoded to them. |
| `apps/api` | `site_config.modes` / `DEFAULT_MODES` assuming time-modes | **clean** | repurposed to `perspective_kinds` (the registry half); the validation gate (FF-PERSPECTIVE-REFS-EXIST) is "every `timeBinding.dim` is a real dim of *this page's cube*" — generic over datasets, hardcoded to nothing (full-stack §3.2). |

**The one honest residual (a default, not a privilege):** the conventional param name `'perspective'` and the conventional time dim key `'time'` are *named constants*, not branches — the engine never does `if (param === 'perspective')` or `if (dim === 'time')`. A page may name its axis param `view` or `scenario` and its time dim `period`; nothing breaks. This is exactly the `TIME_DIM`-as-SSOT-constant pattern already blessed in `context.ts`. **Law 1 holds.** Confirmed, no flag.

**One agnosticism *upgrade* from §1.4:** moving `scope` to a registry removes the last closed interface where a future door would have hardcoded a key name. After it, there is *no* place in the shipped core that names a scope concept in a type — the strongest form of Law-1 compliance the corpus can reach.

---

## 3. RESEARCH sweep — best-concepts beyond what v1–v3 cited

The corpus cited Vega-Lite params, Elm `view=f(state)`, OLAP perspectives, Power BI/Tableau/Superset/Grafana/Looker/Retool/Framer, Harel statecharts (orthogonal regions), Strangler-Fig, Grafana `variableAdapters`. I swept the systems the brief named (XState, CRDT/URL-as-state, Malloy/Cube semantic graph, Airbnb/Shopify/Adaptive-Cards SDUI-at-scale, Observable/Incremental dataflow, Grammar-of-Graphics faceting) for anything *more powerful or simpler* not yet stolen. Two steal-able, both as **deferred seams shaped now, not features built now**. The rest: correctly already-stolen or rejected-as-not-fitting.

### 3.1 STEAL (shape-in now): statechart **availability guards** + **history** (XState / Harel, the parts not yet taken)

The corpus took Harel *orthogonal regions* (the `Record` container). It did **not** take two further Harel/XState concepts that fit precisely:

- **Guarded transitions → `PerspectiveDef.available?: VisibilityExpr` (door D-GUARD).** `when` guards *node visibility within a perspective*. The twin is guarding *the perspective's own availability*: "offer the `range` perspective only when the cube has ≥2 time periods" (otherwise the switcher offers a perspective that renders empty — a real UX hole the live geostat pages paper over implicitly). XState models this as a transition guard. We model it as one optional field reusing the *same* `VisibilityExpr` evaluator (no new machinery), read where the switcher/nav builds the offered list. **Shape now (the field name + the read-site), build never until a page needs a conditional perspective.** This is the strongest single addition the sweep found: it closes the "empty perspective offered" gap with zero new concepts.
- **History (deep-link return) → already free, name it.** "Return me to the perspective I last had" is, in this design, *automatically* satisfied because the active id lives in the URL (permalink-from-registry). The Harel "history state" is a stored last-value; ours is the URL. **No new field — the synthesis just names that the URL IS the history state**, so a future "back to my view" feature needs nothing. (This is a foresight note, not a door.)

**Rejected from XState:** actor model / spawned machines / invoked services — that is *imperative orchestration*, the opposite of `view=f(state)` declarative purity. Adopting it would re-introduce the effects-cascade the design deletes. **Refuse** (it would violate FF-PERSPECTIVE-IS-PURE-FUNCTION).

### 3.2 STEAL (relocate the seam): faceting as a **Grammar-of-Graphics axis operator**, not a scope sub-key (Wilkinson / Wickham / Vega-Lite)

The corpus files trellis/small-multiples under `scope.facet` (a per-perspective key). The Grammar of Graphics says that is the wrong locus: **faceting is an operation on the *axis*, not on one *value* of it** — "render `f(state)` across all values of this axis simultaneously" (Vega-Lite `facet` is a top-level operator that *multiplies* the view, Wickham's `facet_wrap` operates on a variable). So the correct seam is **`PerspectiveAxis.render: 'switch' | 'facet'`** (door D-FACET): `'switch'` (default) renders the active perspective; `'facet'` renders *all* perspectives as small multiples. This makes trellis a one-flag change on the axis, and it composes with everything (a faceted axis still carries per-perspective `scope`). **Relocating the seam costs nothing now and saves a mis-located rework** — the single concrete "best-concept" correction the sweep yields.

### 3.3 CONSIDERED and correctly NOT adopted (the rejections, with reasons)

- **CRDT for view state (Yjs/Automerge):** for *collaborative* multi-cursor editing of perspectives. **Reject for the runtime axis** — view state is single-user, URL-derived; a CRDT is the wrong tool (eventual-consistency machinery for a synchronous f(state)). *May* matter someday for *collaborative authoring in the Constructor* — but that is a panel concern, not the perspective contract, and is out of scope. Correctly not stolen.
- **Malloy / Cube semantic graph (compose queries from a typed graph):** this is *already* the platform's R1 semantic layer (MetricRegistry), and `scope.metric` is exactly the steal (a perspective binds a named metric). The corpus took it. Nothing more to take *for the axis* — the deeper "perspective as a named query over the semantic graph" is door D-METRIC-VIEW (§4), already correctly deferred.
- **SDUI-at-scale (Airbnb GP/Lona, Shopify, Adaptive Cards):** server-driven UI where the server ships a view tree. The platform *is* this (config→renderer). The relevant steal — *the server ships the view contract, the client doesn't invent it* — the full-stack doc already took (permalink/axis served verbatim). Nothing additional fits the axis specifically.
- **Observable/Incremental (reactive dataflow, fine-grained recompute):** an *optimization* of how f(state) recomputes (memoize per-cell). Real, but it is a **rendering-performance** concern orthogonal to the axis contract — it would attach to the resolver layer, not `PerspectiveDef`. Out of scope for this design; noted as a general future perf lever, not a perspective door.

**Sweep verdict:** the corpus had already stolen the load-bearing concepts. The sweep adds exactly **one new door (D-GUARD, availability guards)**, **one seam relocation (D-FACET onto the axis)**, and **one foresight naming (URL = history state)**. Everything else is correctly already-taken or correctly-rejected. The design does not need more research; it needed these two precise corrections, now folded in.

---

## 4. THE FUTURE ROADMAP — doors defined today (seams, not features)

Every door below is proven a **pure additive change** on the P0/P1 seams (the `Record`-keyed axis container §1.3, the registry-keyed `scope` §1.4, the generic `perspectiveState` slot, the reused `VisibilityExpr` evaluator). None is built now. Each row: the seam it attaches to, the trigger that opens it, the *one* additive change, and the fitness function that keeps the door from regressing into the core before its time.

| Door | Carries | Trigger (real 2nd caller) | Attach-point (the seam, already shipped) | The ONE additive change | Non-breaking proof | FF guard |
|---|---|---|---|---|---|---|
| **D-GUARD** *(new, §3.1)* | availability guard | a page wants a perspective offered conditionally (e.g. range needs ≥2 periods) | the `VisibilityExpr` evaluator + the switcher/nav offered-list build | add optional `PerspectiveDef.available?: VisibilityExpr`; nav reads it when building the offered list | optional field; absent ⇒ always-available (today's behaviour); reuses existing evaluator, no new machinery | FF-GUARD-IS-DECLARATIVE (pure JSON, no fn) |
| **D-FACET** *(relocated, §3.2)* | trellis / small-multiples | a small-multiples requirement | `PerspectiveAxis` object (the axis, not the scope) | add `PerspectiveAxis.render?: 'switch'\|'facet'`; render loops scope step over all perspectives when `'facet'` | optional; absent ⇒ `'switch'` (today); the scope step already exists, faceting just iterates it | FF-FACET-COMPOSES (a faceted axis still honours per-perspective scope + when) |
| **D-MULTIAXIS** | a 2nd orthogonal axis (e.g. `compare` ⟂ `time`) | a real 2nd simultaneous axis | the **Record container** (§1.3): `page.perspectives: Record<param,PerspectiveAxis>` + `ctx.perspectiveState: Record<param,id>` | add a second key to the Record; its `when` ops read its own param | the container is a Record *today* (length-1); a 2nd key needs **zero** schema/field change — the foresight caveat: `'all-perspectives'` export becomes a cross-product (size it then, benchmark §3) | FF-AXES-ORTHOGONAL (switching one param mutates no other param's state) |
| **D-COMPARE** | a compare/benchmark perspective | a "vs prior year / vs benchmark" view | the **live `ScopeOverride.compare`** anchor (`scopeOverride.ts:37`, already half-built) + a registered `scope` key | register a `compare` scope-key whose value desugars to the existing `ScopeOverride.compare` per-node merge | the compare *mechanism* already ships (shells read `ctx.compareRows`); the door only *binds it to a perspective* via a scope-key registration (§1.4) | FF-COMPARE-DESUGARS (perspective compare ≡ the existing per-panel compare) |
| **D-STORE** | a perspective reading another cube | a perspective binds a different store | the **multistore-D1 spine** (`buildStoreManifest` routes by key, shipped) + a registered `scope.store` key | register a `store` scope-key; the scope step routes `ctx` store by it (the router exists) | the routing spine is live; the door is a scope-key registration that feeds it a key | FF-STORE-KEY-RESOLVES (the store key exists in the manifest) |
| **D-BLEND** | a compare-across-stores perspective | benchmark across two cubes | the **D3 `blend` step** (the data-blending ADR's `resolveBlends`/`joinByField`, shipped as a transform) + a registered `scope.blend` key | register a `blend` scope-key whose value is the existing `blend` transform shape | `blend` already resolves in React (D3); the perspective only *references* it via a scope-key | FF-BLEND-VIA-SCOPE (perspective blend ≡ the standalone `blend` transform) |
| **D-METRIC-VIEW** | a perspective defined at the semantic-layer (a named cube query) | a perspective is a *named metric query*, not a node-set | the **R1 MetricRegistry** + `scope.metric` (already the canonical measurement home) | extend `scope.metric` from "a measure swap" to "a named perspective-query" registered in the MetricRegistry | `scope.metric` already refs a MetricDef; this enriches what a MetricDef *can be* (a query), not the perspective contract | FF-METRIC-VIEW-RESOLVES (the metric-query resolves against the registry) |

**The proof obligation, discharged.** Every door is one of exactly three additive shapes: **(a) an optional field on `PerspectiveAxis` or `PerspectiveDef`** (D-GUARD, D-FACET), **(b) a new key in the Record container** (D-MULTIAXIS), or **(c) a registration into the `scope`-key registry** (D-COMPARE, D-STORE, D-BLEND, D-METRIC-VIEW). The first is OCP-additive by construction (optional field, absent ⇒ today's behaviour). The second is free because the container is *already a Record*. The third is the registry pattern (new key = `register()`, interpreter unchanged). **No door requires touching the interpreter, the visibility evaluator, the active-id slot, or any existing config.** That is what "future visions defined today" means here: the seams are shaped so the doors are registrations and optional fields, fitness-locked shut until a real second caller opens them.

> **YAGNI line held (explicit):** every cell in "The ONE additive change" column is a *future* change, gated on a *real* trigger. This table is the *map of where they attach*, not an instruction to build them. The only things built at P0/P1 are the seams (the Record container, the scope-key registry, the reused evaluator) — which we need *anyway* for `timeBinding` + `metric`. The doors ride seams we build for the one real feature. This is the precise discipline: build the seam the first caller needs; the second caller finds it ready.

---

## 5. POWER via COMPOSABILITY — the competitor-beating claim, made concrete

The benchmark doc proved the *union-of-strengths* table. The synthesis adds the deeper claim the brief asked for: **the platform's view-power is the *product* of the doors, not the sum, because every door composes on one contract — and no competitor's view model is closed under composition.**

**Why composition multiplies here.** A perspective is, after §1's cuts, *one primitive*: a named state in a `Record`-keyed axis, carrying a generic registry-keyed `scope` blob, optionally guarded, rendered by `f(state)`. Because every door is either an optional field, a Record key, or a scope-key registration (§4), **the doors compose pairwise without special-casing**:
- D-MULTIAXIS × D-FACET = a faceted axis ⟂ a switched axis (small multiples of one dimension, switchable on another) — *free*, because facet is an axis flag and the second axis is a Record key; neither knows about the other.
- D-COMPARE × D-STORE = "compare this cube's value against another cube's" — *free*, because both are scope-key registrations on the same `scope` blob; the scope step applies both.
- D-GUARD × any = availability guarding on any perspective regardless of what its scope carries — *free*, because the guard reads `VisibilityExpr`, orthogonal to scope.
- D-METRIC-VIEW × D-FACET = small multiples of a semantic-layer query — *free*.

**Why competitors can't do this.** Their view mechanisms are *different primitives that don't compose*:
- **Power BI:** bookmarks (captured snapshots) and parameters (named values) are *separate systems* — a bookmark can't be "guarded by" a parameter declaratively; you wire it in interactions. Capture-vs-derive breaks composition.
- **Tableau:** N parameters compose, but each effect is scattered across calc-fields + actions; there is no single object that *is* a view, so "facet by parameter A while switching parameter B" is bespoke per dashboard.
- **Grafana:** variables compose (repeat-by-variable = facet), but the variable is an untyped value — it carries no declarative *effect*, so "this view also reads a different datasource" is panel-by-panel, not a property of the view.
- **Looker:** the most composable (LookML), but it is *code* — non-coder-authorable composition is off the table.

**The concrete claim:** statdash's perspective axis is the only model where **(named-state) × (declarative typed scope) × (orthogonal multi-axis) × (availability guard) × (faceting) × (server-validated) × (generated permalink) all compose on ONE primitive**, because they were *designed* as optional fields / Record keys / scope-key registrations on a single contract — not bolted on as separate systems. The power is structural: **N doors give 2^N composable view behaviours, from one primitive, with no pairwise integration code.** That is more power than any single competitor, delivered by a *smaller* core — which is exactly the "more power AND more simplicity" the user asked for, and the only honest way to deliver both at once.

---

## 6. Critical-thinking duty — guardian-of-canon

**The user asked for "more power / more functionality now." I must say plainly: building features now would degrade the design.** Here is the canon, applied:

- **More power ≠ more features.** The design's signature win is **FF-ONE-VIEW-NO-MACHINERY** (N=1 is genuinely free — no competitor achieves it). Every feature built speculatively (facet, compare, multi-axis) adds machinery that a one-perspective page would drag — *destroying the very property that makes this best-in-class.* The canonical move is the opposite of "build more": **cut three things (§1) and shape seven doors (§4).** Power rises; machinery doesn't.
- **The doors must NOT be pre-built, even partially.** A half-built door (cf. the `ScopeOverride.compare` block that already sits half-built in the tree — the exact anti-pattern) is worse than no door: it is unused surface area that the coverage gate must cover and the reader must understand, with no caller. The discipline is **fitness-locked-shut**: the door is *named, its seam shaped, its FF written to keep it out of the core* until a real trigger. D-COMPARE's note that "the mechanism already ships" is a *liability to contain*, not a feature to celebrate — the synthesis flags it should be either *used* (bound to a perspective via the scope-key) or its half-state acknowledged as debt, not left as ambiguous middle.
- **One reframe stress-test, as the brief demands.** Is there a *better* reframe than `perspective` the corpus missed? I tested two: **"scenario"** (planning/what-if connotation — rejected: implies hypothetical data, ours is the same data viewed differently) and **"lens"** (clean, but no industry lineage and collides with the optics/focus metaphor used elsewhere in viz). `perspective` is OLAP-correct, collision-free with `node.view`, and names exactly "a user-facing view over a cube subset." **The reframe holds. No better name exists.** The thesis is correct; I affirm it with conviction.
- **Do not gold-plate.** The design is *done*. The three cuts make it smaller; the doors are paper-only seams. There is no more analysis to do. The risk now is *further papering* — writing a v4. **Resist it.** The next artifact should be code (P0), not prose.

**Where I would push back on the corpus itself (the honest flags):**
1. **`snapshot`-in-config (resolved §1.1):** the full-stack doc froze a render-intent into the SSOT. Cut it. *(Substantive — affects the contract.)*
2. **`scope`-as-closed-interface (resolved §1.4):** the corpus leaves the one interface that doors would widen. Make it a registry. *(Substantive — affects OCP.)*
3. **`facet`-under-scope (resolved §3.2):** mis-located seam; belongs on the axis. *(Substantive — affects the future seam.)*
4. **plural-as-rename (resolved §1.3):** decide the container shape once. *(Cheap — a P0 naming lock.)*

All four are folded into the cuts above. None changes the verdict; all make it cleaner.

---

## 7. The thesis, stress-tested one final time — it holds

> `mode` is not a privileged data dimension and not a captured snapshot; it is a **named query-perspective over the cube**, modelled as one generic declarative axis (`Record`-keyed), active id in a generic `ctx.perspectiveState: Record<param,id>` (Harel orthogonal regions), rendered by `f(state)`, with every per-perspective effect carried in a registry-keyed `scope` blob.

I attacked it from every angle the corpus and the brief offer:
- **Is `mode` *really* not a dimension?** Yes — it never enters a query; `resolveTime`/`withFilter` read `dims`, scoped *by* the active perspective. The empty `(d)` privileged-data-branch residue (`.v3.md` §0.4) confirms elimination is total, not relocation. **Holds.**
- **Is it *really* not a snapshot?** Yes — derived from URL state every render; nothing captured (the Power-BI-bookmark rejection, `.v3.md` §1). **Holds.**
- **Does N=1 *really* cost nothing?** Yes — no axis ⇒ empty `perspectiveState` ⇒ identity scoping ⇒ byte-identical (FF-ONE-VIEW-NO-MACHINERY). Unique among all competitors (benchmark §1). **Holds.**
- **Does it *really* stay agnostic through api + panel?** Yes — one contract in `contracts`, generic over dims/datasets, registry-keyed scope (§2). **Holds, strengthened by §1.4.**
- **Does it *really* compose without rework?** Yes — every door is an optional field / Record key / scope-key registration (§4); they compose pairwise (§5). **Holds, sharpened by §3.2's seam relocation.**

**The thesis is correct, complete, and — after this synthesis's cuts — minimal. It is the IDEAL end-state, not a compromise.** I affirm it without reservation.

---

## 8. VERDICT + build order

**EXCEPTIONAL and READY. This is the plan; build it.** Apply the four refinements from §1/§3 as P0 contract decisions (they shrink the contract, they don't expand the plan), then execute the corpus's Strangler phases unchanged.

**The four synthesis refinements to lock at P0 (each a *cut* or a *seam-shape*, none a feature):**
1. **`snapshot` → a `renderPage(..., { snapshot })` option, not a config field** (§1.1). Smaller contract.
2. **`page.perspectives: Record<param, PerspectiveAxis>`** — one container shape for definition + state; multi-axis = a future key, no rename (§1.3).
3. **`scope` is a `Record` of registry-keyed scope-keys** (`timeBinding`+`metric` registered today); doors = registrations (§1.4). The coverage gate reads the registry.
4. **`facet` belongs on `PerspectiveAxis.render`, not `scope`** (§3.2); and add the door names `available?` (D-GUARD, §3.1) to the deferred-door registry. Both paper-only.

**Then start, in parallel (both pure additive two-way doors):**
- **P0** — `perspective-axis.ts` types (with the §1 shape) + `packages/contracts` JSON-Schema + TS mirror + `modeRegistry`→`perspectiveRegistry` alias + `ManifestPerspectiveKind` alias + the **scope-key registry skeleton** (registering `timeBinding`+`metric`) + the ADR (record the four refinements + the seven doors + ≥2 rejected alternatives: elevate-privileged-`timeMode` and `view`-naming, both already documented). Fitness stubs: FF-VIEW-SCOPE-DECLARATIVE, FF-VIEW-ROUNDTRIP, FF-SCOPE-KEYS-REGISTERED, FF-WHEN-IS-ESCAPE-ONLY.
- **P-opt** — perspective-aware SSR walkers + the `snapshot` *render option* (now correctly the walkers' concern, not config). FF-SSR-WALKER-VIEW-AWARE.

Then P1→P2→P3→P4→P5→P6→P-final exactly as `.v3-PLAN.md` §2 and `.v3-FULLSTACK.md` §5 specify, with the §1.4 registry replacing the hand-maintained coverage allowlist and the §1.1 cut removing `snapshot` from the schema/manifest/round-trip surfaces.

**The one residual the user must confirm (unchanged, narrowed to a data check, NOT architecture):** are the 3 geostat pages' range measurements (CAGR/share) already registered `MetricDef`s in the shipped R1 registry? If yes, P5 maps each range perspective to `scope.metric` directly. If a few are not, P5 registers them first (preferred) or keeps those specific nodes node-local via `value.type` (LOW-2 permits it; the FF forbids only *dual* encoding). A provisioning inventory step, not a design decision.

**No further paper.** The corpus is complete; this synthesis cut it smaller and shaped its future doors. The next artifact is P0 code.

*Vision #3 SYNTHESIS — the capstone-of-capstones. Build it.*
