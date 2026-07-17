# DEEP-2026-07-15 — The Data-Plane Lens

> One of five parallel discipline studies (owner directive 2026-07-15: *"go into the depths … see what is not visible"*). This is the **persistence / data-architecture** root read. Read-only. Author: database-architect.
> **Question:** From the storage roots — is the data plane ONE coherent, statistics-grade body from raw ingestion to published pixel, and does the STORAGE architecture actually embody Law 11 / Canon C1 (*raw → governed semantic model → bound elements → published pages*)?

---

## 1. VERDICT — the spine is a bridge with two paper spans

**Storage embodies the spine PARTIALLY. The cube half is world-class; the semantic-model half and the seam between the two halves are not built to the same law.**

The Canon's spine is four strata:

```
[1] raw data  →  [2] governed semantic model  →  [3] bound elements  →  [4] published pages
```

What the schema actually governs, stratum by stratum:

| Stratum | Storage home | Governance grade | Evidence |
|---|---|---|---|
| **1. raw → cube** | `stats_stage.*` (bronze/silver/gold Medallion) + `stats.*` cube | **Statistics-grade.** Immutable bronze blob (`submission_blob`, content_hash idempotency), permissive silver, a publish FSM, DSD+classifier validation trigger on gold, SCD-2 revisions (V8), vintage-as-release (V25), reference-metadata SCD-2 (V31), append-only audit (V15). | `V11`, `V4` (`validate_observation_dim_key`), `V25`, `V32` |
| **2. governed semantic model** (metrics/dimensions) | `config.site_config` JSONB blob, keys `metrics` / `dimensions` ("blob-now", AR-49 M2) | **Least-governed object in the plane.** No version, no certification state, no as-of, no FK to the cube, **no write-time validation at all.** | `V3` `site_config`; `routes/config/site.ts`; AR-49 M2 open follow-up "server-side validator" |
| **3. bound elements → the cube** | `config.page_version.config` / `data_specs` JSONB; `config.data_spec.spec` JSONB | **Ungoverned reference.** Dataset/measure/classifier codes are strings inside JSONB. No referential edge to `stats.*`. | `V3`; grep: zero `config.*→stats.*` FKs |
| **4. published pages** | `config.page` + `config.page_version` (immutable snapshots, FSM), `config.snapshot` (embeds) | **Layout is governed; the numbers' lineage is not.** Page snapshot captures the tree; it does not capture, or link to, the vintage that produced its values. | `V3`; `V36` `config.snapshot` (no `release_id`) |

The cube (stratum 1) is genuinely a reference-class statistical store — the TimescaleDB partition discipline, the `dim_key` generic-series-key (Law 1 in the schema), the DSD-validated write path, and the release-as-vintage event aggregate are the work of an architect who read Kimball, SDMX and *Refactoring Databases* and applied them. **But the Canon's own words — "a number on any surface traces to a governed handle" — are architecturally unreachable in the current storage, because strata 2–4 and the seam between the two schemas were never built to the integrity standard of stratum 1.** The spine is real at both ends and paper in the middle.

---

## 2. THE INVISIBLE — seven findings nobody has named

### I-1 · The governance layer is the least-governed object in the database
`PUT /api/config/site` (`routes/config/site.ts:48`) types its body as `z.record(z.unknown())` and blind-upserts every key into `config.site_config` in one transaction. **The `metrics` / `dimensions` catalog — the semantic spine that governs every published number — is written with zero validation.** By contrast, `PUT` of a page (`routes/config/pages.ts`) runs the engine's `validateConfig` structural floor on every save. A steward can save, and persist forever, a metric whose `code` names a measure that does not exist, a `dataSource` that was retired, or a `dim` that is not in any DSD — and nothing objects. The only cube-contract check that exists (`config-cube-contract.fitness.test.ts`) runs at **build time against the committed provisioning artifact on disk** (`geostat.provisioning.json` + `DATA/canonical/*.xlsx`) — it never sees a runtime steward-authored catalog entry and never touches the live DB. "Blob-now" did not defer governance; it **removed it at the write boundary.** This is the single most consequential invisible: the object most in need of a contract has none.

### I-2 · The config↔stats referential VOID
There is **not one foreign key crossing the `config`↔`stats` schema boundary.** (Grep-proven: every cross-schema FK — `release→dataset`, `content_constraint→dimension`, `data_spec→data_source` — lives *within* one schema.) The two bounded contexts were deliberately namespaced into one database (V2 comment: "a single connection can join a page's DataSpec against the stats it references") — yet that join is never constrained, never triggered, never route-guarded. **A published page can silently point at a retired cube and no layer in the stack notices.** This is exactly the "renders, but is wrong" defect class the fitness test was written to kill (`config-cube-contract.fitness.test.ts:6-10`) — but the test cannot reach runtime-mutated config, so the defect it names is live-reachable through the normal authoring path.

### I-3 · Lineage is derivable but not a READ — and it dies at the cube's edge
V32 made the right SSOT call: the W3C-PROV / OpenLineage graph (Entity=obs/dataset · Activity=submission/release · Agent=curator) is kept **derivable** from `submission` + `release` (V25) + `observation_revision` (V8), not duplicated into a parallel store. Two problems make "every number traces" an investigation, not a query:
- **(a) Nothing materializes the graph.** There is no lineage view or function; "trace this figure" is a hand-authored multi-join across three tables and two GUC-stamped triggers. The PROV export is an explicit deferred door (V32 SEAM-DEFER) — so the read does not exist.
- **(b) The spine STOPS at `stats.observation`.** There is no edge from a *published page's rendered number* — or a *minted embed snapshot* — back to the release that produced it. The lineage plane (`stats_stage`/`stats`) and the publish plane (`config.page_version`, `config.snapshot`) **never touch.** Canon C1's "a number on any surface traces to a governed handle" is unreachable not because of a missing table, but because the two planes have no referential edge (I-2 is the same wound seen from the lineage side).

### I-4 · The catalog has no lifecycle-as-data
The cube has SCD-2 vintages (V25 release), SCD-2 reference metadata (V31), an immutable ledger (V15). **The semantic model that governs every number has none of it:** no version, no `draft/certified/deprecated` certification state, no as-of, no record of *who changed a metric's definition or when*. A metric's `calc` or default-dims can change under a live published page, silently rebasing every KPI that binds it, and leave no trace in storage — `page_version` snapshots the *layout*, not the *metric semantics* it bound. AR-50 M5/lifecycle designs exactly this (`draft/certified/deprecated`) and is **PENDING**. Until it lands, the platform certifies its *facts* and leaves its *definitions* uncertified — inverted for a statistics platform, where the definition is the more dangerous thing to get wrong.

### I-5 · `audit_log` does not see catalog mutations as objects
`config.audit_log` (V15) is a genuine append-only, DB-enforced-immutable ledger — excellent. But it records route verbs (`config.save`, `config.publish`, `ingest.publish`) with an opaque JSONB payload; **a catalog edit that silently rebased every KPI on the site is, at best, one indistinguishable `config.save` blob.** There is no object-level history for a metric, and no distinct `catalog.metric.update` action carrying before/after. The audit answers "who saved *something*", not "who changed *this metric's meaning*".

### I-6 · The published pixel is a lineage island
`config.snapshot` (V36) durably stores a minted embed's rendered `PageDataSnapshot` — but **opaquely, with no `release_id` / vintage stamp** (the `tenant_id` forward-add was foreseen; a vintage back-edge was not). A partner's embedded number is therefore both **un-traceable** to the source release and **un-invalidatable** when that release is superseded. This is the furthest-downstream expression of I-3: the very last mile of the spine — the published pixel handed to an external consumer — carries no back-edge to the number's origin.

### I-7 · Agnostic ingestion is honest-future, not honest-now — and the risk is a bypass, not a fork
Two provenance identities already coexist correctly (`content_hash` = payload idempotency key; `source_digest` = source-file lineage key, V32) — disciplined. But `provenance` JSONB is nullable and stamped **only on the xlsx path**; JSON ingest routes carry none. ADR-040 (agnostic port + self-declaring adapters) is **PROPOSED**, the adapter registry unbuilt — the pipeline is still xlsx-shaped. So "any format onboards agnostically" is an honest *aspiration*, not a current property. Crucially, it is **ONE pipeline by design, not a fork** — AR-51's front-plane upload reuses the canonical FSM (ADR-040: "COMMIT through the existing canonical FSM"). That is the right call. **The unnamed liability is the seam:** the front-plane surface is the place where a "make upload simpler" pressure could bolt a second entry that skips the silver→gold `validate` gate. Watch that boundary; it is where the medallion discipline would quietly leak.

---

## 3. The maximal data-plane concept — one lineage-closed, governed-model-as-data plane

Benchmark fusion (what an Eurostat / ONS / ECB data-platform architect would build here):

- **The semantic catalog becomes a first-class relational, versioned, certified, FK-integral citizen** — modeled on the **SDMX Metadata Structure Definition (MSD)** × **dbt/LookML metadata store** × **Looker model versioning**. `stats.metric` / `stats.metric_dimension` with a certification FSM (`draft → certified → deprecated`), version/as-of columns, and a real FK edge to the cube's DSD. Not a `site_config` blob. This is the natural completion of the same SDMX rigor already applied to `dimension`, `dataset`, `release`, `reference_metadata`.
- **Lineage is materialized and CLOSED end-to-end** — modeled on **OpenLineage** (run/job/dataset facets) × **W3C PROV-O**, kept *derivable* per V32's SSOT discipline but exposed as a queryable `stats.lineage` view that **crosses the config↔stats boundary** to the published page and the embed snapshot. `config.snapshot` and each page's bound refs carry the `release_id` they rendered from. "Trace every number to its source workbook, parser, ruleset, release, and the page it appears on" becomes a single SELECT — statistics-grade OpenLineage.
- **The config↔stats seam gains referential integrity** — a validation edge (deferred FK once the catalog is relational, or a reference-registry table + write-time guard + periodic integrity sweep before then), so a published page structurally *cannot* point at a retired cube. The greatest data-plane **asset** — the DSD-validated, vintaged, provenance-carrying cube — finally extends its integrity contract across the schema boundary that currently voids it.

The result is a hybrid no single reference platform ships: SDMX-native governance and vintaging (beyond dbt/Looker) **fused with** a lineage graph that reaches the published pixel (beyond most national-statistics platforms, which stop at the cube).

---

## 4. POWER MOVES — ranked by leverage (honest on cost / YAGNI / one-way risk)

### PM-1 · Write-time catalog validation guard — *highest ROI, low cost, TWO-WAY*
Add a server-side validator to `PUT /api/config/site` for the `metrics` / `dimensions` keys: each `metric.code ∈` live DSD/classifier for its `dataSource`; reject on miss (the **runtime twin** of the build-time `config-cube-contract` test, behind an `ENFORCE_CATALOG_*` flag mirroring the existing `ENFORCE_CONFIG_*` posture). **Pure app-layer, no migration, fully reversible.** Closes I-1 at the exact write boundary and makes "blob-now" *safe* without paying for "relational-now" yet. This is the single highest-leverage move in the study — it is already a flagged AR-49 M2 follow-up; it should be treated as a correctness gate, not an enhancement.

### PM-2 · Promote the catalog: `site_config` blob → relational tables — *high leverage, real cost, EXPAND-CONTRACT (staged-reversible), ONE-WAY door*
Model `stats.metric` / `stats.metric_dimension` + certification/version columns; keep the blob as a **projected read-model** during expand; dual-write; migrate reads; retire the `metrics`/`dimensions` `site_config` key **last** (contract). Unlocks FK integrity (I-2), lifecycle-as-data (I-4), and per-object history (I-5) in one structural move. This is the one-way door the owner already flagged (AR-49: *blob-now vs relational-later*). **Recommendation:** design the schema now; **gate the migration on the first real governance need** (first multi-page impact query, first certification requirement, or the first steward-catalog integrity incident) — YAGNI-honest, because PM-1 buys the safety cheaply and immediately. When it runs, expand-contract only — never a big-bang blob drop.

### PM-3 · The lineage READ spine, closed to the pixel — *high strategic value, moderate cost, TWO-WAY*
Materialize `stats.lineage` (bronze → submission → release → observation_revision), and close the two open edges: stamp `config.snapshot.release_set` (the vintage[s] its rendered numbers came from) and record bound-ref → dataset/release resolution at publish. Turns Canon C1 from an aspiration into a query. Additive and reversible; a JSONB-ref-scan version ships **without** waiting for PM-2, and cleans up once PM-2 provides the referential edge.

### PM-4 · Referential integrity SWEEP over the config↔stats void — *guard-rail, low cost, TWO-WAY*
Until PM-2 lands, extend the build-time `config-cube-contract` test to a **live-corpus fitness + periodic job** that flags any page / `data_spec` / catalog ref whose dataset / classifier / measure no longer exists in the cube. Cheap backstop for I-2 that does not wait for the relational migration. Pairs naturally with PM-1 (same validation logic, read side).

### PM-5 · Catalog mutations as first-class audit events — *targeted, low cost, TWO-WAY*
Emit a distinct `catalog.metric.update` (before/after payload) into `config.audit_log`, and warn/gate on measure-semantics drift under a *published* page. Closes I-5's blind spot cheaply, ahead of the fuller history that PM-2 delivers.

**Suggested sequence:** PM-1 + PM-4 immediately (safety, no migration) → PM-5 (audit visibility) → PM-3 (lineage read) → PM-2 (relational catalog, when a governance need bites). The spine's two paper spans are load-bearing the moment PM-1+PM-4 land; PM-2 makes them steel.

---

## 5. What to REFUSE (senior conviction)

1. **Refuse a second ingestion entry that skips the canonical FSM** to make front-plane upload "simpler" (the I-7 seam). One pipeline, one silver→gold `validate` gate. The front surface is a new *adapter + review step*, never a new pipe. This is the medallion architecture's whole point.
2. **Refuse a parallel provenance / lineage store.** V32's "derivable PROV, SSOT on the causing event" is correct and must hold — materialize lineage as a **VIEW**, never a side table that can drift from the events it summarizes.
3. **Refuse making the catalog "easier" by dropping the steward/author governance lens or loosening dimension-pinning** (the `config-cube-contract` raison d'être). Governance *is* the product's unclaimed quadrant. The cure for I-1 is a write-time guard (PM-1), not a removed check.
4. **Refuse a big-bang destructive catalog migration** (PM-2). Expand-contract only; the blob stays as a projected read-model until every reader has moved. The catalog is referenced by every page — a destructive cutover is an un-rollback-able, Class-M, blast-everything move.
5. **Refuse inventing history you don't have.** V25 already got this right (genesis vintages are *flagged, not manufactured* from timestamps). Apply the same honesty to any catalog-lifecycle backfill: no fabricated certification dates, no invented "who authored this metric" — an unknown is recorded as unknown.

---

### Appendix — primary evidence read
- Schema: `ops/postgres/migrations/` V2 (schemas), V3 (config tables), V4 (stats cube + validation trigger), V11 (medallion staging), V15 (audit_log), V25 (release/vintage), V31 (reference metadata), V32 (submission provenance), V36 (snapshot store).
- App seam: `platform/apps/api/src/routes/config/site.ts` (the unvalidated catalog write), `.../config/pages.ts` (the validated page write, the contrast), `platform/apps/api/src/provisioning/config-cube-contract.fitness.test.ts` (build-time-only cube contract), `platform/apps/api/src/ingest/*`.
- Canon / registry: `docs/architecture/proposals/STUDY-authoring-canon-circle-break.md` (C1–C4), `ARCHITECTURE-REGISTRY.md` AR-49 / AR-50 / AR-51 rows, `ADR-040`, `ADR-0025`, `ADR-0031` (PROV), `ADR-035`.
- Cross-schema FK census: grep `REFERENCES stats.` — confirms **zero** `config.*→stats.*` edges.
</content>
</invoke>
