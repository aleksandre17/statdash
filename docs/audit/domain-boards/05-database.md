# Board 05 — Database / SDMX Data-Model / Cube / Migrations

> Senior data-architect deep analysis. Scope: `ops/postgres/migrations` (Flyway **V1→V35**, V35 just-staged), the three live schemas `config` / `stats` / `stats_stage` on `timescale/timescaledb-ha:pg16`, the SDMX cube, and the divergent aspirational target in `docs/architecture/future/01-database/*`.
> **Truth source = SQL.** Every card verified against the migration body, not the docs. Analysis only — no schema changed.
> Reference platforms used: SDMX Information Model (ISO 17369) / SDMX-CSV · .Stat Suite (OECD/SIS-CC) · OLAP cubes / MDX · Cube semantic layer · dbt · TimescaleDB patterns.

---

## Orientation — what exists vs. what was designed

Two database designs exist in this repo and **they diverge**:

| | Designed (`future/01-database/*`) | **Built** (`ops/postgres/migrations` V1–V35) |
|---|---|---|
| Schemas | `obs` · `cms` · `meta` · `iam` (4) | `config` · `stats` · `stats_stage` (3) |
| Fact storage | native `PARTITION BY LIST(dataset)→RANGE(time)` | **TimescaleDB hypertable** on `time_period_date`, 3-mo chunks + compression |
| Dimensions | 6 physical FK cols + `extra_dims` JSONB | **fully generic** `dim_key` JSONB (stronger Law-1 purity) |
| IAM | OIDC-federated `iam.app_user`, per-tenant roles, `site_id` FKs everywhere | `config.user` (local scrypt), `roles[]` array, **no tenant column** |
| Tenancy | `cms.site` = tenant root, RLS + composite FKs | **single-tenant**; one placeholder `stats.dataset.tenant_id` + permissive RLS |

The **built** model is the SSOT. The `future/` docs are partly stale aspiration (they predate the Flyway era — see `overview.md` "No Flyway migration files yet"). They remain useful as the *intended* multi-tenant/IAM target and are cited as foresight, not as current state.

The migration corpus is, on craft, **reference-grade**: every Class-M migration carries an inline `09 §B` risk gate (reversibility / blast radius / hypertable impact / rollback script), expand-contract is used by name (V6→V18 classifier unlock; V18→V27 concept_role promotion; V23→V24 code_path), Flyway-immutability is honored to the letter (V34 explicitly refuses to edit V5/V7 and forward-adds instead). This board is therefore mostly about **model completeness and the tenancy frontier**, not hygiene.

---

### [DB-01] SDMX Information-Model coverage matrix
- **Status**: 🟡PARTIAL
- **Evidence**: ConceptScheme `V27`; Codelist=`stats.classifier` `V4`; CategoryScheme `V29`; DSD=`stats.dataset_dimension` `V4`; ContentConstraint `V26`; Reference Metadata `V31`; Dataflow≈`stats.dataset` `V4`.
- **What & why**: The platform has adopted the SDMX maintainable-artefact idiom (`code + agency + version`) consistently across V27/V29/V31. Coverage by artefact:
  - ✅ **ConceptScheme/Concept** (V27) · ✅ **Codelist** (classifier, LTREE, SCD-2) · ✅ **CategoryScheme + Categorisation** (V29) · ✅ **ContentConstraint/CubeRegion** (V26) · ✅ **Reference Metadata / ESMS-lite** (V31) · ✅ **Dataflow + DSD** (collapsed, see DB-05) · ✅ **Concept Role** (V18→V27).
  - ⛔ **AgencyScheme** — `agency` is a free `TEXT` column on 4 tables, not a maintainable artefact (DB-08).
  - ⛔ **MetadataStructureDefinition (MSD) / full ESMS tree / ESQRS quality** — deferred behind the `metadataflow_code` seam (V31 documents the door).
  - ⛔ **Hierarchical Codelist** (cross-codelist hierarchy distinct from same-dim `parent_code`), **Provision Agreement**, **Structure/Registry REST endpoints**, **HierarchicalCodelist** — not modeled (largely YAGNI today).
- **Critical analysis**: This is the **deepest open-source SDMX data model I have seen embedded in an application cube** — most BI tools model none of it. The honest gap is that the model stores SDMX structure but cannot yet *serialize* it: there is no `/structure` SDMX-ML/SDMX-JSON endpoint, so the artefacts are inputs to internal validation, not yet interoperable outputs. That is the difference between "SDMX-shaped" and "SDMX-compliant".
- **Reference platforms**: **.Stat Suite** models the full IM incl. AgencyScheme, MSD, Provision Agreement and exposes SDMX REST `/structure` + `/data`. **SDMX-CSV** is a serialization we cannot yet emit. **We beat** .Stat Suite on Law-1 purity (fully generic `dim_key`, no privileged geo/indicator columns) and on per-migration risk discipline; **they beat us** on artefact completeness + wire serialization.
- **Foresight (1–2 yr)**: An `/sdmx/v2/structure` + `/data` (SDMX-CSV) read API turns this from an internal model into a node other NSIs can harvest — the strategic unlock for a "tenant-agnostic statistical platform".
- **Plan**: (1) AgencyScheme (DB-08, S); (2) MSD/ESMS escalation behind V31 seam (M, deferred until a metadata panel consumer); (3) SDMX-CSV `/data` serializer as a `STABLE` SQL function over `stats.observation ⋈ classifier` (M). All ONE-WAY only where they add tables; serializers are read-only (two-way). Priority **P2** (after tenancy).
- **Raises-the-bar**: the model becoming *emittable* is what crosses from "great internal cube" to "SDMX node".

---

### [DB-02] ConceptScheme / Concept — identity vs representation
- **Status**: ✅DONE
- **Evidence**: `V27__concept_scheme.sql` — `stats.concept_scheme`, `stats.concept` (`concept_role` moved here from V18 as SSOT, `core_representation_codelist`, `parent_code` chain), `stats.dimension += (concept_scheme_code, concept_code)` nullable composite FK; backfill + no-drift RAISE gate (lines 298-314).
- **What & why**: Separates *what a column means* (Concept) from *how its values are coded* (Codelist) — the SDMX separation that lets two dimensions (partner/reporter) share `REF_AREA`. Executed as a textbook **expand-contract**: V18 put `concept_role` on `dimension` (expand), V27 promotes it to `concept` + keeps the dimension column as a read alias (no dual-write trigger), a future V-contract drops it.
- **Critical analysis**: Excellent. The one open seam: the **contract step is still pending** — `dimension.concept_role` lives in parallel with `concept.concept_role`, guarded only by a fitness function and the in-migration no-drift check. Parallel-change windows that stay open indefinitely become permanent duplication (Lehman rot). There is no scheduled V-migration to close it. Also `concept.parent_code` is deliberately *not* a self-FK (documented Occam choice) — acceptable for a few shallow concepts, but it means concept-nesting integrity is app/fitness-enforced, not DB-enforced.
- **Reference platforms**: **SDMX IM** ConceptScheme/Concept — modeled faithfully. **Cube semantic layer** "dimensions reference a shared concept" — same idea, we encode it relationally. **We beat** typical OLAP (which has no concept/representation split) on semantic precision.
- **Foresight**: When a second agency's `REF_AREA` appears (multi-tenant), the scheme namespace already distinguishes them — the model is tenant-ready *here* even though the cube is not (DB-16).
- **Plan**: schedule the **contract migration** (drop `dimension.concept_role`, re-point cube-profile to read through the concept) once every consumer reads via concept. Two-way until the column drop (then one-way). Effort S. Priority **P2**.
- **Raises-the-bar**: close expand-contract windows on a clock, not "eventually".

---

### [DB-03] Codelist / Classifier — LTREE hierarchy + same-dim parent model
- **Status**: ✅DONE
- **Evidence**: `V4` (`stats.classifier`, surrogate id, `path LTREE`, GIST index, `refresh_classifier_path` trigger); `V18` Part B acyclicity guard; `V23/V24` `parent_code` expand/contract; `project_classifier_parent_model` (verified).
- **What & why**: SDMX Codelist with materialized-path hierarchy traversal in O(log n). `parent_code` is a **same-dim business-key edge** (not a FK — post-SCD-2 `(dim_code,code)` is non-unique); cross-dim grouping (a measure's `approach`) is an SDMX *attribute* in `metadata`, never a parent. Geo/sector keep genuine hierarchies; measures are flat.
- **Critical analysis**: The surrogate-id + LTREE choice is correct and beats a closure table for read-heavy ancestor queries. Two subtleties: (1) **SCD-2 + LTREE interaction** — a code revision mints a *new surrogate id*, so `classifier_display` (keyed on `member_id`) and any `parent_id` pointing at the old row must be re-pointed at publish; the path trigger handles materialization but the *display re-point* is an ETL responsibility with no DB guard. (2) `idx_classifier_label_trgm` indexes `label->>'ka' || ' ' || label->>'en'` — hardcodes two locales into an index expression; a third active locale is invisible to fuzzy search until the index is rebuilt (minor Law-1 erosion in an index).
- **Reference platforms**: **SDMX Hierarchical Codelist** — we model same-dim hierarchy but not cross-codelist hierarchy. **.Stat Suite** stores codelists relationally without LTREE; **we beat** them on traversal performance. **dbt** has no hierarchy primitive.
- **Foresight**: a true SDMX HierarchicalCodelist (a hierarchy that spans codelists, e.g. NUTS over multiple geo lists) will eventually be needed for cross-dataset geo rollups.
- **Plan**: add a `stats.classifier_display` re-point assertion at publish (fitness); consider a locale-generic trgm index strategy (per-locale partial indexes). Effort S, two-way. Priority **P3**.
- **Raises-the-bar**: no hardcoded locale in an index expression.

---

### [DB-04] CategoryScheme / Categorisation — browsable theme taxonomy
- **Status**: ✅DONE
- **Evidence**: `V29__category_scheme.sql` — `stats.category_scheme`, `stats.category` (LTREE `category_path`, reuses V23 `code_to_ltree_label`, acyclicity guard), `stats.categorisation` (Dataflow→Category M:N, FK to `stats.dataset`); catalog projection joins `dataset_published` (V28).
- **What & why**: Agency-level subject taxonomy ("National Accounts > GDP > Annual") distinct from `config.nav_item` (a *site's* menu) and from cube dimensions. Powers the Constructor dataset palette + bootstrap nav.
- **Critical analysis**: Correctly refuses two tempting collapses (reuse `nav_item`; categories-as-classifier-rows) — both flagged as first-tenant erosion. Clean reuse of the V23 hierarchy machinery. The M:N `categorisation` is the right shape. Minor: `categorisation.dataset_code` FKs to `stats.dataset` (existence) but the published-only filter is a *projection* (catalog route joins `dataset_published`), so a stale categorisation row can dangle at a superseded dataset — by design, asserted by fitness, not DB.
- **Reference platforms**: **SDMX CategoryScheme/Categorisation** — modeled whole (Law 4). **.Stat Suite** data-explorer "themes" = exactly this. **We beat** generic BI (Metabase collections are presentation, not a semantic agency taxonomy).
- **Foresight**: in multi-tenant, a CategoryScheme is cross-site agency metadata — it must NOT be tenant-scoped the way nav is. The current non-tenanted model is actually *correct* for this artefact.
- **Plan**: none required. Optionally generate `nav_item` *from* a scheme (one-way data transform). Priority **P4**.
- **Raises-the-bar**: distinct SSOTs for semantic-taxonomy vs presentation-menu — already achieved.

---

### [DB-05] DSD + Dataflow — collapsed into `stats.dataset`
- **Status**: 🟡PARTIAL
- **Evidence**: `V4` — `stats.dataset` (Dataflow header: label/frequency/source) + `stats.dataset_dimension` (the DSD: which dims key the series, `is_time_dim`, `ord`); `V34` realigns GDP DSD to 4-dim `[measure,approach,time,geo]`.
- **What & why**: A dataset is its own structure — `dataset` is the Dataflow and `dataset_dimension` is the DSD, 1:1. The validation trigger reads `dataset_dimension` as the key contract.
- **Critical analysis**: SDMX separates **Dataflow** (a published flow) from **DataStructureDefinition** (a reusable key structure that *many* dataflows can reference). Here they are fused: two datasets that share an identical key structure must each re-declare every `dataset_dimension` row — no shared DSD artefact, no `dsd_id` reference. For the current corpus (a handful of datasets) this is correct Occam; at scale it becomes duplication (the GDP/TRADE/ACCOUNTS structures partly overlap). The `future/obs-schema.md` *did* model a separate `obs.dsd` + `obs.dsd_component` with a `dsd_id` FK from dataset — the built model dropped that normalization. Also note: there is **no DSD versioning** — a DSD change (V34's +approach widen) is an in-place `dataset_dimension` mutation guarded by a fail-fast count of legacy facts, not a new DSD version. The maintainable-artefact `version` discipline applied to concept/category schemes is *absent* from the DSD itself.
- **Reference platforms**: **SDMX IM** — DSD is a first-class reusable artefact referenced by N Dataflows; we lost that. **.Stat Suite** shares DSDs across dataflows. **OLAP/MDX** has shared dimensions across cubes — analogous. **We beat** them only on the validation trigger tightness.
- **Foresight**: a shared `stats.dsd` + `dsd_id` on dataset becomes worth it when ≥2 datasets demonstrably share a key structure (the second real caller — not yet). Multi-tenant raises this: two tenants publishing "GDP" want the *same* DSD, different data.
- **Plan**: when the second caller is real, extract `stats.dsd(code,agency,version)` + `dsd_component`, add nullable `dataset.dsd_id`, migrate `dataset_dimension` → components via expand-contract (keep `dataset_dimension` as a view). ONE-WAY (new tables), Class-M, effort M. Priority **P3** (YAGNI-gated).
- **Raises-the-bar**: version the DSD as rigorously as the concept scheme.

---

### [DB-06] ContentConstraint / CubeRegion — legal combinations
- **Status**: ✅DONE
- **Evidence**: `V26__content_constraint.sql` — predicate-row model (`content_constraint` header + `content_constraint_member` rows), `dim_key_in_allowed_region(TEXT,JSONB)` SSOT predicate, `cube_actual_region` derived view; `project_content_constraint_model` (verified).
- **What & why**: V4 validates each dim_key value in isolation; V26 models which *combinations* are legal (the SNA case: account `B9` only on side `U`). Predicate rows (not enumerated tuples) — unconditional allowed-sets + AND-conjoined conditional rules. `allowed` = authored table; `actual` = derived view (cannot drift). Enforced in **silver** (`region.ts` twin), not a hot-path trigger.
- **Critical analysis**: This is the strongest piece of the model — the predicate-row design avoids combinatorial blow-up *and* expresses cross-dim dependency, with the DB function and the in-memory TS check as deliberate twins asserted equal by a fitness test. Two honest edges: (1) **AND-only conjunction** — true OR multi-condition rules need the documented `rule_group_id` escalation (YAGNI, fine). (2) Enforcement is silver-only: a *direct* gold write (bypassing the submission pipeline — e.g. the R__ seed, a future bulk path) is **not** region-checked. The migration documents this as the escalation door (opt-in gold trigger reusing the same function) but it is a real latent hole if a second writer appears.
- **Reference platforms**: **SDMX ContentConstraint/CubeRegion** — modeled whole incl. actual-vs-allowed. **OLAP** "ragged/sparse cube" — we model sparsity explicitly (has-data / empty-by-design / missing). **We beat** every general BI tool (none model legal-region as data).
- **Foresight**: `cube_actual_region` as a plain `GROUP BY` view will get expensive as the cube grows — promote to a continuous aggregate (DB-17).
- **Plan**: keep AND-only until a real OR rule; add the opt-in gold trigger **iff** a non-silver writer lands. Two-way. Priority **P3** (event-gated).
- **Raises-the-bar**: the DB-function ⇄ TS-twin fitness lock is a pattern worth promoting platform-wide.

---

### [DB-07] Reference Metadata — ESMS-lite, SCD-2
- **Status**: ✅DONE
- **Evidence**: `V31__reference_metadata.sql` — `stats.metadataflow` (ESMS_LITE seed) + `stats.reference_metadata` (SCD-2, target-polymorphic dataset/dimension/classifier, i18n optional-LocaleString columns, `config.enforce_locale_string_optional` guard); `project_v31_reference_metadata` (verified).
- **What & why**: Structured, i18n, versioned home for the Law-9 provenance badges (methodology / source / last-updated / quality) — exactly the engine's `ProvenanceRecord` fields. SCD-2 so the "last updated" vintage chain survives. Target polymorphism keeps Law 1 (generic FK to `stats.dimension`).
- **Critical analysis**: Very strong — folds into the existing badge story rather than inventing a parallel metadata system, and the optional-LocaleString trigger (omit a field, but a *present* field must be locale-complete) is a precise reading of the i18n contract. The deferred door (full ESMS ~21-concept tree + ESQRS quality as predicate rows behind `metadataflow_code`) is honestly YAGNI'd. One gap: the **current-uniqueness partial index exists only for the `dataset` target** (`uq_reference_metadata_current_dataset`); dimension/classifier targets have no "exactly one current" guard yet (documented as built-when-the-door-opens). If a dimension report is authored before that index exists, two current rows are representable.
- **Reference platforms**: **SDMX ESMS / SIMS / ESQRS** — the pragmatic typed-column slice. **.Stat Suite** has a full reference-metadata subsystem; **they beat** us on completeness, **we beat** them on SCD-2 last-updated rigor + i18n completeness enforcement.
- **Foresight**: when a metadata *panel* (not just a badge) ships, the full ESMS predicate-row engine slots behind the existing flow seam additively.
- **Plan**: add the dimension/classifier partial-unique indexes *with* the door (not before authoring). Two-way. Priority **P3**.
- **Raises-the-bar**: provenance as a versioned first-class artefact, not free-text metadata.

---

### [DB-08] AgencyScheme — NOT modeled
- **Status**: ⛔NOT-DONE
- **Evidence**: `agency TEXT NOT NULL DEFAULT 'SDMX'` repeated on `stats.concept_scheme` (V27), `stats.metadataflow` (V31), `stats.category_scheme` (V29), and `stats.dataset.source` (V4) — no `stats.agency` / `agency_scheme` table.
- **What & why**: SDMX maintainable artefacts are identified by `(maintainableParentId, agencyID, version)`. The agency itself is a maintainable artefact in an **AgencyScheme** (`SDMX:AGENCIES`). Here it is a denormalized free string with no SSOT — `'SDMX'` vs `'ESTAT'` vs `'GEOSTAT'` are typo-able, un-joinable, and carry no contact/name metadata.
- **Critical analysis**: Low-harm today (one real agency) but it is the one SDMX artefact the model *names everywhere and stores nowhere* — a normalization debt. It becomes load-bearing the instant a second agency/tenant appears: per-tenant artefact ownership ("Geostat owns CL_GEO; ENStat owns its own") needs an agency SSOT to scope on. This is the **quiet prerequisite for DB-16 (multi-tenant)**.
- **Reference platforms**: **SDMX AgencyScheme** — a hard miss. **.Stat Suite** treats agency as a first-class owner. **dbt** `meta.owner` is the loose analogue.
- **Foresight (1–2 yr)**: in multi-tenant, **agency ≈ tenant** for structural artefacts. Modeling AgencyScheme now is the cheapest on-ramp to tenant-scoped structure ownership.
- **Plan**: `stats.agency_scheme` + `stats.agency(id, name i18n, contact, parent)`; re-point the four `agency` columns to FK (expand-contract: add nullable `agency_id`, backfill from the string, keep string as alias, contract later). ONE-WAY (new tables), Class-M, effort S–M. Priority **P2** (pairs with tenancy).
- **Raises-the-bar**: every artefact the model references must have an SSOT home.

---

### [DB-09] Observation hypertable — dim_key validation + writer-provided partition
- **Status**: ✅DONE
- **Evidence**: `V4` `stats.observation` (TimescaleDB hypertable on `time_period_date`, generic `dim_key` JSONB, `dim_key_hash` GENERATED STORED, validation trigger); `V22` tightens validation to `is_current` members; `project_db_state` (partition-column rule verified).
- **What & why**: Fully generic SDMX observation (Law 1 — `dim_key` JSONB, a new dimension is data not DDL). The partition column `time_period_date` is **writer-provided** via `stats.parse_time_period()` because TimescaleDB forbids a GENERATED column as the partition dim *and* enforces the partition NOT-NULL check before BEFORE-row triggers fire — both failure modes proven live and documented exhaustively. A fitness test forbids any `INSERT` that omits the column.
- **Critical analysis**: The partition-column saga is handled with rare rigor (two failed mechanisms documented, SSOT preserved in the parser, fitness-locked). Honest risks: (1) **`dim_key_hash = md5(dim_key::text)`** — md5 is fine for dedup but the model leans on it as the uniqueness + compress-segmentby key; a SHA-256 would be future-proof if hash identity ever becomes security-relevant (it is not today). (2) The set-equality validation trigger does a **per-row, per-value `EXISTS` against `stats.classifier`** — on the hot insert path that is N classifier lookups per observation; the silver pipeline already validates in memory, so the gold trigger is belt-and-braces but is the most expensive thing on the write path. For bulk loads (the R__ seed, ~2131 rows) it is acceptable; for a future high-throughput stream it is the bottleneck to watch. (3) `obs_value NUMERIC` unbounded precision — fine, but the `future` doc used `NUMERIC(20,6)`; unbounded is the safer SDMX choice.
- **Reference platforms**: **TimescaleDB patterns** — hypertable + compression + chunk interval correctly applied. **OLAP fact table** — `dim_key` JSONB is a degenerate-dimension-free design; **we beat** the `future/obs-schema.md` 6-physical-col design on Law-1 purity. **SDMX-CSV** maps 1:1 to a row here.
- **Foresight**: streaming ingestion (the platform gap analysis N34 async story) will pressure the per-row validation trigger.
- **Plan**: keep md5 (document the decision); if a high-throughput writer lands, make the gold validation trigger skippable under a trusted-silver GUC (the pipeline already validated). Two-way. Priority **P3**.
- **Raises-the-bar**: writer-provided partition + fitness lock is the canonical pattern for "TimescaleDB won't let you generate the partition key".

---

### [DB-10] Dataset lifecycle FSM — artefact status, orthogonal to vintage
- **Status**: ✅DONE
- **Evidence**: `V28__dataset_lifecycle.sql` — `dataset += status/valid_from/valid_to/replaced_by`, `dataset_superseded_chk` (illegal state unrepresentable), `set_dataset_status()` FSM, `stats.dataset_published` projection view; backfill promotes pre-V28 datasets to `published`.
- **What & why**: The maintainable-artefact lifecycle (draft→published→deprecated→superseded) — explicitly **orthogonal** to `release.status` (data vintage, V25) and `dataset_version` (ETag, V6). Lifecycle is a *projection filter* (the view), never a data operation — supersession deletes no facts (auditability / permalinks).
- **Critical analysis**: The three-way orthogonality (artefact status / data vintage / cache ETag, SSOT each, explicitly not merged) is exactly right and is the kind of distinction most systems get wrong by conflating "published" into one flag. The FSM is enforced in the type system (`dataset_superseded_chk`) plus a clearer-message function. One subtlety well-handled: the `replaced_by` self-FK `ON DELETE SET NULL` would create an illegal `superseded`-with-null-`replaced_by` state, but the CHECK fires on that very UPDATE and correctly *rejects* deleting a still-referenced successor — documented, not surprising.
- **Reference platforms**: **SDMX maintainable-artefact** validFrom/validTo + version chain — modeled whole. **.Stat Suite** dataflow lifecycle. **We beat** generic BI (Grafana/Metabase have dashboard "states" but no artefact-versioning chain).
- **Foresight**: multi-version-concurrent datasets (two live versions served simultaneously) would need the rejected `dataset_version` history table — YAGNI until real.
- **Plan**: none. Priority **P4**.
- **Raises-the-bar**: three orthogonal "published" concepts, never merged.

---

### [DB-11] Release / vintage + revision log — as-of reconstruction
- **Status**: ✅DONE
- **Evidence**: `V25__release_vintage.sql` (`stats.release` publication-event aggregate, GUC-stamped `observation.release_id`, extended V8 capture trigger, genesis backfill, `publish_release`/`open_release`); `V8` `observation_revision` append-only log.
- **What & why**: Models the **publication event** as a first-class aggregate so the cube can answer "GDP as published on date D" (vintage reconstruction) and revision triangles. Pre-images carry both `set_by_release_id` and `superseded_by_release_id` → each is a closed validity interval keyed by release. Release stamping is GUC-driven (`SET LOCAL app.release_id`), mirroring `app.revised_by` / `app.dry_run`.
- **Critical analysis**: This is event-sourcing-lite done correctly — the current value stays SSOT on `observation`, the pre-image log is the immutable trail, and the GUC pattern keeps the hot path free of release coupling (Postel: writers that don't opt in pay nothing). The trigger firing-order management (`_aa_release_stamp` sorts first alphabetically) is meticulous. Honest risks: (1) **`observation_revision` is a plain table, not a hypertable, and grows unbounded** — every value change appends forever with no retention/archival policy; on a frequently-revised cube this is the table that will quietly dominate storage. (2) `release_id` is **not FK-enforced** to `stats.release` (deliberate hot-path decision) — referential integrity of the vintage key is app-maintained; a bad GUC cast is the only guard. (3) Genesis backfill manufactures one synthetic release per dataset with `published_at = min(updated_at)` — honest (flagged in metadata) but it means pre-V25 revision triangles are partly fictional.
- **Reference platforms**: **SDMX/ECB release** + **bitemporal** vintage tables (the central-bank revision-database pattern) — faithfully modeled. **dbt snapshots** (SCD-2) are the loose analogue; **we beat** them with release-keyed validity intervals (true vintage, not just valid-time).
- **Foresight**: a revision-heavy multi-tenant cube needs a retention/compression policy on `observation_revision`.
- **Plan**: add a retention strategy (TimescaleDB-style archival or a `revision` compaction) before the log dominates; optionally validate `release_id` via a periodic fitness check. Two-way. Priority **P2** (storage-driven).
- **Raises-the-bar**: bitemporal vintage keyed by a publication aggregate, not a timestamp.

---

### [DB-12] Submission pipeline (Medallion) + W3C PROV lineage
- **Status**: ✅DONE
- **Evidence**: `V11__ingest_staging.sql` (`stats_stage` schema: `submission` FSM, bronze `submission_blob`, silver `obs/classifier/display_staging`, `validation_issue`); `V32__submission_provenance.sql` (`source_digest` + `provenance` JSONB).
- **What & why**: Bronze→silver→gold Medallion as a Pipe-and-Filter pipeline in its own schema. Gold is never touched until `status=publishing`. Bronze is immutable (re-submission = new blob, `content_hash` = idempotency key — Idempotent Receiver). V32 adds the source-file digest + transform identity so the **W3C PROV graph** (Entity=obs/dataset · Activity=submission/release · Agent=curator) is *derivable*, not a parallel store.
- **Critical analysis**: Architecturally clean — silver is deliberately permissive (Postel), validation annotates rather than rejects, FKs point only *into* `stats_stage` (no silver→gold FK, correct because gold's hypertable can't be an FK target and silver must accept not-yet-existing codes). The PROV-derivable decision (two nullable columns, no provenance table) is the right Occam call. Gap: **no retention/purge policy on bronze blobs** — `raw_content TEXT` stores every uploaded workbook verbatim forever; on a busy multi-tenant ingest this is the second unbounded-growth table (with DB-11). Also `content_hash` is app-computed (not a generated column, justified by blob size) — so idempotency depends on the uploader path computing it correctly; a fitness check would harden it.
- **Reference platforms**: **Medallion (Databricks)** bronze/silver/gold — modeled by name. **dbt** staging→marts is the analogue; **we beat** dbt with an immutable bronze provenance trail + FSM. **OpenLineage / W3C PROV** — derivable, the deferred serializer is the door.
- **Foresight**: an OpenLineage/PROV-O export reading V32 columns turns ingestion auditable for a regulator — the multi-tenant trust story.
- **Plan**: bronze retention policy (archive/purge published blobs after N days); PROV-O serializer when an audit consumer asks. Two-way. Priority **P2** (storage) / **P3** (serializer).
- **Raises-the-bar**: provenance derivable from the event spine, never duplicated.

---

### [DB-13] Unit / measure model — Decision C
- **Status**: ✅DONE
- **Evidence**: `V16` `stats.unit_measure` codelist; `V20` `classifier_unit`; `V21` `measure_unit_resolved` view; `project_decision_c_unit_measure` + `project_dsd_completeness` (verified — `metadata.unit_measure` validated against V16 set, GDP_DEFLATOR closed the gap).
- **What & why**: `UNIT_MEASURE` resolves at the **measure-classifier level** (measure metadata → dataset default → NULL) via `stats.measure_unit_resolved`, with a V20 fail-fast backfill that confirms the V16 seed covers every legacy unit code before applying.
- **Critical analysis**: Correct SDMX modeling — unit is an attribute carried at the measure level, not a privileged column, resolved through a view (SSOT). The fail-fast backfill (refuse to apply if any legacy code is uncovered) is exemplary migration hygiene. The unit set is a closed CHECK-style codelist (`GEL/USD/EUR/.../PERCENT/INDEX/PERSON`) — a new unit is a seed INSERT, fine. Minor: unit lives in `metadata.unit_measure` JSONB on the classifier, so it is not FK-validated against `unit_measure` at write time — the fitness test enforces it offline instead.
- **Reference platforms**: **SDMX UNIT_MEASURE / UNIT_MULT** attributes — modeled. **OLAP** "unit as a measure property" — analogous. **We beat** systems that treat unit as a display string.
- **Foresight**: `UNIT_MULT` (scale: thousands/millions) is in the `future/obs-schema.md` but **not in the built model** — values are stored at face scale. A mixed-scale dataset (GEL vs GEL_MN) currently disambiguates by *unit code*, not by a multiplier — workable but not the SDMX way.
- **Plan**: if mixed-scale data arrives, add `obs_attribute.UNIT_MULT` (already has a home — the V8 open bag) + a resolved-scale view. Two-way. Priority **P3**.
- **Raises-the-bar**: unit resolution as a view chain, fail-fast backfill.

---

### [DB-14 … DB-20] Operational cards — integrity · hygiene · tenancy · scale · SCD-2 · governance · config

Split to a sibling file to stay under the per-file ceiling: **`work/board/05-database-operational.md`**. Summary of those seven cards:

- **DB-14 Data integrity** 🟡 — integrity spread across DB-constraint / DB-trigger / offline-fitness tiers; several real referential edges (`content_constraint_member.code`, `reference_metadata.member_code`, `observation.release_id`, `concept.parent_code`) are fitness-only, not DB-enforced. Fine for a curated corpus, fragile under self-serve tenant writes.
- **DB-15 Migration hygiene** ✅ — reference-grade `09 §B` risk gates on every Class-M; immutability honored (V34 forward-adds rather than editing V5/V7); one live ONE-WAY door (V18 Part A). Gap: rollback scripts are prose, not CI-executed.
- **DB-16 Multi-tenant isolation** ⛔ — **the critical gap.** Single-tenant; one placeholder `stats.dataset.tenant_id` + `USING(true)` RLS; no tenant column anywhere else. "Tenant-agnostic code" ≠ "multi-tenant DB". Headline P1 (ADR-first).
- **DB-17 Partitioning / scale** 🟡 — hypertable+compression correct but mis-tuned (`dim_key_hash` in segmentby defeats compression; 3-mo chunks wrong for annual data); no continuous aggregates.
- **DB-18 SCD-2 correctness** ✅ — both chains correct; classifier chain wired-but-unexercised (needs a dress rehearsal before first live codelist revision; display re-point unguarded).
- **DB-19 Governance** 🟡 — audit immutability DB-enforced (strong); RBAC is flat `roles[]`, no granular permissions / per-tenant scoping / OIDC.
- **DB-20 Config schema** ✅ — lossless JSONB config-as-document + immutable versioned `page_version`; no tenant column (DB-16).

---

## Counts

| Status | Count | Cards |
|---|---|---|
| ✅ DONE | 12 | DB-02, 03, 04, 06, 07, 09, 10, 11, 12, 13, 18, 20 |
| 🟡 PARTIAL | 5 | DB-01, 05, 14, 17, 19 |
| ⛔ NOT-DONE | 2 | DB-08 (AgencyScheme), DB-16 (multi-tenant isolation) |
| 🆕 GAP | 1 | NET-NEW innovation (below) |
| 15 | — | V15 hygiene card folded into DB-15 (✅) |

**Headline**: the SDMX cube + migration craft are reference-grade (12 clean ✅). The gaps are concentrated at exactly two frontiers: **SDMX artefact completeness** (AgencyScheme/MSD, DB-01/08) and — decisively — **multi-tenant data isolation** (DB-16), which the branch name implies but the schema does not deliver.

---

## TOP-3 leverage items

1. **DB-16 — Multi-tenant data isolation (P1, L, ONE-WAY).** The branch is `feat/tenant-agnostic-platform`, yet the DB is single-tenant with one placeholder column. *Start with an ADR* (agency-as-tenant, shared-vs-owned structure, RLS vs schema-per-tenant) — this is a one-way modeling fork that everything else depends on. Pair with **DB-08 AgencyScheme** (the structure-ownership SSOT) and **DB-19 RBAC** (tenant-scoped roles). This is the single move that converts "tenant-agnostic code" into "multi-tenant platform".
2. **DB-17 — TimescaleDB tuning + continuous aggregates (P2, S–M, two-way).** Likely the highest ratio-to-effort win: `compress_segmentby` is mis-tuned (high-cardinality `dim_key_hash` defeats compression) and the 3-month chunk interval is wrong for annual data — both are roughly one-line changes with large effect. Promote `cube_actual_region` to a continuous aggregate (V26 already documents the escalation). Benchmark-driven, low risk, immediate scale headroom.
3. **DB-14/15 — Make integrity & rollbacks executable, not documentary (P2, M, two-way).** Two related hardenings: (a) the cube's referential integrity is answerable only by running the fitness suite (fine for a curated corpus, fragile under self-serve tenant writes) — catalog the "fitness-only" edges and promote the load-bearing ones to DB constraints/triggers before tenancy; (b) add a CI job that applies V1→head on fresh TimescaleDB *and test-executes the documented rollback scripts*, turning the excellent risk-gate prose into an executed gate.

---

## NET-NEW data-model innovation

### [DB-21] 🆕 Bitemporal "as-published" SDMX-CSV materialized vintage views + `agency`-scoped continuous-aggregate rollups
- **The idea**: The model already holds (a) release-keyed validity intervals on every revision (V25/V8) and (b) a derived `cube_actual_region`. Combine them into a **parameterized `STABLE` SQL function `stats.observation_as_of(dataset, as_of_date)`** that reconstructs the exact published vintage by overlaying `observation_revision` pre-images on the current cube by `release.published_at` — and expose it as an **SDMX-CSV serializer** (`stats.to_sdmx_csv(dataset, as_of?)`). This makes the platform's killer differentiator — *true revision-database vintage reconstruction* — a first-class, harvestable output that no general BI tool (Grafana/Metabase/Superset) and few NSIs offer. Layer a **continuous aggregate per (agency, dataset, time-grain)** beneath it so as-of rollups are pre-computed, refreshed in `publish_release`.
- **Why it's ambitious-yet-grounded**: every input already exists (release intervals, pre-image log, the derived-view pattern, the maintainable-artefact identity). It is *assembly*, not invention — the V25 header literally describes the as-of overlay join; this card promotes it from a documented capability to a serialized, cached, SDMX-interoperable endpoint.
- **YAGNI honesty**: build it **only after DB-16 (tenancy) and DB-11 retention** land — vintage reconstruction over an unbounded, unpartitioned `observation_revision` (DB-11) would be slow, and an `agency`-scoped aggregate presumes the agency/tenant SSOT (DB-08/16). So this is the **2-year capstone**, not a now-move. Refuse to build the serializer before the revision log has a retention policy and the agency scope exists — otherwise it is a fast path to a slow query.
- **Raises-the-bar**: turns the platform from "a cube with revision history" into "an SDMX node that can answer *what did you publish on date D* in a wire-standard format" — the genuinely distinctive capability of a national-accounts platform.

---

### Cited files
`ops/postgres/migrations/`: V2 (schemas), V3 (config), V4 (cube + hypertable + dim_key trigger + parse_time_period), V6 (display/SCD-2/RLS-seam/tenant_id placeholder), V8 (obs attributes + revision log), V10 (users), V11 (Medallion staging), V15 (audit_log), V16/V20/V21 (unit_measure), V18 (SCD-2 unlock + acyclicity + concept_role), V22 (SCD-2 validation fix), V23/V24 (code_path expand/contract), V25 (release/vintage), V26 (ContentConstraint + cube_actual_region), V27 (ConceptScheme), V28 (dataset lifecycle FSM), V29 (CategoryScheme), V31 (reference metadata ESMS-lite), V32 (W3C PROV), V34 (GDP DSD align), V35 (drop modes island). `ops/postgres/seed/R__seed_geostat_gold.sql`. Docs: `docs/architecture/subsystems/17-data-cube.md`, `18-classifier-pipe.md`; `docs/architecture/future/01-database/{overview,obs-schema,iam-audit,cms-schema}.md`; `platform/docs/plan/PLATFORM-GAP-ANALYSIS.md`.
