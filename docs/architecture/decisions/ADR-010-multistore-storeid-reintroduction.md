---
title: Multi-store / storeId Re-introduction
status: Accepted (implemented)
date: 2026-06-25
authors: architect (Opus)
migrated_from: adr_multistore_storeid_reintroduction
---

# ADR-010 — Multi-store / storeId Re-introduction

**Status:** Accepted (implemented). The routing spine is LIVE: `buildStoreManifest` + `resolveStore` + node `storeKey`, with three real cubes seeded (gdp/accounts/regional). What was dropped (and stays deferred behind named doors) is the authoring + envelope half. See [[project_data_binding_shipped]].

## Context

Multi-store routing (a node selects which named cube it reads) appeared sidelined, but investigation found the spine already live. What was actually dropped was the AUTHORING + ENVELOPE half: `ApiResponse` Tier-2/3, `structureUrl`, the auth union, `getMetadata`/`testConnection`, and blending. The question was how much to re-adopt.

## Decision

- **Re-adopt a contained slice, not the whole envelope.** M0: prove routing. M1: metric → store (via R1, the semantic-layer spine of [[ADR-001]]). M2: a Constructor authoring seam for the source.
- **Defer envelope / auth / blending behind named doors D1–D3.** Benchmarked per platform: Grafana Mixed, Cube dataSource-on-measure, Tableau blend, Superset dataset, Looker model.

## Rejected Alternatives

1. **A node-level `DataSpec.data` union to select the store** — REJECTED (same as [[ADR-001]] rejection B): a second "which data" mechanism beside `storeKey` = fragmentation. The discriminant stays `storeKey` → kind via the manifest.
2. **Restore the full envelope/auth/blending now** — REJECTED: no consumer for most of it; re-adopt only the contained routing + metric→store + authoring slice, gate the rest behind D1–D3 (YAGNI).

## Consequences

- Positive: routing is live and proven; metric→store and source authoring are the bounded next steps; envelope/auth/blending are trigger-gated.
- Negative / cost: the authoring half and the response envelope remain unbuilt until their doors open.
- Fitness functions: `FF-MULTISTORE-ROUTES`, `FF-METRIC-NAMES-STORE`, `FF-SOURCE-AUTHORABLE`.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`.


# ADR — Multi-store / storeId Architecture: Re-introduce, Partially, or Defer?

**Status:** Proposed (2026-06-25). Independent assessment requested by the user (nostalgia-check, not a rubber-stamp).
**Relates to:** [[bootstrap-runner-adr]] (ADR-0026), [[project_detenant_phase_c_adr]] (ADR-0028), [[data_reference_render_vision]] (R1 semantic layer), [[semantic_layer_n26]], [[config_and_render_vision]].

---

## 0. TL;DR verdict

**The multi-store spine is NOT sidelined — it is LIVE and load-bearing today.** What the user remembers as "the storeId architecture we built heavily" is *mostly shipped* under different names: `buildStoreManifest` + `registerStoreBuilder` + `resolveStore` + node-level `storeKey` + `DatasourceInstanceConfig` rows in `config.data_source`. Three real, dimensionally-distinct cubes (`gdp`, `accounts`, `regional`) are seeded and served.

What was sidelined is a **specific richer slice** of the original `multi-store-platform.md` vision — the **`ApiResponse` envelope with Tier-1/2/3 classifier resolution**, the **per-datasource `auth`/`structureUrl`**, the **plugin `getMetadata`/`testConnection` Constructor hooks**, and the never-built **data-blending / cross-store** node. The runtime *routing* survived de-tenanting; the *authoring + structure-resolution envelope* did not.

**Recommendation: RE-ADOPT A CONTAINED SLICE, DEFER THE REST.**
- **Adopt now (the vital few):** (1) close the multi-store *routing* gaps so the three live cubes are actually addressable per-page/per-node; (2) the `getMetadata`/`testConnection` plugin hooks as the Constructor's datasource-authoring seam; (3) wire the semantic layer (R1) as the binding spine so a node references a *metric*, and the metric names its store.
- **Defer behind named doors (YAGNI holds):** the `ApiResponse` Tier-2/3 envelope, per-source `auth` discriminated union, and **data-blending / cross-store joins**. No live consumer; re-introducing them now is speculative generality.

---

## 1. The recovered vision (what `storeId`/multi-store WAS)

Primary source: `docs/architecture/examples/multi-store-platform.md` + `docs/architecture/subsystems/25-datasource-system.md`. The design (Grafana datasource model × SDMX-JSON structure × JSON:API envelope) had **five pillars**:

1. **Three-level separation** — *Plugin type* (code, registered once) → *Instance config* (JSON in DB, Constructor writes) → *DataStore* (runtime, built at bootstrap). "Plugin = code, instance = data, store = runtime." Constructor only ever touches the middle layer; zero code change to add a source.
2. **`buildStoreManifest(configs) → Record<storeKey, DataStore>`** — async factory; one store per descriptor, keyed by `id` (= `storeKey`).
3. **Per-node `storeId` routing with CSS-cascade semantics** — a page declares `storeKey: 'gdp'` (→ `ctx.pageStoreKey`); a section can override with `storeId`/`storeKey`; nearest wins; fallback to first registered store. *This is the multi-store payoff: one page draws from many stores* (the doc's GDP page reads `gdp` AND `regional` in two sections).
4. **Three-tier classifier/display resolution via the `ApiResponse<T>` envelope** — Tier 1 (`config.classifiers`, in-manifest, instant), Tier 2 (`structureUrl`, fetched in parallel at bootstrap before React mounts), Tier 3 (structure embedded in the data response, arrives with observations). Rationale: **classifiers must be synchronous at filter-render time** (dropdowns render before data sections), observations may be lazy (Suspense). This is the genuinely clever part.
5. **Constructor authoring hooks** — `plugin.testConnection(config)` and `plugin.getMetadata(config) → DatasourceMetadata` (indicators + dimensions) so the visual builder can add a source, test it, browse its dims, and write classifiers to DB.

The problem it solved: kill the hardcoded `STORE_MANIFEST = { gdp: gdpStore, accounts: accountsStore }` (NOT a JSON platform — different tenant/format = code change). Make datasources *data*. The reference model named throughout: **Grafana datasource provisioning + Retool resources**.

---

## 2. Why it got sidelined (the honest archaeology)

Not a deliberate "kill it" decision and not pure YAGNI — it was **overshadowed by the de-tenanting drive (ADR-0026/0028)** and **narrowed by the single-cube live-data reality**:

- **De-tenanting (ADR-0028) consumed the oxygen.** The whole platform's energy went to gutting `apps/geostat` into a content-agnostic SDUI runner. The *runtime routing* half of multi-store was exactly what that needed, so it survived and got polished (`buildStoreManifest` moved to `@statdash/react/engine`, the `stats` builder to `@statdash/plugins/datasources`, the resilience fallback wired). But the *authoring envelope* (Tier-2/3, `auth`, `getMetadata`) was not on the de-tenant critical path, so it was never built.
- **The `ApiResponse` envelope was replaced by a simpler real backend.** The doc assumed external SDMX endpoints with `structureUrl`. The actual backend (`apps/api` + Postgres + `/api/stats`) made the envelope moot: the `stats` builder fetches classifiers per-dim at build time (`fetchDimClassifiers`) and observations per-query (`ApiStore`, Cache-Aside). This is *better* than Tier-3 for the real backend — but it means the elegant 3-tier envelope is unbuilt and, for the current backend, **unneeded**.
- **`DatasourceInstanceConfig` was simplified.** The doc's rich `{ plugin, url, auth, structureUrl, classifiers, display, options }` collapsed to the live `{ id, kind, url?, params? }` (`packages/core/src/data/datasource.ts`). `plugin`→`kind`, and `auth`/`structureUrl`/inline-`classifiers` were dropped. This is a real *regression in expressiveness* relative to the vision — but for one internal backend, none of the dropped fields had a consumer.
- **G3 live-preview hardcoded "first-cube-bound-wins"** (`livePreview.ts`) — a deliberate, documented single-store product decision for the Constructor canvas, with the keyed-multi-store path explicitly noted as "a later capability (OCP)."

**Verdict on the sidelining:** correct prioritization, *but* it left the multi-store story half-finished and undocumented-as-such. The user's instinct that "something we built heavily got overshadowed" is **accurate** — the routing survived, the authoring + structure-envelope did not, and nobody wrote the ADR that says which half is intentionally deferred. That gap is what this ADR closes.

---

## 3. What EXISTS today (the delta vs the vision)

| Vision pillar | Status today | Where |
|---|---|---|
| 3-level separation (plugin/instance/store) | **LIVE** | `registerStoreBuilder` (`storeManifest.ts`) + `config.data_source` rows + `DataStore` runtime |
| `buildStoreManifest(configs)` | **LIVE** (async, parallel, fail-fast on unknown kind) | `packages/react/src/engine/storeManifest.ts` |
| Per-page `storeKey` → `ctx.pageStoreKey` | **LIVE** | `SiteRenderer.tsx:86`, `PageStoreContext` |
| Per-node `storeKey` override, CSS-cascade | **LIVE** (resolved in `renderNode.ts:252`; nearest wins; first-registered + `staticStore` fallback) | `renderNode.ts`, `resolveStore` (`resolveNodeRows.ts:35`) |
| Multiple real cubes addressable | **SEEDED, 3 rows** (`gdp`/`GDP_ANNUAL`, `accounts`/`ACCOUNTS_SEQUENCE`, `regional`/`REGIONAL_GVA`) — distinct dims each | `apps/api/scripts/seed-data-sources.ts`, `geostat.provisioning.json` |
| Classifier resolution | **LIVE but ONE tier only** — per-dim fetch at build time (`fetchDimClassifiers`), no Tier-2 `structureUrl`, no Tier-3 envelope merge | `stats-registrations.ts` |
| `ApiResponse<T>` envelope (meta/structure/data) | **NOT built** — replaced by `/api/stats/observations` per-query + `fetchDatasetMeta` | — |
| Per-source `auth` discriminated union | **NOT built** (single internal backend, server-side auth) | — |
| `plugin.getMetadata` / `testConnection` | **NOT built** — the Constructor cannot yet add/test/browse a source from its own dims | — |
| Constructor authors datasources | **NOT built** — sources are *seeded*, not authored; `config.data_source` has no Constructor write-path |  |
| Data blending / cross-store node | **NOT built** (the doc's `CrossStoreRenderer` was illustrative only) | — |
| Live-preview multi-store | **Single-store** ("first-cube-bound-wins", deliberate) | `livePreview.ts` |

**The delta in one line:** *the routing spine is fully built and has three real consumers; the **authoring surface** and the **structure-resolution envelope** are the unbuilt half.* The page-level wiring exists; whether any seeded page actually *uses* a second `storeKey` is the open question (the routing supports it; the content may not exercise it yet).

---

## 4. Best-in-class multi-datasource architectures — the idea to steal from each

| Platform | Multi-store model | The vision/idea worth stealing |
|---|---|---|
| **Grafana** | Datasource *plugins* + per-panel datasource + the **Mixed datasource** (one panel queries N sources) + dashboard datasource *variables* (`${ds}`) | **Per-panel source + the explicit "Mixed" pseudo-source.** Our `storeKey`-per-node IS per-panel Grafana. The steal: **Mixed** — a node whose `storeKey` is a *list*, merged client-side. And the **datasource template variable** — `storeKey: '$ds'` resolved from a filter — pure config, Constructor-ready. |
| **Apache Superset** | databases → datasets (logical tables) → charts; a chart binds one dataset | **The dataset as a named, reusable logical layer** between physical DB and chart. Our `DatasourceInstanceConfig` is the database; we LACK the *dataset* tier (a saved query/metric set). R1's semantic layer IS this tier. |
| **Tableau** | Multiple data sources + **data blending** (primary/secondary, linked on shared dims) + **relationships** (noodle / logical model) | **Blending on shared dimensions.** A "primary store" + "secondary store" linked on `time`/`geo` is exactly cross-cube join WITHOUT a physical join — feasible *because* our dims are generic (Law 1). This is the strongest deferred capability. |
| **Looker** | connections → models (LookML) → explores; joins declared in the model, not the chart | **Joins live in the model layer, not the viz.** Reinforces: any cross-store relationship belongs in the semantic/binding layer (R1), never in a node's `DataSpec`. |
| **Cube.dev** | Multiple data sources + **`dataSource` routing** (a cube/measure declares which source it lives in) + a single query plane over them | **The measure names its store.** A metric in the semantic layer carries `dataSource: 'regional'`; the binding layer routes. This is the cleanest answer to "how is a store referenced" and the exact target for R1 + `storeKey`. |
| **Power BI** | Multiple sources + the **relationship model** (star/snowflake) + DAX over the model | **The model owns relationships, measures are model-scoped.** Same lesson as Looker/Cube: relationships are a first-class model artifact, not per-visual. |
| **Metabase** | databases + question/model; cross-DB query limited | Confirms even mature tools keep cross-store query *constrained* — a YAGNI signal that blending is a real-but-bounded feature, not table stakes. |
| **Retool** | Resources (named connections) registered globally; queries run per-component | **Resource = global named connection, query = per-component.** Exactly our `registerStoreBuilder` (resource) + node `storeKey` (per-component). Validates our shape directly. |

**Synthesis of the field:** the universal pattern is a **three-tier reference chain** — *physical source* (connection/database/resource) → *logical layer* (dataset/model/cube/metric) → *binding* (panel/chart references the logical layer, which routes to the physical source). **We have tier 1 (`DatasourceInstanceConfig`) and tier 3 (node `storeKey`+`DataSpec`) but tier 2 (the logical/semantic layer) is thin/unwired.** Every best-in-class platform's multi-store power comes from the *middle* tier. That is precisely R1 (semantic-layer-as-binding-spine).

---

## 5. Where the storeId vision LED vs LAGGED the field

**LED:**
- **Generic dimensions (Law 1)** make Tableau-style blending *architecturally trivial* — linking two stores on `time` needs no per-cube join code. Most platforms bolt blending on awkwardly; ours would be native.
- **Config-as-SSOT + lossless round-trip** is stricter than Grafana/Superset (whose datasource configs leak imperative bits). Our `DatasourceInstanceConfig` is pure JSON by construction.
- **The CSS-cascade `storeKey` resolution** (nearest node override wins, page default, first-registered fallback) is more principled than Grafana's flat per-panel selection — it composes.

**LAGGED:**
- **No logical/dataset tier** (Superset dataset, Cube cube, Looker explore). The node binds *physical store + raw DataSpec* directly. This is the single biggest gap and the thing R1 must fix.
- **No `getMetadata`/`testConnection`** → the Constructor cannot author a source the way Grafana/Retool can (add → test → browse dims). Sources are seeded by hand.
- **No Mixed/blended source** — every best-in-class tool has *some* cross-source story; we have none (acceptable today, but it's the named ceiling).
- **The `kind`-string + `params`-bag** lost the typed `auth`/`structureUrl`/`classifiers` of the vision. Re-tightening is needed *if and when* external (non-`/api/stats`) sources appear.

---

## 6. Re-introduction: cost / benefit, critically

### Benefits if re-adopted (and which are real *now*)
- **Multiple cubes per dashboard** — REAL. Three seeded cubes with distinct dims; a national-accounts page that shows GDP + regional GVA side-by-side is a genuine, in-domain use case. The routing exists; it likely just isn't *exercised* by current content.
- **Constructor source authoring** — REAL and rising. Constructor coverage just completed (per [[constructor_vision_north_star]]); "add a datasource" is the next obvious authoring gap. `getMetadata`/`testConnection` is the seam.
- **Multi-tenant** — PARTIALLY real. ADR-0026 Phase C's success test is "a 2nd tenant renders zero-code." Multi-store-as-data is a *prerequisite* but the tenant story is driven by the bootstrap manifest, not new store machinery — so this benefit is mostly *already banked*.
- **Data blending / per-source auth / Tier-2/3 envelope** — NOT real. Zero consumer. Speculative.

### Costs / risks
- **Complexity vs YAGNI.** Re-introducing the *full* envelope (`ApiResponse` Tier-1/2/3, `auth` union, `structureUrl`) for one internal backend is textbook speculative generality. The `stats` builder's per-dim-fetch is *simpler and sufficient*. Refuse the full re-adoption.
- **The dependency arrow.** Multi-store authoring touches `apps/panel` (Constructor) → must reach the builder via `@statdash/plugins/datasources` (already the shared seam, Law 3 holds). No new violation if done through the existing seam.
- **The validated engine + round-trip.** Node-level `storeKey` already round-trips (it's a string field on `NodeBase`, `node.ts:89`). Adding *metric references* (R1) must preserve `JSON.parse(JSON.stringify(config)) === config` — a fitness function, not a hope.
- **The two-registry tension.** [[semantic_layer_n26]] already added `MetricRegistry` as a second axis; [[data_reference_render_vision]] flagged it as an *orphan not in the binding path*. Re-adopting multi-store *through* the semantic layer is the chance to wire MetricRegistry → store routing (Cube.dev's `dataSource`-on-measure). Doing multi-store *without* R1 would deepen the orphan. **Sequence matters: R1 first, or jointly.**

### Does R1 / `resolveStore` already give us most of it?
- **`resolveStore` gives the routing** — yes, ~90% of the runtime multi-store. The gap is *content that uses >1 key* + *a node→metric→store reference* instead of node→store+rawspec.
- **R1's semantic layer is the missing middle tier** — it is *the* best-in-class answer (Cube/Looker/Superset all locate multi-store power there). Re-introducing "storeId" is really **finishing R1 such that a metric carries its `dataSource`**, and `resolveStore` already consumes the resulting `storeKey`. So: **most of the value is unlocked by completing R1 + a thin authoring seam, NOT by resurrecting the `multi-store-platform.md` envelope.**

---

## 7. Decision

**RE-ADOPT A CONTAINED SLICE. DEFER THE ENVELOPE. The slice is "finish the middle tier + the authoring seam," not "resurrect the doc."**

### Adopt (the vital 20%)
1. **Exercise + harden multi-store routing.** Confirm at least one real page binds two `storeKey`s (gdp + regional). If content doesn't yet, that's the first concrete win — a cross-cube national-accounts page. The routing code is done; this is content + a fitness test.
2. **Metric→store binding (R1 wiring).** A semantic-layer metric carries its `dataSource` (Cube.dev pattern); the binding path resolves metric → `storeKey` → `resolveStore`. This makes MetricRegistry non-orphan and gives the logical/dataset tier the field has and we lack.
3. **Constructor datasource-authoring seam.** Add `getMetadata` / `testConnection` to the store-builder contract (Grafana/Retool pattern), surfaced through `@statdash/plugins/datasources`. Constructor: add source → test → browse dims → write `config.data_source`. This is the real, rising authoring gap.

### Defer (named doors, YAGNI holds)
- **D1 — `ApiResponse` Tier-2/3 envelope + `structureUrl`.** Door opens when a *second, external* (non-`/api/stats`) source kind is real (e.g. a raw SDMX endpoint). Until then the per-dim build-time fetch is superior. *Trigger: first external/non-statistical-office source.*
- **D2 — per-source `auth` discriminated union.** Door opens with the first source requiring client-side credentials. *Trigger: first source not served behind the platform's own API gateway.*
- **D3 — Data blending / Mixed source (Tableau/Grafana).** Door opens when a single node must *combine* rows from two cubes (not just two nodes on one page). Generic dims make this cheap *later*; building it now is speculative. *Trigger: first authored chart that needs primary+secondary linked on a shared dim.* When it opens, do it in the **binding/semantic layer** (Looker/Cube lesson), never in `DataSpec`.

### Rejected alternatives
1. **Re-adopt the full `multi-store-platform.md` envelope now** — REJECTED. Speculative generality for one internal backend; the `stats` builder is simpler and sufficient; violates YAGNI + KISS.
2. **Declare multi-store "done" and do nothing** — REJECTED. The routing is done but the *logical tier* and *authoring* are genuinely missing, and the field proves that's where multi-store value lives. Three real cubes deserve to be addressable and authorable.
3. **Build data-blending now because Tableau has it** — REJECTED. No consumer; it's a one-way-door-ish surface-area increase. Keep the door (D3) and the generic-dim advantage; open on first real need.
4. **Resurrect storeId as a separate axis from R1** — REJECTED. Would deepen the MetricRegistry orphan and create two competing "which store" mechanisms. Multi-store must flow *through* the semantic layer.

---

## 8. Phased Strangler-Fig path (if adopting the slice)

- **M0 — Prove the routing (content + test).** Author/confirm one page with two `storeKey`s (gdp section + regional section). Add fitness `FF-MULTISTORE-ROUTES`. No new code if routing holds; this is the cheap validation that the spine works end-to-end with real cubes.
- **M1 — Metric→store binding.** Extend the semantic-layer metric to name its `dataSource`; route metric→`storeKey` in the binding path so `resolveStore` consumes it. Fitness `FF-METRIC-NAMES-STORE`. (Joint with R1; do not ship multi-store ahead of R1.)
- **M2 — Authoring seam.** Add optional `getMetadata`/`testConnection` to `StoreBuilderFn`'s contract (or a sibling registry); surface via `@statdash/plugins/datasources`; Constructor add/test/browse → write `config.data_source`. Fitness `FF-SOURCE-AUTHORABLE` (a Constructor-authored source round-trips to a live store with zero code change — the original vision's success test).
- **M3+ — open D1/D2/D3 only on their named triggers.**

### Fitness functions
- **`FF-MULTISTORE-ROUTES`** — a page with two distinct `storeKey`s renders both stores' data; a node-level `storeKey` override resolves the named store, not the page default (guards `renderNode.ts:252` + `resolveStore` cascade against silent regression — there's already a `resolveNodeRows.test.ts` cascade guard to extend).
- **`FF-METRIC-NAMES-STORE`** — a metric referenced by a node resolves to its declared `dataSource`'s store; an unbound metric fails fast at build, never silently reads the wrong cube.
- **`FF-SOURCE-AUTHORABLE`** — a `DatasourceInstanceConfig` written by the Constructor (not seeded) builds a live store via `buildStoreManifest` with zero code change (the three-level-separation invariant made executable).
- **`FF-CONFIG-ROUNDTRIP`** (existing, extend) — `storeKey` + metric refs survive `JSON.parse(JSON.stringify(config))` unchanged; no function ever enters a datasource config (Law 2).

---

## 9. Alignment with project laws
- **Law 1 (no privileged dims):** multi-store routing is dimension-blind; blending (D3) links on *generic* dims — the law makes it cheap.
- **Law 2 (config declarative):** `storeKey`/metric refs are strings; `DatasourceInstanceConfig` is pure JSON; refuse any `getRows`/`auth`-fn leaking into config.
- **Law 3 (arrow):** all authoring reaches the builder via `@statdash/plugins/datasources` (the established shared seam); `apps/panel` never imports `apps/geostat`.
- **Law 5 (API-readiness):** multi-store-as-data IS this law generalized — swap a source = a DB row, not a deploy.
- **Law 7 (architecture leads):** the target is the three-tier reference chain (physical→logical→binding); current content migrates onto it (Strangler-Fig), the architecture is not bent to the single-store status quo.
- **Law 8 (platform thinking) + YAGNI:** build the authoring seam now (second consumer is real — three cubes + Constructor); defer blending/envelope until their triggers fire.
