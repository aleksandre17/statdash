---
title: Statistical Platform North-Star (maturity-gap vision)
status: Proposed (vision / direction-setting)
date: 2026-06-26
authors: architect (Opus)
migrated_from: adr_statistical_platform_north_star
---

# ADR-015 — Statistical Platform North-Star

**Status:** Proposed (vision / direction-setting, NOT a build order). Sets the long-horizon target the codebase migrates toward (Law 7); each capability carries a named trigger (the seam goes in now, the build waits for the trigger — YAGNI).

## Context

Benchmarked against Eurostat / .Stat / IMF / OECD plus modern data-platform concepts (VTL, dbt, data-contracts, W3C PROV, FAIR, RDF-cube). The platform is NOT greenfield catching up: the SDMX Information Model is already the cube's spine (DSD, codelists with SCD-2 + code-chain LTREE, ConceptScheme V27, categorisation V29, dataset lifecycle V28, vintage-as-release V25, ContentConstraint V26, reference metadata V31). The gaps are mostly *serving the model out*, *declarative-ifying transforms*, and *capturing lineage* — not re-modelling. Genuine differentiators to NOT erode: the lossless no-code Constructor spine, the generic-dimension law (Law 1), and SCD-2 + code-chain identity.

## Decision

- **A 12-capability maturity matrix with a seam-first, YAGNI-gated roadmap.** Top tier (TIER1): VTL, SDMX-REST serve, SIMS/ESMS + PROV.
- **Three ports absorb the whole roadmap:** a Serializer port (`?format=`), a silver-layer `RuleSpec` (VTL-ready validation-as-data), and a QuerySpec — plus two cheap columns (`submission.provenance`, `release.pid`).
- **Every capability is trigger-gated**; the moat is the lossless Constructor + Law-1 generic dims, which every capability must preserve (stay declarative).

## Rejected Alternatives

1. **Build all 12 capabilities now (a full VTL engine, full SDMX-REST, full SIMS)** — REJECTED (YAGNI): the seams/ports go in cheaply now; the builds wait for named triggers. Over-building risks the wrong design with no consumer.
2. **Bolt SDMX on as an export format (the benchmarked-platforms approach)** — REJECTED: here SDMX IS the domain model, not an export shim; the roadmap serves the model out rather than re-modelling to a serialization.
3. **Erode the declarative Constructor spine to add a capability faster** — REJECTED: a function-in-config forfeits the platform's moat; every capability must stay declarative/authorable.

## Consequences

- Positive: a clear maturity target with three ports that absorb most of the roadmap; the moat (no-code spine, Law 1) is explicitly protected.
- Negative / cost: the vision is not a build order — discipline is required to only build behind a triggered seam.
- Related: [[ADR-004]] (Ingestion) supplies the Serializer/QuerySpec/RuleSpec seams; [[ADR-007]] (SDMX P1) supplies the information-model completeness.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`.


# North-Star — statistical-data + ingestion architecture (maturity-gap vision)

**Status:** Vision / direction-setting (NOT a build order). Sets the long-horizon target the codebase migrates toward (Law 7: architecture leads, code follows). Each capability carries a **named trigger** — the seam goes in now (cheap, additive), the build waits for the trigger (YAGNI).
**Date:** 2026-06-26.
**Grounded on disk** (verified, not from frozen memory): V25 release/vintage, V26 content_constraint, V27 concept_scheme, V28 dataset_lifecycle, V29 category_scheme, V31 reference_metadata (ESMS-lite) all APPLIED in `ops/postgres/migrations/`. The live ingest Pipe-and-Filter is `apps/api/src/ingest/{submit,conform,validate,region,publish,upsert,worker}.ts`. The engine consumer contract is `packages/core/src/core/provenance.ts` (`ProvenanceRecord` + `MetadataPort`) and the semantic layer is `packages/core/src/data/metric.ts` (`MetricDef`/`resolveMeasureRef`/`withMetricProvenance`). The serve surface is `apps/api/src/routes/stats/{datasets,observations,classifiers,releases}.ts`.
**Related ADRs:** [[vintage-release-adr]] (V25) · [[content-constraint-adr]] (V26) · [[classifier-code-path-adr]] (V23/24) · [[adr-excel-ingestion]] (ADR-0030) · [[ingestion-architecture]] (Staged Submission Pipeline) · [[i18n-db]].

---

## 0. Honest framing — where this platform already SITS

This is not a greenfield catching up to the standard. The SDMX **Information Model is already the cube's spine** — DSD (dimensions+measure+attributes), codelists (SCD-2, code-chain LTREE hierarchies), concepts (ConceptScheme V27), categorisation (V29), dataset lifecycle as a maintainable artefact (V28), vintage-as-release (V25), ContentConstraint cube regions (V26), reference metadata (V31). Most platforms benchmarked here bolt SDMX on as an export format; **here it IS the domain model.** The gaps below are therefore mostly about *serving the model out*, *declarative-ifying the transforms*, and *capturing lineage* — not re-modelling.

**Genuine differentiators (at or ABOVE best-in-class — do NOT erode these):**
- **Lossless one-renderer Constructor spine** — config is SSOT, `render(config)→UI` is pure, visual↔JSON round-trips losslessly (§12 of the skill). Eurostat/.Stat have data portals but **no config-driven no-code dashboard constructor of this fidelity**. This is the platform's moat; every capability below must stay *declarative* to preserve it (a function in config = not Constructor-ready).
- **Generic-dimension law (Law 1)** — no privileged `time`/`geo`. Even .Stat hardwires some axes. Our `Record<K,V>` + generic FKs (V27 `dimension_code` generic FK, V31 target polymorphism) are cleaner than the references.
- **SCD-2 everywhere + code-chain identity (ADR-0023)** — vintage-stable hierarchy paths that survive revision. Most open-data stacks lose codelist history on re-load.
- **Silver approval gate with a full per-row issue report** (`validate.ts`) — closer to IMF SDMX data-sharing than to a naive ETL.

The roadmap's job is to **extend the moat outward** (serve the model, make transforms declarative, capture lineage) — not to import someone else's architecture.

---

## 1. Maturity matrix

Scale 0–5: 0 absent · 1 ad-hoc · 2 partial/implicit · 3 structured-internal · 4 standard-conformant · 5 best-in-class/served-out.

| # | Capability | Now | Best-in-class reference | The gap | The SEAM to reserve NOW (so the future is additive) |
|---|---|---|---|---|---|
| 1 | **Validation + transformation language** | 3 | **VTL 2.1** (Eurostat/.Stat/ECB), dbt tests, Great Expectations | DQAF/conform/region checks are imperative TS scattered across `validate.ts`/`region.ts`. No declarative, portable, named rule language. ADR-0030 melt/codeFromLabel ops are bespoke. | A **`RuleSpec`/`ExpectationSet` port** in the silver stage: `validate.ts` calls a `runRules(rules, rows, ctx): Issue[]` seam where `rules` is *data* (a closed-vocabulary rule list), not code. Today the rule list is the hardcoded validators; tomorrow it's VTL-compiled. Keep the `IssueCode` union as the stable output contract. |
| 2 | **SDMX-as-a-service (structure + data)** | 1 | **SDMX-REST 3.0** (Eurostat SDMX-RI, IMF/ECB/BIS endpoints), OECD .Stat | Serve routes are bespoke JSON (`routes/stats/*`). DSDs/codelists/dataflows/concepts exist in DB but are NOT emitted as SDMX `/structure` messages; observations not served as SDMX-JSON/CSV `/data`. The ecosystem cannot consume us. | A **serializer port** behind the read routes: `routes/stats/` already separates read from store. Add a `?format=` content-negotiation slot (default = current JSON) so `format=sdmx-json-2.0 / sdmx-csv / structure+json` are additive serializers over the SAME query result, never a new query path. |
| 3 | **Reference metadata (SIMS/ESMS) + structured DQAF quality** | 3 | **ESMS/SIMS** + **ESQRS** quality reports (Eurostat), IMF DQAF | V31 ships ESMS-*lite* (typed dataset-level columns, SCD-2, i18n) — covers the badge. NO full ~21-concept ESMS/SIMS tree, no structured ESQRS quality report, no metadata served as SDMX-RM. | **Already reserved** in V31: `metadataflow_code` FK is the documented seam — the full predicate-row attribute engine slots behind a flow whose attributes live in a future `stats.metadata_attribute` table. Target polymorphism (`target_type`) already lets metadata attach to dimension/classifier. |
| 4 | **Lineage / provenance (source→transform→cube)** | 1 | **W3C PROV**, OpenLineage/Marquez, DataHub, dbt lineage | `ProvenanceRecord` carries *dataset-level* provenance (source/methodology/vintage) — that is **descriptive** provenance, not **process** lineage. We do NOT capture "which submission, via which mapping/rules, produced this observation revision." | The Staged Submission Pipeline IS the lineage spine — `submission` + `release` (V25) + `observation_revision` already record the *event*. Reserve a **`prov_activity` capture point**: stamp each submission with its `mapping_id`/`ruleset_id` + input digest, and have `observation_revision` already FK the release. The PROV graph is then *derivable*, not a parallel system. SEAM = a nullable `provenance JSONB`/`source_digest` on `submission`. |
| 5 | **Data contracts + schema evolution** | 3 | **Schema Registry** compat modes (BACKWARD/FORWARD/FULL), data-mesh data contracts, dbt contracts | DSD is enforced (V4 trigger) and migrations are governed (expand-contract V27, two-way risk gate). But there's NO *formal compatibility policy*: codelist=open-extend vs DSD=governed-version is practiced, not declared/checked. No deprecation lifecycle on a *codelist* (only on dataset, V28). | A **compatibility-mode declaration** on the DSD/dataflow + a **fitness function** asserting it (the policy AS a test, not prose). SEAM = a `compat_mode` column on `stats.dataset` (or metadataflow) + a CI check: "a published DSD change is additive unless a new dataset version (V28 `replaced_by`) is minted." V28's supersession chain is the version vehicle already. |
| 6 | **Data observability + declarative expectations** | 2 | **Great Expectations / Soda**, Monte Carlo, dbt freshness | DQAF integrity checks (BALANCE/IDENTITY/TOTAL_RECONCILE per ADR-0030) are real but *embedded in TS and warn-only*. No freshness/volume/anomaly monitors, no expectation-suite-as-data, no metric history. | Same `ExpectationSet` port as #1 (validation and observability are the same declarative-rule seam — Great Expectations unifies them). Reserve an **`expectation_result` sink** keyed by (dataset, release) so freshness/volume/distribution checks log over time. The release table (V25) is the natural time axis. |
| 7 | **Discoverability / catalog (FAIR-findable)** | 3 | SDMX dataflow + **CategoryScheme** as catalog, **DataHub/OpenMetadata/Amundsen**, DCAT | V29 CategoryScheme + V28 lifecycle + a catalog projection already exist (browse-by-theme, published-only). Missing: a served **DCAT/DCAT-AP** or SDMX dataflow catalog *document*, full-text search, the metadata (#3) joined into the catalog card. | The catalog route is the seam — it already joins `dataset_published` + categorisation. Reserve a **catalog projection contract** that #2's serializer can emit as DCAT-AP / SDMX `/dataflow`. No new store; a serializer over the existing projection. |
| 8 | **Persistent identity + citability (FAIR)** | 0 | **DOI / Handle** per dataset+vintage (Datacite), Eurostat permalinks | URL=permalink exists (Law 9) but no minted persistent identifier per dataset *vintage*. A citation cannot pin "GDP_ANNUAL as published 2024-Q3". | V25 `release` IS the citable unit (it already has a stable UUID + `published_at`). Reserve a nullable **`doi`/`pid` column on `stats.release`** + a resolver route `/cite/:pid → asOf permalink`. The vintage is already addressable; minting is the only missing step. |
| 9 | **Linked data (RDF Data Cube)** | 0 | **W3C RDF Data Cube (QB)**, SDMX-RDF, ECB linked-data | No RDF/Turtle/JSON-LD export. The SDMX IM maps almost 1:1 to W3C QB (qb:DataSet/qb:Observation/qb:dimension), so the gap is purely a serializer. | #2's serializer port again — `format=qb-turtle` / `application/ld+json` is one more serializer over the same DSD+observation query. The seam is identical; this is a *trigger-gated output format*, not new modelling. |
| 10 | **Multi-format serving (Frictionless / Parquet / OData / GraphQL)** | 1 | **Frictionless Data Package**, Parquet/Arrow, **OData v4** (.Stat), GraphQL | Observations serve as bespoke JSON. No Data Package descriptor (`datapackage.json`+Table Schema — note ADR-0030 already *consumes* Frictionless on ingest), no columnar bulk export, no OData/GraphQL query grammar. | #2's content-negotiation slot covers Data-Package + Parquet (serializers). OData/GraphQL are a *query-grammar* seam — reserve a **`QuerySpec → store` boundary** so a future OData/GraphQL parser produces the same internal `ObsQuery` the routes already build. Do NOT fork the query path. |
| 11 | **Statistical disclosure control (cell suppression)** | 1 | Eurostat τ-ARGUS / cell suppression, OBS_STATUS='c' | `ObsStatus 'c' = confidential` is *defined* in `provenance.ts` but there's no suppression *engine* (primary/secondary suppression, dominance rules). National-accounts aggregates are largely non-sensitive, so this is **low-priority/possibly-YAGNI** for this domain. | The ContentConstraint predicate-row model (V26) is the natural home for a suppression rule (it already expresses "this combination is special"). Reserve nothing new now — flag that V26 + OBS_STATUS='c' is the seam IF a sensitive (e.g. business-level micro) dataset ever arrives. **Honest call: gold-plating until a sensitive dataset exists.** |
| 12 | **Statistical-semantics completeness** (seasonal-adjustment metadata, index base periods, hierarchical/measure dims, time-granularity) | 3 | SDMX cross-domain concepts (FREQ, ADJUSTMENT, BASE_PER, UNIT_MEASURE, DECIMALS), Vega-Lite/GoG | Strong: V9 full-frequency time, V16/V20/V21 unit-measure, SCD-2 hierarchical codelists, ContentConstraint. Thin: no explicit `ADJUSTMENT`/`BASE_PER` concepts wired to badges, measure-dimension (multi-measure cube) is implicit, no seasonal-adjustment provenance. | These are **new concepts in the existing ConceptScheme (V27) + new attributes** — the model already accepts them (Law 1: a new concept = an INSERT). Reserve nothing structural; the seam is "author the cross-domain concepts when a seasonally-adjusted series arrives." |

---

## 2. Prioritized roadmap (highest-leverage first)

The user's instinct — **VTL · SDMX-serve · SIMS/ESMS+PROV as top tier** — is **validated**, with one refinement: **SDMX-serve (#2) is the single highest-leverage move** because it is one *serializer port* that simultaneously unlocks #2, #7-doc, #9, and most of #10 (they are all serializers over one query result). VTL (#1) is the highest-leverage *internal* move. PROV (#4) is the cheapest of the three because the event spine already exists.

### TIER 1 — the moat-extenders (do the SEAMS now; build on trigger)

**A. SDMX-REST serializer port (#2, and the carrier for #7/#9/#10).**
- *Why top:* one seam, four capabilities. Makes the platform a *producer* in the official-statistics ecosystem, not just a consumer.
- *Seam now (cheap, additive):* a `?format=` content-negotiation slot + a `Serializer` interface (`(queryResult, dsd) → Body`) behind `routes/stats/{datasets,observations}.ts`. Default serializer = today's JSON (byte-identical — Postel/expand-contract). Register `sdmx-json-2.0`, `sdmx-csv`, `structure+json` as additional serializers.
- *Trigger:* the first external/ecosystem consumer asks for a standard endpoint, OR a second front-end needs the structure messages. (Until then: only the JSON serializer is registered.)
- *Effort/risk:* M effort, LOW risk (pure read-side addition; the query is unchanged; fitness function = "JSON serializer output is byte-identical to pre-port").

**B. VTL 2.1 as the declarative rule language (#1, carries #6).**
- *Why top:* turns the imperative silver checks + ADR-0030 ops + DQAF integrity into *data* — Constructor-authorable rules, portable to/from the .Stat ecosystem, and the moat (declarative spine) extended to validation.
- *Seam now:* an `ExpectationSet`/`RuleSpec` port in `validate.ts` — `runRules(rules: RuleSpec[], rows, ctx): ValidationIssue[]`, where `RuleSpec` is a closed-vocabulary data shape (the existing validators become the *first* registered rule kinds). The `IssueCode` union stays the stable output contract. **Do NOT adopt a VTL engine yet** — reserve the port; the rules start as the named TS validators.
- *Trigger:* the second integrity rule a *curator* (non-programmer) needs to author, OR a rule that must round-trip with .Stat. Then compile VTL → `RuleSpec`.
- *Effort/risk:* seam = S; full VTL engine = L (defer hard). Risk LOW for the seam, MED for a VTL engine (scope discipline — adopt the VTL *subset* the real rules need, per Law 4-vs-YAGNI).

**C. PROV lineage capture (#4).**
- *Why top:* auditability (ISO 25010) + the foundation under #5/#6; and it is *cheap* because the event spine (submission + release V25 + observation_revision V8) already exists.
- *Seam now:* a nullable `source_digest TEXT` + `provenance JSONB` (mapping_id, ruleset_id, input hash) on the `submission` row, stamped at `createSubmission`. The PROV graph (Entity=observation/dataset, Activity=submission/release, Agent=curator) becomes *derivable* from existing tables — never a parallel store.
- *Trigger:* the first audit/reproduce-this-figure request, OR PROV/OpenLineage export is asked for. Then add the serializer (reuses #A's port).
- *Effort/risk:* S effort, LOW risk (one nullable column + one stamp site; additive).

### TIER 2 — governance hardening (seam now, build when the corpus grows)

**D. Data-contract compatibility policy + codelist/DSD versioning (#5).** Seam = `compat_mode` on dataset/metadataflow + a *fitness function* encoding "codelist open-extend, DSD governed-version (mint a V28 `replaced_by` for a breaking change)." Trigger: the first breaking DSD change request, or the second consumer that pins a structure. Effort S, risk LOW. (V28 supersession is the version vehicle already.)

**E. Declarative expectations + observability sink (#6).** Same port as #B; add an `expectation_result` table keyed by (dataset, release) for freshness/volume/distribution history. Trigger: the first "the data looks wrong and nobody noticed" incident, or scheduled (non-submission-driven) refresh. Effort M, risk LOW.

**F. Full ESMS/SIMS + ESQRS quality (#3).** Build the predicate-row `stats.metadata_attribute` engine **behind the V31 `metadataflow_code` seam (already reserved).** Trigger: a metadata *panel/consumer* exists OR SDMX-RM export is needed (no consumer today — explicit YAGNI per V31's own note). Effort L, risk LOW (additive behind the existing flow FK).

### TIER 3 — FAIR / ecosystem polish (trigger-gated, mostly serializers)

**G. DOI/Handle citability (#8).** Nullable `pid` on `stats.release` + `/cite/:pid` resolver. Trigger: an external citation/publication requirement. Effort S.
**H. RDF Data Cube export (#9).** One serializer in #A's port (`qb-turtle`). Trigger: a linked-data/SPARQL consumer. Effort S–M.
**I. Frictionless Data Package + Parquet + OData/GraphQL (#10).** Serializers (#A) for Data-Package/Parquet; a `QuerySpec` parser seam for OData/GraphQL. Trigger: a bulk-data or programmatic-query consumer. Effort M–L.
**J. Cross-domain stat concepts — ADJUSTMENT/BASE_PER/seasonal-adj provenance (#12).** New concepts in V27's ConceptScheme + badge wiring. Trigger: a seasonally-adjusted or index series arrives. Effort S (data, not schema).

### NOT NOW — flagged as gold-plating until a trigger exists

**Statistical disclosure control / cell suppression (#11).** National-accounts aggregates are non-sensitive; building τ-ARGUS-class suppression is gold-plating until a confidential micro-dataset arrives. The seam (V26 predicate rows + OBS_STATUS='c') is *already latent* — reserve nothing, just note it.

---

## 3. The unifying architectural insight (the vision-level point)

Three **ports** absorb almost the entire roadmap — this is the shape to build the architecture *toward* now:

1. **A read-side `Serializer` port** (`?format=` content-negotiation over the existing query result) → carries SDMX-REST data+structure (#2), DCAT/dataflow catalog doc (#7), RDF Data Cube (#9), Data Package + Parquet (#10), PROV/RM export (#3/#4). *One seam, six capabilities.* This is the single most leverage-dense decision.
2. **A silver-stage `RuleSpec`/`ExpectationSet` port** (`runRules(rules, rows, ctx)`) → carries VTL validation+transformation (#1) and declarative observability (#6). Keeps the moat (declarative, Constructor-authorable) extended to data quality.
3. **A `QuerySpec` boundary** in front of the store → lets OData/GraphQL (#10) become *parsers* that produce the same internal `ObsQuery`, never a forked query path.

Plus two cheap **data seams** on existing event tables: `provenance/source_digest` on `submission` (#4) and `pid` on `release` (#8). And the **already-reserved** `metadataflow_code` seam (#3).

Reserve those three ports + two columns now, and every capability above lands **additively** — no rewrite, ever. That is the North-Star: not building these features, but **shaping the architecture so it is permanently ready to accept them** the moment a real trigger fires (YAGNI honoured, Open/Closed honoured, the Constructor moat preserved).

---

## 4. Trade-off ledger (ISO 25010, named)

- **Gained across the roadmap:** *Compatibility/Interoperability* (SDMX-serve, RDF, Data Package — interop is the headline win), *Maintainability/modifiability* (declarative rules via VTL port), *Auditability* (PROV), *Reliability* (observability), *Findability/FAIR* (catalog+DOI).
- **Traded / guarded against:** *Complexity creep* — every item is **trigger-gated** so the surface stays minimal until a real second caller (YAGNI is the explicit counterweight to Law 4's "adopt standards whole"). *Moat erosion* — the non-negotiable constraint on ALL of the above: nothing may put logic in config or break the lossless render(config)→UI spine. A serializer/rule that needs a function-in-config is rejected (it would forfeit the differentiator).
- **One-way doors:** minting DOIs (#8) and publishing public SDMX structure IDs (#2) are externally-observable commitments — version/agency identity must be decided once (use the V27/V29/V31 `agency`+`version` artefact-identity already in the schema). Flag for explicit user sign-off before first public mint.
