# Board 05 — Database (Operational half: integrity · hygiene · tenancy · scale · governance)

> Companion to `05-database.md` (SDMX/cube data-model cards DB-01–DB-13 + executive summary). Same card schema. Truth source = SQL. Analysis only.

---

### [DB-14] Data integrity — DSD-completeness, dim_key gaps, referential choices
- **Status**: 🟡PARTIAL
- **Evidence**: V4+V22 dim_key validation trigger; `compute-dim-key-gap.mjs` + `seed-data.fitness.test.ts` (offline DSD-completeness); deliberate no-FK choices on hypertable (V8), `content_constraint_member.code` (V26), `reference_metadata.member_code` (V31), `observation.release_id` (V25).
- **What & why**: The cube's structural integrity is enforced by a mix of **DB triggers** (dim_key set-equality + current-member existence), **offline fitness functions** (DSD-completeness, unit-code validity, parent-resolution), and **silver-pipeline checks** (ILLEGAL_COMBINATION). The deliberate pattern: hot-path/hypertable integrity is kept out of FKs and pushed to triggers + fitness.
- **Critical analysis**: The integrity story is *coherent* but **distributed across three enforcement tiers** (DB constraint / DB trigger / offline fitness), and the offline tier is load-bearing. Several real referential edges are **not** DB-enforced and rely on a fitness test or app code being run: `content_constraint_member.code` → classifier, `reference_metadata.member_code` → classifier, `observation.release_id` → release, `categorisation.dataset_code` published-projection, `concept.parent_code` nesting. Each has a documented justification (hypertable FK-target limitation; author-before-codelist-exists; hot-path coupling) and each is individually sound — but in aggregate, **"is the cube referentially intact" cannot be answered by the DB alone**; it requires running the fitness suite. That is acceptable for a curated single-tenant corpus; it is fragile if a tenant self-serves writes. The dim_key trigger is the strong core (set-equality + is_current), correctly tightened by V22.
- **Reference platforms**: **dbt tests** (`relationships`, `accepted_values`) are exactly this "integrity-as-tests-not-constraints" philosophy — **we match** dbt's posture deliberately. **.Stat Suite** enforces more in-DB; **they beat** us on self-serve-write safety.
- **Foresight**: multi-tenant self-serve writes (DB-16) would demand promoting the offline checks to DB triggers/constraints (you cannot trust a tenant to run your fitness suite).
- **Plan**: catalog the "fitness-only" referential edges; for any that survive into a self-serve path, promote to a DB-side `STABLE`-function CHECK or trigger. Effort M, two-way (adding constraints). Priority **P2** (couples to tenancy).
- **Raises-the-bar**: integrity answerable by the DB when the writer is no longer trusted.

---

### [DB-15] Migration hygiene — Flyway-immutable, risk gates, idempotency
- **Status**: ✅DONE
- **Evidence**: Every Class-M header carries `09 §B` (reversibility/blast/hypertable/rollback) — e.g. V25:49-108, V26:76-112, V18:44-104. Idempotency pervasive (`IF NOT EXISTS`, `ON CONFLICT`, guarded `ADD CONSTRAINT`). V34 refuses to edit V5/V7 (forward-adds). V35 = forward-only `DELETE` (Flyway `clean` disabled). `R__seed_geostat_gold.sql` repeatable seed (neutralized from prod per V34).
- **What & why**: Reference-grade migration discipline. Immutability honored even when tempting (V4 edited *only* while never-applied; V34 lands the live `?datasetVersion=` widen as a deterministic forward migration rather than mutating V7).
- **Critical analysis**: Genuinely excellent — the best per-migration risk documentation I have reviewed. Honest caveats: (1) **Filename version order is non-monotonic** (V13/V14, V18/V19/V20 interleaved on disk) — Flyway orders by version number so this is cosmetic, but it relies on `outOfOrder` semantics being understood; a casual reader can misread sequence. (2) **One irreversible door is live**: V18 Part A drops the V4 blanket `UNIQUE(dim_code,code)` to unlock SCD-2 — correctly flagged ONE-WAY (re-adding fails once a second revision exists) and its latent validation hole was correctly closed by V22. Well-managed, but it is the one migration that cannot be rolled back once ETL writes history. (3) `R__` repeatable seed is "hand-maintained generated artifact, edit in lockstep with the bundle" — a divergence risk if the lockstep slips (mitigated by the seed-data fitness test). (4) No automated **migration-test harness** that applies V1→V35 against a fresh TimescaleDB in CI is cited — the risk gates are documented but their rollback scripts are not executed in CI.
- **Reference platforms**: **Flyway** best practice (immutable, versioned, forward-only in prod) — exemplary. **dbt** has no migration immutability (it rebuilds) — different model; **we beat** any "edit the migration" shop.
- **Foresight**: a CI gate that applies the full chain + asserts each documented rollback actually rolls back would make the risk gates *executable*, not just prose.
- **Plan**: add a CI job: fresh PG16+TimescaleDB → apply V1→head → run a smoke query; optionally test-execute rollback scripts. Effort S–M. Priority **P2**.
- **Raises-the-bar**: rollback scripts that are tested, not just written.

---

### [DB-16] Multi-tenant data isolation — single-tenant with a placeholder seam
- **Status**: ⛔NOT-DONE (critical, given `feat/tenant-agnostic-platform`)
- **Evidence**: The ONLY tenancy artefact in the entire schema: `V6` `stats.dataset += tenant_id UUID` (nullable, all NULL) + a permissive RLS policy `dataset_tenant_isolation USING(true)`. **No** `tenant_id` on `stats.observation`, `stats.classifier`, `stats.dimension`, or on **any** `config.*` table (`page`, `page_version`, `nav_item`, `site_config`, `user`, `data_source`, `data_spec`, `audit_log`). No `cms.site` tenant root. RLS enabled on exactly one table.
- **What & why**: The platform is **single-tenant today** with a single defence-in-depth placeholder. Critically: **"tenant-agnostic" in this codebase ≠ multi-tenant**. The branch name + the `first-tenant erosion` memory mean *the platform code carries no Geostat-specific hardcoding* (a code-purity goal), NOT *the database isolates tenant rows*. Those are different problems and only the first is in progress.
- **Critical analysis**: This is the single largest **architectural gap** between the built schema and the stated platform ambition. The `future/overview.md` + `iam-audit.md` designed the real thing — `cms.site` as tenant root, `site_id` FKs on pages/nav/roles, per-tenant RBAC, RLS + composite FKs, "a CMS migration can never threaten fact data" — and **none of it was built**. The current placeholder is honest but thin: one nullable column and a `USING(true)` policy is a *gesture* at tenancy, not a boundary. To actually go multi-tenant requires: (a) a tenant/agency SSOT (DB-08 AgencyScheme ≈ tenant for structure); (b) `tenant_id` threaded through the cube *and* config schemas; (c) RLS policies that read `app.current_tenant`; (d) deciding the **shared-vs-isolated structure** question — do tenants share codelists/concepts (likely yes for SDMX cross-domain) or own them (likely per-agency)? That last question is a genuine modeling fork the current schema has not faced. Also: the cube is **fully Law-1 generic** (a strength) but Law-1 says nothing about tenancy — generic dimensions do not isolate tenants.
- **Reference platforms**: **.Stat Suite** is multi-agency by design (agency-scoped artefacts). **Cube semantic layer** multi-tenancy via `securityContext` + row-level filters — the RLS analogue. **TimescaleDB** multi-tenant = `tenant_id` as a leading segmentby/index column. **We are behind all three** on isolation; we are ahead on Law-1 dimension genericity.
- **Foresight (1–2 yr)**: This is the make-or-break for "platform". Recommended target: **agency = tenant** for structure (codelists/concepts/categories scoped by `agency_id`, with a shared `SDMX`/`CROSS_DOMAIN` agency for cross-domain artefacts), `tenant_id` on the cube facts + config, RLS keyed to `app.current_tenant`, and the cube hypertable carrying `tenant_id` in `compress_segmentby` for partition pruning. Decide shared-vs-owned codelists explicitly (ADR).
- **Plan** (Class-M, mostly ONE-WAY, the platform's biggest data initiative):
  1. **ADR**: tenancy model — agency-as-tenant, shared vs owned structure, isolation mechanism (RLS vs schema-per-tenant vs DB-per-tenant). *Decide before any DDL.*
  2. AgencyScheme SSOT (DB-08).
  3. `tenant_id`/`agency_id` expand: add nullable columns to `config.*` + `stats.observation`/`classifier`/`dimension`, backfill to the single existing tenant, index/segmentby.
  4. RLS policies reading `app.current_tenant` GUC (the V6 placeholder already names the pattern).
  5. Contract: make columns NOT NULL once backfilled; tighten the placeholder policy.
  Effort **L**, risk **ONE-WAY** (tenant columns + RLS are hard to remove once data depends on them), priority **P1** — this is the headline item for the branch.
- **Raises-the-bar**: a real tenant boundary the DB enforces, distinct from code-level tenant-agnosticism.

---

### [DB-17] Partitioning / scale — TimescaleDB usage + missing rollups
- **Status**: 🟡PARTIAL
- **Evidence**: `V4` — `create_hypertable('stats.observation','time_period_date', chunk='3 months')`, `compress_segmentby='dataset_code, dim_key_hash'`, `compress_orderby='time_period_date DESC, id'`, `add_compression_policy(... '6 months')`. `cube_actual_region` = plain `GROUP BY` view (V26). No continuous aggregates.
- **What & why**: TimescaleDB hypertable + columnar compression on cold chunks — the right modern choice over the `future/` doc's native LIST→RANGE partitioning (Timescale gives automatic chunk management + compression for free).
- **Critical analysis**: Sound foundation, two scale risks. (1) **`compress_segmentby` includes `dim_key_hash`** — a *high-cardinality* segment key. Compression works best with *low*-cardinality segmentby (group many rows per segment); segmenting by a near-unique hash produces many tiny segments and *defeats* compression ratio. The intent (whole-series scans read one segment) is reasonable but `dataset_code` alone (or `dataset_code` + a low-cardinality dim) usually compresses far better; this deserves a benchmark. (2) **No continuous aggregates** — `cube_actual_region` (used by the Constructor profile) and any time-rollup recompute on every read; for a growing cube these are the obvious continuous-aggregate candidates (V26 itself flags the materialized-view escalation). (3) 3-month chunks for annual/quarterly national-accounts data means most chunks hold very few rows — chunk interval is tuned for high-frequency data, not annual stats; a 1-year (or larger) chunk interval likely fits the access pattern better and reduces chunk overhead.
- **Reference platforms**: **TimescaleDB patterns** — hypertable+compression correct, but segmentby cardinality + chunk interval are mis-tuned for low-frequency stat data; **continuous aggregates** are the unused superpower. **OLAP** pre-aggregated cubes / **Cube** pre-aggregations — the rollup story we lack.
- **Foresight**: at 10–100× the current corpus (multi-tenant, many datasets), read latency on profile/rollup endpoints will be the first thing to bite.
- **Plan**: (1) benchmark `compress_segmentby` (`dataset_code` vs `+dim_key_hash`) and chunk interval (`3 months` vs `1 year`) against the real corpus — likely a one-line change, big ratio win. (2) Promote `cube_actual_region` to a continuous aggregate / materialized view refreshed in `publish_release` (V26 documents this exact escalation, contract identical = Protected Variations). Effort S–M, two-way. Priority **P2**.
- **Raises-the-bar**: partition/compression tuned to the *actual* data frequency, with continuous-aggregate rollups.

---

### [DB-18] SCD-2 history correctness — codelists + reference metadata
- **Status**: ✅DONE (with one wired-not-running caveat)
- **Evidence**: classifier SCD-2 — `V6` (valid_from/valid_to/is_current + `uq_classifier_current` partial index), `V18` Part A (drop blanket unique = unlock), `V22` (validation reads `is_current`). reference_metadata SCD-2 — `V31` (`reference_metadata_current_chk: (valid_to IS NULL) = is_current` + partial unique current).
- **What & why**: Two SCD-2 chains, both with the correct invariants: exactly one current row (partial unique), closed rows carry `valid_to`, the current/closed coupling is a CHECK. The classifier chain went through a clean expand-contract (V6 expand → V18 contract → V22 close-the-hole).
- **Critical analysis**: The reference_metadata SCD-2 is *fully correct* (current_chk makes the open/closed coupling unrepresentable). The classifier SCD-2 is **wired but not yet exercised** — `valid_from` defaults NULL on existing rows, `is_current` defaults true, and no ETL path writes a historical revision yet, so the chain's correctness is *latent* (V22's pre-flight confirms zero non-current rows exist). The risk: the first real codelist revision is the first time the whole SCD-2 path (close old / re-point displays / new surrogate id / dim_key validation against is_current) runs end-to-end in anger — and the display re-point (DB-03) has no DB guard. Recommend a deliberate **SCD-2 dress rehearsal** (revise one classifier in a test, assert displays + observations + LTREE all follow) before a live codelist revises.
- **Reference platforms**: **Kimball SCD-2** — textbook (surrogate keys, current flag, validity window). **dbt snapshots** — the analogue; **we match** with the partial-unique current guard, **beat** on the validation-trigger is_current tightening.
- **Foresight**: a multi-tenant cube revises codelists far more often → the latent path becomes hot.
- **Plan**: SCD-2 end-to-end dress-rehearsal fitness test (revise → assert display/obs/path consistency); add the display re-point guard (DB-03). Effort S, two-way. Priority **P2**.
- **Raises-the-bar**: exercise the SCD-2 path before production depends on it being correct.

---

### [DB-19] Governance — audit_log + RBAC identities
- **Status**: 🟡PARTIAL
- **Evidence**: `V15` `config.audit_log` (append-only, DB-enforced immutability trigger, 4 read-path indexes); `V10` `config.user` (scrypt hash, `roles[]`, non-empty CHECK).
- **What & why**: A DB-enforced append-only governance trail (UPDATE/DELETE raise) + local user identities for RBAC. Audit immutability is structural, not conventional — the right call for non-repudiation.
- **Critical analysis**: The audit table is well-built (immutability in the DB, server-assigned `occurred_at`, partial indexes). But governance is **half-wired**: the platform gap analysis (A2/A3) confirms RBAC is config-schema-ready but **enforcement and the audit *sink* are largely unbuilt** at the app layer — the table exists; whether every privileged route writes to it is not guaranteed by the DB. And RBAC is **`roles[]` as a flat text array on the user**, not the `iam.role`/`permission`/`role_permission` model the `future/iam-audit.md` designed — so there is no permission granularity, no per-tenant role scoping (`user_role.site_id` in the design), and no OIDC federation. For single-tenant admin this is fine; for multi-tenant it is insufficient (a tenant admin must not administer another tenant).
- **Reference platforms**: **Retool/Grafana** audit log + RBAC — we have the immutable trail, lack the enforcement breadth + granular permissions. **future/iam-audit.md** OIDC + per-tenant roles — designed, not built. **We beat** most on audit *immutability* (DB-enforced).
- **Foresight**: multi-tenant RBAC needs the `role`/`permission`/`user_role(site_id)` model + tenant-scoped audit (`audit_log.site_id`). Couples to DB-16.
- **Plan**: when tenancy lands — promote `roles[]` → `iam`-style role/permission/user_role with `site_id`; add `tenant_id` to `audit_log`; fitness-assert every privileged route writes an audit row. Effort M, ONE-WAY (auth model change). Priority **P2** (with DB-16).
- **Raises-the-bar**: granular, tenant-scoped, enforced governance — not just an immutable table.

---

### [DB-20] Config schema — JSON-fidelity + page versioning
- **Status**: ✅DONE
- **Evidence**: `V3` — `config.page` + `config.page_version` (append-only `NodeDef` tree snapshots, monotonic `version_number` via trigger, `is_published` partial index), `site_config` key/value JSONB, `data_source`/`data_spec`/`nav_item`. `V35` drops the orphaned `modes` site_config island.
- **What & why**: The Constructor-output schema mirrors TS contracts verbatim as JSONB (`JSON.parse(JSON.stringify(x)) === x` invariant) — `page_version.config` is the full `NodeDef` tree, immutable per save (history/rollback). Round-trip fidelity beats relational purity here (correct per the design's two-laws split).
- **Critical analysis**: Correct application of polyglot persistence *within one engine* — the page tree is a document (JSONB, lossless), the cube is relational (normalized, constrained). The append-only `page_version` with trigger-assigned monotonic numbering (no app-side `max()+1` race) is the right concurrency-safe pattern. `nav_item` and `page` are independent tables (per the contract memory) — good. V35 cleaning the `modes` island is exactly the right forward-only hygiene (co-shipped with the provisioning artifact edit). The one tenancy-relevant gap: **none of `config.*` carries a tenant/site column** (DB-16) — in the `future/` design these were `cms.*` under a `cms.site` root.
- **Reference platforms**: **Builder.io / Form.io** content-model-as-JSON — same philosophy, lossless round-trip. **dbt** doesn't model config. **We match** Builder.io on serialization fidelity, **beat** it on versioned immutable snapshots.
- **Foresight**: multi-tenant config requires `site_id` on every `config.*` table + RLS (DB-16).
- **Plan**: tenant columns arrive with DB-16. Priority **P1** (as part of tenancy).
- **Raises-the-bar**: config-as-document with versioned immutability.
