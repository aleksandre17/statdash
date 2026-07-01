---
name: adr-data-source-reference-spectrum
description: Decision-grade VISION ADR on the DATA-SOURCE-REFERENCE SPECTRUM — the orthogonal axis to multistore routing — how a node says WHERE its data lives = STATIC(inline) / HREF(url) / STOREID(named cube). Recovers the original three-mode model (datasource.ts kinds external|api|stats; source.ts StaticSource|ApiSource|InlineSource; 25-datasource-system.md sdmx-api/rest-json/static plugins + ApiResponse envelope), maps current delta (storeId LIVE, static SURVIVES at spec-level via transform.source/staticStore/InlineSource, href ORPHANED — ApiSource type exists but resolver returns null, no url DataStore kind registered). Per-platform steal table (Vega-Lite data:{values|url|name} trichotomy is the canonical model; Grafana/Observable/Tableau/PowerBI/Superset/Retool). Unification verdict: ONE DataStore port + N source KINDS behind buildStoreManifest kind-dispatch = the canonical hybrid; the node-level discriminant is storeKey→kind, NOT a parallel DataSpec.data union. Recommendation: register StaticStore now (real consumer = round-trip/demo/test), DEFER HrefStore behind named door D-HREF (no consumer), keep transform.source inline as authoring sugar. FF-STATIC-KIND/SOURCE-KIND-CLOSED/NO-FETCH-IN-CONFIG. Builds on adr_multistore_storeid_reintroduction + adr_data_reference_render_vision.
metadata:
  type: project
---

# Vision ADR — The Data-Source-Reference Spectrum (STATIC · HREF · STOREID)

**Status:** PROPOSED (2026-06-25). Author: architect (Opus). Design/research only — no product code, no git.
**Builds ON (does NOT duplicate):**
- [[multistore-storeid-reintroduction]] — owns the *routing* half (which named store a node reads; CSS-cascade `storeKey`; `buildStoreManifest`+`resolveStore`; three real cubes). That ADR's verdict: routing spine is LIVE.
- [[adr-data-reference-render-vision]] — owns the *binding* half (the 12 ref mechanisms, the semantic-layer spine R1, the `$`-ref taxonomy). Ref-type **#5** in that inventory is `storeKey`/`DataStore` binding — THIS ADR is the deep-dive on the *kinds* a store can be.

**The axis this ADR owns (and neither prior one made first-class):** **the SOURCE KIND** — not *which* named store, but *what kind of thing* that store is. A node references data that is one of three fundamentally different origins:

| Mode | Vega-Lite name | "My data is…" | Backend needed | Portability |
|---|---|---|---|---|
| **STATIC** | `data: { values: [...] }` | …THIS literal array, embedded in the config | none | total (offline) |
| **HREF** | `data: { url: "..." }` | …at THIS remote URL, fetched + parsed | none (just a URL) | high (self-contained pointer) |
| **STOREID** | `data: { name: "gdp" }` | …in THIS registered, governed cube | a provisioned store | governed/live |

**Thesis.** This is the canonical **Vega-Lite `data: { values | url | name }` trichotomy** — the single most-copied data-reference design in declarative-viz. We once had all three (the `datasource.ts` kinds `external | api | stats`; the `source.ts` `StaticSource | ApiSource | InlineSource`; the `25-datasource-system.md` `static`/`sdmx-api`/`rest-json` plugins). De-tenanting collapsed us to **one registered kind: `stats`**. STATIC *survives in fragments* (the `staticStore` Null Object + `transform.source` inline rows + `InlineSource` in selectors), but as scattered special-cases, not as a *kind of store*. HREF is **a ghost**: the `ApiSource` type still compiles, but its resolver returns `null` and the async path it points to (`FilterSchema.tsx`) no longer exists. The recommendation is NOT "restore the old envelope" — it is to **recognize that `static`/`href`/`storeId` are three KINDS behind the ONE `DataStore` port the kind-dispatch registry already supports**, register `static` as a first-class kind now (it has a real consumer), and gate `href` behind a named door (it does not).

---

## 0. TL;DR verdict

1. **The three modes are not three architectures — they are three KINDS behind ONE port.** `DataStore` + `registerStoreBuilder(kind, fn)` + `buildStoreManifest` *already* dispatch by kind. `static`/`href`/`storeId` are `StaticStore` / `HrefStore` / `ApiStore` — same interface, different builder. **This is the canonical hybrid and it needs almost no new architecture.** The node-level discriminant stays `storeKey` (→ a kind via the manifest); we do NOT add a parallel `DataSpec.data: { values | url | name }` union (that would be a *second* "which data" mechanism — exactly the fragmentation [[adr-data-reference-render-vision]] F-A/F-B warns against).
2. **STATIC: re-adopt now as a first-class kind.** Real consumers exist *today*: the lossless round-trip (a config that embeds its own data renders with zero backend — the demo/test/snapshot path), `transform.source` inline rows, and the `staticStore` fallback. Promote the scattered fragments to one registered `StaticStore` builder so "inline data" is a *store kind*, not three special-cases. Low cost, immediate payoff, kills a coherence smell.
3. **HREF: DEFER behind named door `D-HREF`.** No live consumer. The `ApiSource` ghost should be *finished or deleted*, not left half-wired (a `null`-returning resolver pointing at a deleted file is a Lava-Flow smell). Recommendation: **delete the orphaned `api`-in-selector path** (Strangler-Fig: remove dead code), and re-introduce HREF *as a store kind* (`HrefStore`, Vega-Lite `url` + `format`) only when the first real external/CSV/remote-JSON consumer appears. Name the trigger.
4. **STOREID: keep — it is the load-bearing default** ([[multistore-storeid-reintroduction]] already covers it). This ADR adds: storeId is *one kind among three*, and the kind-dispatch must stay open (OCP) so static/href slot in beside it without touching `resolveStore`.

**One line:** *Three source kinds, one `DataStore` port, the `storeKey`→kind manifest as the discriminant; register `static` now, gate `href` behind D-HREF, keep `stats` as the default — restoring the full Vega-Lite spectrum with near-zero new architecture.*

---

## 1. The recovered three-mode model (what we HAD)

The trichotomy lived at **three independent layers**, which is why "we used to have it" is true even though no single file holds all three today.

### 1a. The DataStore-KIND layer — `datasource.ts` (LIVE type, partial impl)
`packages/core/src/data/datasource.ts` still documents the three built-in kinds verbatim:
```
'external' — ExternalStore built from static observations + classifiers   ← STATIC
'api'      — MSW-intercepted fetch (dev mock)                              ← HREF (mock)
'stats'    — live stats API (production)                                   ← STOREID
```
`DatasourceInstanceConfig = { id, kind, url?, params? }` — the `url?` field is the HREF carrier; `params` is the STATIC carrier (the doc's `options.observations`). **The discriminant `kind` is the source-mode selector.** This is the spine that survived.

### 1b. The selector/filter layer — `source.ts` (LIVE types, HREF orphaned)
`packages/core/src/data/source.ts` defines the trichotomy for *filter options* (the `OptionsSource`/`ChipSource`/`YearsSource` used by dropdowns):
```
StaticSource<T> = { type: 'static'; items: T[] }                          ← STATIC (literal)
InlineSource    = { type: 'inline'; items: DimRef | Record[]; pipe? }     ← STATIC (literal OR dim-ref)
QuerySource     = { type: 'query';  query: ObsQuery; pipe? }              ← STOREID (via store.observe)
ApiSource       = { type: 'api';    url: string; pipe? }                  ← HREF  ← THE GHOST
```
The header comment names the lineage exactly: *"Grafana/Retool/AppSmith pattern (B+C hybrid): Generic core — StaticSource · QuerySource · ApiSource · RemoteSource."* This is a faithful Vega-Lite `values | url | name` mirror, in the selector layer.

### 1c. The plugin/envelope layer — `25-datasource-system.md` (documented, NOT built)
The richest recovery. The doc (Grafana datasource model × SDMX-JSON × JSON:API) specifies:
- **Three plugins** = the three modes: `static` (`Promise.resolve(observations)`, no HTTP) · `sdmx-api` + `rest-json` (`fetchWithAuth(config.url)` — the HREF mode, with `auth` + `structureUrl`) · all behind `SuspenseStore` (format-agnostic).
- **The `ApiResponse<T>` envelope** (`meta + structure? + data?`) with three *response* modes (structure-only / data-only / combined) and the **Tier-1/2/3 classifier resolution** — the genuinely clever part ([[multistore-storeid-reintroduction]] §1 pillar 4).
- **`plugin.create / testConnection / getMetadata`** — the Constructor authoring hooks.

So the *original* three-mode model was: **STATIC = the `static` plugin (inline `observations` in config) · HREF = the `sdmx-api`/`rest-json` plugins (`config.url` + `auth` + `SuspenseStore` fetch) · STOREID = a named instance in the manifest, referenced by node `storeKey`.** All three were *one `DatasourcePlugin` interface, dispatched by `plugin` id* — already the unification this ADR will re-affirm.

### 1d. The DataSpec-inline layer — `data-spec.ts` (LIVE)
Independently, two `DataSpec` branches carry **literal data inline** (a fourth STATIC surface):
- `{ type: 'transform'; source: Record[]; steps; encoding }` — `source` is a literal row array, consumed *directly* by `TransformResolver.resolve → applyPipeline(spec.source, spec.steps)` (`registry/resolvers.ts:362`). **This is live, working inline-static data — no store at all.**
- `{ type: 'pivot'; rows: Record[]; ... }` — same: literal `rows`, desugared to transform+melt (`desugar.ts:96`).

**Why it got dropped (the honest archaeology).** Three converging forces, none a deliberate "kill the spectrum" decision:
- **De-tenanting (ADR-0028) collapsed the backend to ONE.** The runner became a pure SDUI shell whose data comes from `GET /api/bootstrap` → `config.data_source` rows → all `kind: 'stats'`. With a single internal Postgres backend, there was *nothing for `external` or `api`/`href` to point at* — every real source was the stats API. So only `registerStoreBuilders()` (= `stats` only, `setupRegistrations.ts:16`) ships. `external`/`api` kinds have **no registered builder** — `buildStoreManifest` would `throw` on them today.
- **The `ApiResponse` envelope was superseded by a better-for-one-backend design.** The `stats` builder fetches classifiers per-dim at build time + observations per-query (ApiStore, Cache-Aside) — *simpler and superior* to Tier-3 for the real backend, but it left the elegant 3-tier envelope (and the `sdmx-api`/`rest-json` HREF plugins that needed it) unbuilt.
- **HREF half-rotted in place.** `ApiSource` (`type:'api'`) kept compiling but `resolveRaw` returns `null` for it (`resolve.ts:27`) with a comment pointing at *"the async fetch in FilterSchema.tsx"* — **a file that no longer exists** (grep finds zero `asyncOpts`/`fetch(` there). This is the Lava-Flow: a type and a `null`-branch surviving their consumer. It is the single clearest "we had href and lost it" artifact.

---

## 2. What EXISTS now (the delta)

| Mode | Status | Where it survives / where it died |
|---|---|---|
| **STOREID** | **LIVE, the default, load-bearing** | `stats` builder (`stats-registrations.ts`); `buildStoreManifest`; node `storeKey`; `resolveStore` CSS-cascade; 3 seeded cubes. The *only* registered kind. |
| **STATIC** | **SURVIVES, fragmented across 4 surfaces** | (a) `staticStore` Null Object (`store.ts:241`) — the empty fallback; (b) `DataSpec.transform.source` / `pivot.rows` — **live inline literal rows**, consumed by `TransformResolver`; (c) `InlineSource`/`StaticSource` in the selector layer (`source.ts`, `resolve.ts` — live for filter options); (d) the documented `external`/`static` STORE kind — **type exists, builder NOT registered** (`buildStoreManifest` would throw). |
| **HREF** | **GHOST — type compiles, runtime is dead** | `ApiSource = {type:'api', url}` in `source.ts` — but `resolveRaw` returns `null` (`resolve.ts:27`), pointing at a deleted file. The `sdmx-api`/`rest-json` plugins + `SuspenseStore` + `fetchWithAuth` + `ApiResponse` envelope = **documented only, never built** (or built-then-removed in de-tenant). No `url`/`href` DataStore kind is registered. The `stats` builder *uses* a URL internally, but that is STOREID-fetching-its-own-backend, not author-supplied HREF. |

**The delta in one line:** *STOREID is the whole live story; STATIC is alive but scattered as special-cases rather than a kind; HREF is a compile-time ghost with a dead runtime branch.* The trichotomy collapsed to a unary, with static fragments orbiting it.

---

## 3. Best-in-class data-source-reference models — the idea to steal from each

| Platform | How an author says "static / url / named" | The idea genuinely worth stealing |
|---|---|---|
| **Vega-Lite** | `data: { values: [...] }` \| `{ url: "...", format: {type:'csv'} }` \| `{ name: "table" }` \| `{ sequence }` \| `{ graticule }`. ONE `data` slot, a discriminated union; `format` rides with `url`. | **THE canonical model.** One `data` discriminant covers all origins; `values`=static, `url`+`format`=href, `name`=named/registered. The lesson: *the source-mode is a discriminated union on ONE slot, with `format` as a sibling of `url`.* Our `kind` on `DatasourceInstanceConfig` IS this union — at the store level instead of the node level. We steal the *shape* (one discriminant, format-with-url) but keep it at the manifest tier (see §4). |
| **Grafana** | Datasource plugins (named instances) + **inline/CSV/TestData** datasources + the **Infinity datasource** (point at ANY REST/CSV/GraphQL URL, map columns) + `-- Grafana --` built-in. | **Inline-data and URL-data are themselves DATASOURCE TYPES**, not a separate node concept. The Infinity plugin = HREF-as-a-kind done right (url + parser + column mapping). Validates: static and href are *store kinds*, dispatched the same way as a DB connection. |
| **Observable** | `FileAttachment("x.csv").csv()` (static-ish, bundled) \| `d3.json(url)` / `fetch(url)` (href) \| data loaders (build-time gen). | **FileAttachment = a bundled static asset referenced by name**; the *name* indirection (not the bytes inline) is a 4th sub-mode of static — "static by reference" vs "static by value". Door: a `StaticStore` could resolve `params.assetId` instead of `params.values` for large embedded datasets. |
| **D3** | `d3.json(url)` / `d3.csv(url)` — pure fetch + parse, no store concept. | The lowest-level HREF: url + parser. Confirms `HrefStore = fetch(url) → format-parse → rows` is a ~30-line builder, not a subsystem. Steal the minimalism: HREF needs `url` + a `format` parser registry, nothing more. |
| **Tableau** | Live vs Extract vs File (.hyper/.csv) vs Published datasource. | **The live/extract toggle = STOREID vs STATIC as a switch on the SAME logical source.** Foresight: a node could "freeze" a storeId query into a static snapshot (extract) for portability — a future bridge between the two modes (door, not now). |
| **Power BI** | Import (cached copy = static-ish) vs DirectQuery (live = storeId) vs Composite (mix). | Reinforces the **import/live duality as a first-class choice**; Composite = a node mixing static + live. We will NOT build composite (YAGNI), but it names the ceiling. |
| **Superset / Metabase** | datasets / saved queries (named = storeId) + **CSV/Excel upload → a new dataset** (static promoted to named). | **Upload-to-dataset = static data PROMOTED into a named store.** The cleanest Constructor story: an author pastes/uploads inline data → it becomes a `StaticStore` instance in the manifest → referenced by `storeKey` like any cube. *Static and storeId unify at the manifest tier.* |
| **Adaptive Cards** | `$data` binding (inline data island) + templating. | Inline data + a binding expression — the static-with-binding pattern. Our `transform.source` + `pipe` is exactly this. Keep it. |
| **Retool** | Resources (named REST/DB connections) + **static JS/JSON** as a resource + REST resource (url). | **Resource = global named source; static JSON and a REST url are BOTH resources.** Identical to our `registerStoreBuilder` + `kind`. The strongest external validation that static/href/storeId belong behind ONE registry, dispatched by kind. |

**Survey synthesis — three convergent truths:**
1. **The source-mode is a DISCRIMINATED UNION on one slot** (Vega-Lite `data`, Grafana datasource-type, Retool resource-kind). Never three parallel mechanisms. *We have this: `DatasourceInstanceConfig.kind`.*
2. **Static and HREF are STORE KINDS, peers of the named cube** (Grafana inline/Infinity, Retool static-JS/REST, Superset upload→dataset). Not a node-level escape hatch. *This is the unification (§4).*
3. **HREF = url + a `format` parser, nothing more** (Vega-Lite `format`, D3 `d3.csv`, Grafana Infinity column-map). A small builder, not a subsystem — which is *why* deferring it is cheap (re-entry is a single builder registration).

---

## 4. The unification — ONE `DataStore` port, N source KINDS (the canonical hybrid)

**The insight to evaluate (from the prompt):** since `registerStoreBuilder(kind, fn)` already dispatches by kind, `static`/`href`/`storeId` are simply three store kinds behind one port — `StaticStore` (from inline `values`), `HrefStore` (fetch `url` + `format`), `ApiStore` (the cube). **Verdict: YES — this is the canonical hybrid, and it is the RIGHT one.** Critique and refinement:

### Why kinds-behind-one-port is correct (not a `DataSpec.data` union)
There are two candidate homes for the source-mode discriminant:
- **(A) Store-kind discriminant** (`DatasourceInstanceConfig.kind`) — the source-mode is a property of the *named store*; nodes reference it by `storeKey`; `buildStoreManifest` dispatches `kind → builder`. **← RECOMMENDED.**
- **(B) Node-level `DataSpec.data` union** (Vega-Lite-literal: each node carries `data: { values | url | name }`). The source-mode is a property of the *node*.

**Choose (A). Reject (B) as the primary mechanism.** Reasons, against the laws:
- **SSOT + no fragmentation.** [[adr-data-reference-render-vision]] already names F-A ("too many ways to say *this data*") and F-B (five `$`-ref vocabularies) as the platform's live entropy. Adding a node-level `data: {values|url|name}` union creates a SECOND "which data source" mechanism beside `storeKey` — the exact divergent-change smell. One discriminant (`kind` at the store), not two.
- **Governance + reuse (the §3 convergent truth).** Superset/Retool/Grafana all put static and href *at the resource tier* so they are named, reused, testable, and authored once. A node-level inline `url` is un-named, un-reused, un-governed — and re-fetched per node.
- **The cascade already works.** `resolveStore` (CSS-cascade: page `storeKey` → node override → first → `staticStore`) is mode-blind: it resolves a `storeKey` to a `DataStore` regardless of kind. Static/href slot in with ZERO change to the resolver — pure OCP. A `DataSpec.data` union would need a whole parallel resolution path.
- **Round-trip stays trivial.** `kind`+`params`+`url` are plain JSON on the manifest; `JSON.parse(JSON.stringify) === config` holds by construction (Law 2). Inline `values` live in `params.values` (or `transform.source`), already serializable.

**The one principled exception (keep B in the small):** `DataSpec.transform.source` / `pivot.rows` — *inline literal rows on the node* — is legitimate and should STAY, as **authoring sugar for the truly-local, computed-by-the-author case** (a 5-row annotation table, a hand-entered reference series). This is Adaptive-Cards `$data` / Vega-Lite `values` at the node. It is NOT a competing "source kind"; it is a node that needs no store at all. Keep it bounded: it carries *only* literal rows the author typed, never a `url`, never a query. (Fitness: `transform.source` must be a literal array, never a ref to a remote.)

### The unified model (target)
```
DatasourceInstanceConfig { id, kind, url?, params? }            (manifest tier — the SSOT for source-mode)
   kind = 'static'  → StaticStore(params.values, params.classifiers?)      ← STATIC  (Vega-Lite values)
   kind = 'href'    → HrefStore(url, params.format)                        ← HREF    (Vega-Lite url + format)
   kind = 'stats'   → CachedStore(ApiStore(url, ...))                      ← STOREID (the live cube)
        ↓ all return the SAME DataStore port
node.storeKey → resolveStore(ctx) → DataStore → querySync/queryAsync       (one resolution path, mode-blind)

PLUS (bounded, node-local, no store):
node.data = { type:'transform', source: <literal rows>, steps, encoding }  ← inline-static-by-value
```
**This restores the full spectrum with one new builder now (`static`), one deferred builder (`href`), and ZERO new resolution architecture.** The port, the registry, the cascade, the round-trip — all already exist.

### Critique / risks of the unification
- **`StaticStore` must be a real `DataStore`, not just `staticStore`-the-Null-Object.** Today `staticStore` returns `[]` for everything (correct as a *fallback*). A `static` *kind* must actually serve its `params.values` through `querySync({type:'obs'|'val'}, ctx)` — i.e. an in-memory `ExternalStore` fed from `params.values`. The `ExternalStore` class already exists (`store-impl.ts`); the `static` builder is `new ExternalStore(params.values, {classifiers})`. ~10 lines. The doc's `static` plugin (`§25` lines 408-428) is the exact blueprint.
- **Classifiers for static.** A `StaticStore` needs `classifiers`/`display` for `$cl`/`$d` resolution and filter dropdowns (the §25 "why classifiers must be synchronous" point). `params.classifiers` carries them inline (Tier-1, instant). Trivial for static (no fetch).
- **HREF's real cost is `format` + auth + Suspense, not the fetch.** `HrefStore` is small *if* it serves a pre-parsed JSON envelope; it grows teeth with CSV parsing, auth (the `AuthConfig` union), and Suspense timing for classifiers (Tier-2/3). That growth is exactly why HREF is deferred — its cost is real and has no consumer to justify it (§5, §6).

---

## 5. Per-mode assessment — benefit · Constructor authoring · foresight · cost/YAGNI

### STATIC (inline `values` / `transform.source`)
- **Genuine benefits:** portable/offline configs (a dashboard that renders with zero backend — demos, docs, embeds, fixtures); the **lossless round-trip** target (a config that *embeds its own data* is the cleanest round-trip proof — what you build = what serializes = what renders, no live store needed); hand-authored reference/annotation series; **test + snapshot determinism** (the engine's own tests already lean on `ExternalStore(obs)` — `spec.test.ts`, `metric-binding.fitness.test.ts`). The de-tenant runner's `emptyManifest()` fallback is itself a static-mode artifact.
- **Constructor authoring:** paste/upload a CSV or JSON → `StaticStore` instance written to `config.data_source` (the **Superset upload→dataset** model) OR hand-entered rows → `transform.source` (the **Adaptive-Cards `$data`** model). Both are pick-don't-type-able and round-trip cleanly.
- **Foresight (when is static the right tool):** demos/onboarding templates; embedded/exported dashboards (no live backend at the embed site); small slow-moving reference data (region labels, methodology notes) that doesn't deserve a cube; test fixtures; the "freeze a live query into a snapshot" extract (Tableau extract — future door).
- **Cost/risk + YAGNI:** **LOW cost, REAL consumer → BUILD NOW.** `ExternalStore` exists; the `static` builder is ~10 lines; it *unifies four scattered fragments* (Null Object + `transform.source` + `InlineSource` + the unregistered `external` kind) into one named kind. The YAGNI test PASSES — the second consumer is not speculative, it is already here (tests, round-trip, `emptyManifest`, `transform.source`).

### HREF (author-supplied `url` + `format`)
- **Genuine benefits:** reference a remote CSV/JSON/external API with **no store to provision** (point at an open-data URL, Eurostat/World-Bank SDMX endpoint, a teammate's gist); the most *portable shareable* form (a config + a URL, no DB seeding). Grafana's Infinity datasource exists precisely because this is genuinely wanted in dashboards.
- **Constructor authoring:** "Add remote source" → url + format picker + `[Test connection]` (the §25 `testConnection` hook) + column-map (Grafana Infinity). This is the richest authoring surface of the three.
- **Foresight (when is href the right tool):** mixing an external open-data series into an internal dashboard without an ETL/provisioning step; rapid prototyping against a live public API; a tenant whose data lives at a URL we don't host (the multi-tenant SDMX-endpoint case the §25 doc was *designed* for — `url: 'https://api.geostat.ge/sdmx/...'`).
- **Cost/risk + YAGNI:** **REAL cost, NO consumer today → DEFER behind door `D-HREF`.** The cost is not the fetch — it is the *tail*: `format` parser registry (CSV/SDMX-JSON/REST-JSON → rows; the `fromSDMX` adapter boundary, Law 5), the `AuthConfig` discriminated union (bearer/basic/apikey — secrets handling, a security surface), and Suspense-timed classifier resolution (Tier-2/3 — the genuinely-clever-but-unbuilt envelope). Building all that for zero current consumer is textbook speculative generality (YAGNI FAILS today). **AND: the half-built `ApiSource` ghost is a Lava-Flow that should be cleaned up regardless** (delete the `null`-returning `api` branch + the dead-file comment in `resolve.ts`, or finish it — but do not leave it).

### STOREID (named cube)
- Covered in [[multistore-storeid-reintroduction]]. This ADR's only addition: **storeId is one kind among three; the kind-dispatch must stay OCP-open** so static/href register beside it. It is the correct *default* (governed, live, the real backend), and nothing here weakens it.

---

## 6. WHAT WE DO — the recommendation

**Re-adopt the spectrum as THREE KINDS behind the ONE `DataStore` port (the canonical hybrid). Register `static` now. Defer `href` behind a named door. Keep `stats` as the default. Clean up the `href` ghost.**

### Adopt now (the vital few)
1. **Register a first-class `static` store kind.** `registerStoreBuilder('static', async ({id, params}) => new ExternalStore(params.values ?? [], { classifiers: params.classifiers, display: params.display }))` in `@statdash/plugins/datasources` (beside `stats`, the established shared seam — Law 3 holds). The §25 `static` plugin is the blueprint. This promotes the four scattered static fragments into one named kind addressable by `storeKey` — and makes the **round-trip provable end-to-end** (a config with a `static` source renders with zero backend).
2. **Keep `transform.source`/`pivot.rows` as bounded node-local inline-static sugar.** No change; just pin the invariant (a literal array, never a remote ref) with a fitness function. This is the legitimate node-level `values` (Adaptive-Cards `$data`), distinct from the `static` *store kind*.
3. **Clean up the HREF ghost (Strangler-Fig: remove dead code).** Either delete the orphaned `ApiSource` `null`-branch + stale `FilterSchema.tsx` comment in `resolve.ts`, or quarantine `ApiSource` behind D-HREF with an explicit `// deferred — see ADR D-HREF` marker. A `null`-returning branch pointing at a deleted file is a broken window; the no-degradation law (Law 6) says fix it. **Decision: delete the dead selector-layer `api` path now; HREF re-enters as a STORE kind, not a selector type.**

### Defer behind named doors (YAGNI holds)
- **`D-HREF` — the `href` store kind.** `registerStoreBuilder('href', ...)` = `HrefStore(url, format)` with a `format` parser registry + (later) `AuthConfig`. **Trigger:** the first real author-supplied external/remote source (an open-data URL, an external SDMX endpoint, a non-`/api/stats` backend, or the first true multi-tenant deployment whose data lives at a URL we don't host). When it opens, build it as `fetch(url) → format-parse → ExternalStore`-shaped rows; lift the §25 `sdmx-api`/`rest-json` plugins + `SuspenseStore` + `ApiResponse` envelope *only as far as the consumer needs* (probably JSON-only first; CSV + auth + Tier-2/3 each behind their own sub-trigger). This is the same door as [[multistore-storeid-reintroduction]] D1 (`ApiResponse` Tier-2/3) — they open together.
- **`D-STATIC-ASSET` — static-by-reference.** `StaticStore` resolving `params.assetId` (a bundled/uploaded large dataset) instead of inline `params.values`. **Trigger:** the first static dataset too large to inline comfortably in the config (Observable `FileAttachment` pattern). Until then, inline `values` suffices.
- **`D-EXTRACT` — freeze a storeId query into a static snapshot** (Tableau extract / Power BI import). **Trigger:** a real need to portable-ize a live dashboard (export with frozen data). The generic-dim long-format invariant makes this cheap later.

### Rejected alternatives
1. **Restore the full `25-datasource-system.md` envelope (sdmx-api/rest-json plugins + `ApiResponse` Tier-1/2/3 + `auth`) now.** REJECTED — speculative generality for zero current HREF consumer; the `stats` per-dim/per-query design is simpler and superior for the one real backend. (Same verdict as [[multistore-storeid-reintroduction]] D1.)
2. **Add a node-level `DataSpec.data: { values | url | name }` Vega-Lite-literal union as the primary mechanism.** REJECTED — creates a SECOND "which source" mechanism beside `storeKey` (F-A/F-B fragmentation; divergent-change smell; un-governed, un-reused per-node url). The discriminant belongs at the manifest/store tier (Grafana/Retool/Superset all agree). The *bounded* `transform.source` node-local inline is the only node-level exception, and it carries literals only.
3. **Leave `static` as scattered fragments (Null Object + transform.source + InlineSource + unregistered `external`).** REJECTED — that *is* the un-unified growth the laws refuse; four surfaces for one concept (static data) with no single named kind. Promote to one `StaticStore` kind.
4. **Build `href` now "because Vega-Lite/Grafana have it."** REJECTED — no consumer; real tail-cost (format/auth/Suspense). Name the door (D-HREF), keep the minimalism insight (it's a small builder when it comes), open on trigger.
5. **Keep the `ApiSource` ghost as-is "in case we need href."** REJECTED — a `null`-branch pointing at a deleted file is a broken window (Lava Flow). Dead code is not a placeholder; the door (D-HREF) is the placeholder. Delete it.

### Phased Strangler-Fig path
- **S0 — Register `static` kind + fitness nets.** Add the `static` builder (`ExternalStore` from `params.values`); land `FF-STATIC-KIND` + `FF-SOURCE-KIND-CLOSED`. Prove a `static`-source page renders with zero backend (the round-trip win). *Cheap, immediate.*
- **S1 — Unify the static fragments.** Point the `staticStore` fallback, `transform.source` documentation, and `InlineSource` at the one conceptual model ("inline data is the `static` kind, or node-local `transform.source` for typed literals"). Pin `transform.source = literal-only` (`FF-NO-FETCH-IN-CONFIG`).
- **S2 — Clean the HREF ghost.** Delete the dead `api` selector branch (`resolve.ts`) + stale comment; mark `ApiSource` as D-HREF-deferred or remove. No new code; remove dead code.
- **S3+ — open D-HREF / D-STATIC-ASSET / D-EXTRACT only on their named triggers**, building each as a store kind behind the existing port + registry.

### Fitness functions
- **`FF-STATIC-KIND`** — a `DatasourceInstanceConfig { kind:'static', params:{ values } }` builds via `buildStoreManifest` into a `DataStore` that serves `params.values` through `querySync`; a `static`-sourced page renders identical rows with NO network call (the offline/round-trip invariant made executable).
- **`FF-SOURCE-KIND-CLOSED`** — `buildStoreManifest` dispatches every `kind` through `registerStoreBuilder` (no hardcoded `if kind==='stats'`); adding a kind = one registration, zero resolver edits (OCP guard — catches re-privileging one kind).
- **`FF-NO-FETCH-IN-CONFIG`** — no `DataSpec` (esp. `transform.source`/`pivot.rows`) and no `DatasourceInstanceConfig` carries a function, `fetch`, or imperative loader; `static` data is literal values, `href` data is a `url` string + declared `format` (Law 2 — config is declarative; the source-mode never smuggles logic).
- **`FF-CONFIG-ROUNDTRIP`** (existing, extend) — `kind`/`url`/`params.values` survive `JSON.parse(JSON.stringify(config))` unchanged across all three modes.
- **`FF-HREF-DOOR`** (latent, activates with D-HREF) — when `href` is registered, an author-supplied url + format resolves to rows through the SAME `DataStore` port as `stats`/`static` (no parallel resolution path).

---

## 7. Alignment with project laws + prior ADRs
- **Law 1 (no privileged dims):** source-mode is dimension-blind; `StaticStore`/`HrefStore`/`ApiStore` all serve generic `Record<dim,val>` rows. No mode hardcodes a dimension.
- **Law 2 (config declarative):** `static`=literal `values`, `href`=`url`+`format` string, `storeId`=named ref. No mode admits a function/`fetch`/loader into config — the fitness `FF-NO-FETCH-IN-CONFIG` enforces it. The `ApiSource` ghost's `url` was already declarative; its sin was a dead resolver, not impurity.
- **Law 3 (arrow):** all builders register in `@statdash/plugins/datasources` (below `apps/*`); the `static` builder uses `ExternalStore` from `@statdash/engine` (core) — arrow holds, exactly as `stats` does.
- **Law 4 (full standards):** we adopt the Vega-Lite `data: {values|url|name}` trichotomy *whole* (the canonical spectrum), placed at the store tier (Grafana/Retool form) rather than the node tier — the best form for a governed platform.
- **Law 5 (API-readiness):** swapping a source = a `config.data_source` row (`kind` flip), not a deploy. `fromSDMX` stays the sole HREF adapter boundary when D-HREF opens.
- **Law 6 (best/root-cause):** the `ApiSource` ghost is fixed at the root (delete the dead branch), not patched. Static is unified (one kind), not left fragmented.
- **Law 7 (architecture leads):** target = three kinds behind one port; the scattered static fragments migrate to the `static` kind (Strangler-Fig), the architecture is not bent to keep four static surfaces.
- **Law 8 (platform thinking) + YAGNI:** `static` is built because the second consumer is real (tests + round-trip + `emptyManifest` + `transform.source`); `href` is deferred because it is speculative — the discipline cuts exactly where the consumer line is.
- **Ties to [[multistore-storeid-reintroduction]]:** that ADR's routing spine + this ADR's source kinds compose — `resolveStore` routes to a named store; that store's *kind* (this ADR) decides static/href/live. D-HREF here = D1 there (open together). [[adr-data-reference-render-vision]] R1 (semantic layer): a metric names its store; that store's kind is orthogonal — a metric can resolve to a `static` snapshot or a live cube identically.

## 8. Consequences
- **Positive:** the full Vega-Lite spectrum restored with ~one new builder; static unified from four fragments to one named kind; the round-trip provable end-to-end (offline render); the HREF ghost cleaned; the kind-dispatch proven OCP-open for the next source type; zero new resolution architecture (the port + cascade + manifest already carry it).
- **Negative / trade-offs:** a transitional period where `transform.source` (node-local static) and the `static` *kind* (manifest static) coexist — two static surfaces by design (one node-local-typed, one named-reusable); documented as the bounded exception, not drift. Deferring `href` means the §25 envelope work stays unbuilt — accepted, behind a named door with the cost honestly logged.
- **ISO 25010:** maximizes **Portability** (offline/static configs), **Maintainability** (one kind not four fragments; OCP registry), **Reusability** (named static sources, Superset-style); trades a small transitional duplication (two static surfaces) and defers **Functional suitability** of remote sources (href) until a consumer justifies its cost.
