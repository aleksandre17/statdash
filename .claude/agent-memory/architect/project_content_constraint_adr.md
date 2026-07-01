---
name: content-constraint-adr
description: ADR-0027 SDMX-P0-1 ContentConstraint / cube region — predicate-row model (allowed-set per dim, optionally scoped by a condition) validated in SILVER (validate.ts, ILLEGAL_COMBINATION), actual region as a view feeding the Constructor
metadata:
  type: project
---

# ADR-0027 — ContentConstraint (cube region: legal dimension-value combinations) for SDMX-P0-1

Recorded 2026-06-23. Status: ACCEPTED + IMPLEMENTED 2026-06-23 (V26 + validate.ts/region.ts/types.ts + provisioning + fitness test all written by the database-architect; typecheck clean, provisioning unit tests green, fitness test skips offline). Last P0 gap from the SDMX deep-research.

## IMPLEMENTATION NOTES (what shipped, where it differs from the design above)
- **V26** = ops/postgres/migrations/V26__content_constraint.sql. stats.content_constraint (header, role CHECK pinned to 'allowed' — 'actual' is unrepresentable in the table) + stats.content_constraint_member (predicate rows) + stats.dim_key_in_allowed_region(TEXT, JSONB) STABLE helper + stats.cube_actual_region VIEW. No ALTER/DROP of any V1-V25 object; NO trigger on stats.observation.
- **Conjunction decision (NEW, was an open edge in the design):** multiple conditional rows on the SAME (dim_code, code) are **AND-conjoined** — every condition must hold. Covers the single-condition real case exactly; gives a defined, fail-safe (restrictive) meaning to multi-condition without a rule-group table. Escalation if true OR is ever needed = a nullable rule_group_id (additive). The helper + the validate.ts twin both implement AND.
- **ccm_predicate_uq = UNIQUE NULLS NOT DISTINCT** (PG15+; platform is timescaledb-ha:pg16, verified) so two identical unconditional rows collide and re-provisioning is idempotent.
- **Member.code is NOT FK to stats.classifier** (a constraint may be authored before its codelist; same posture as V11 silver). Validity is the authoring path + fitness function's job.
- **cube_actual_region** exposes (dataset_code, dim_key JSONB, obs_count, first_time_period, last_time_period). The CUBE-PROFILE ENDPOINT (other agent) reads THIS view + calls stats.dim_key_in_allowed_region() to classify has-data / empty-by-design / missing.
- **Silver gate** = the region check lives in platform/apps/api/src/ingest/region.ts (extracted from validate.ts to respect the 400-line ceiling — loadAllowedRegion + firstRegionViolation), called by validateObs in validate.ts. ONE query loads the region; checked in memory per row. ILLEGAL_COMBINATION emitted only on structurally-sound rows (no double-reporting over UNKNOWN_CODE). detail = unconditional {dim,value,allowed[],actual} or conditional {dim,value,requires:{dim,value},actual}.
- **types.ts** IssueCode union += 'ILLEGAL_COMBINATION' (app vocabulary; validation_issue.code stays free TEXT, no DB enum).
- **Provisioning** = ContentConstraintProvision { datasetCode, role?:'allowed', label?, members:[{dimCode,code,when?:{dimCode,code}}] } on the manifest; upsertContentConstraint identity (dataset_code, role), member-set replaced only on canonical change (jsonEqual), never DELETEs on omission. Parser rejects role≠allowed, empty members, self-conditioning, incomplete when (fail fast). The ACCOUNTS B9-only-on-U rule is authored here, NOT seeded in V26.
- **Fitness** = platform/apps/api/src/ingest/content-constraint.fitness.test.ts. Corpus assertion (no published obs out of region) + predicate-teeth assertion against the real B9/side-U rule, both via the V26 helper (SSOT), DB-gated skip + txn rollback like upsert.scd2.test.ts.

## The gap it closes
V4 `validate_observation_dim_key` validates each dim_key value IN ISOLATION (key set == DSD, each value ∈ classifier). It does NOT validate COMBINATIONS. ACCOUNTS_SEQUENCE (series key {measure, side, account}) needs: account `B9` (net lending/borrowing, a balancing item) is legal ONLY on side `U`; the Cartesian product measure×side×account contains combinations that are illegal by SNA design. Today such a row passes the trigger and enters gold.

## The decision — the load-bearing choices

### Constraint model = PREDICATE ROWS, not a cell table, not full tuples
`stats.content_constraint` (header, per dataset+role) + `stats.content_constraint_member` (rows). Each member row is: `(constraint_id, dim_code, code, cond_dim_code NULL, cond_code NULL)`.
- **Unconditional allowed set:** rows with `cond_dim_code IS NULL` enumerate the allowed codes for a dimension. A dim with NO unconditional rows is unconstrained (any classifier-valid value passes) — the allowed region is the Cartesian product of the per-dim allowed sets, defaulting to "all classifier members" for any dim not listed. This is the SDMX CubeRegion "included" semantics by KeyValue.
- **Conditional rule (the ACCOUNTS case):** a member row WITH `cond_dim_code`/`cond_code` reads "`dim_code` may be `code` ONLY WHEN `cond_dim_code = cond_code`". Models "account B9 only when side=U" as ONE row: `(account, B9, side, U)`. The check: if dim_key has account=B9, then side MUST equal U. Conditional rows are EXCEPTIONS layered on the unconditional sets — they restrict, never widen.
- Rejected the **explicit-allowed-tuple table** (one row per legal full combination): combinatorial blow-up (measure×side×account×… = thousands of rows for a handful of real rules), and authoring/maintaining it is error-prone. Rejected the **pure per-dim independent sets** (no condition): cannot express B9-only-on-U at all (it is exactly a cross-dim dependency). The predicate-row model is the minimal shape that covers BOTH the simple independent-set case and the real conditional case (Occam: simplest model that fits the actual rule), and is generic over dim codes (Law 1 — no hardcoded `side`/`account`).

### role ∈ {allowed, actual}, populated differently (SSOT)
- `allowed` = AUTHORED data (provisioned, like pages/nav). The legal cube by design. Distinguishes empty-by-design from missing.
- `actual` = DERIVED, NOT a table. A VIEW `stats.cube_actual_region` computed from `stats.observation` (DISTINCT dim values + DISTINCT realized combinations per dataset). SSOT = the observations themselves; never a second hand-maintained copy. So the `content_constraint` table only ever holds role='allowed' rows; `actual` is the view. (Considered a materialized projection refreshed on publish — rejected for now as YAGNI: the DISTINCT scan is cheap on the indexed hypertable and the Constructor read is not hot. Promote to a MATERIALIZED VIEW refreshed in publish_release IF profiling shows it; the view contract is identical so it is a one-line swap = Protected Variations.)

### Validation runs in SILVER (validate.ts), NOT the hot BEFORE-INSERT trigger
- Confirmed silver. The hot trigger would scan the constraint per row insert on the hottest table — perf cost on every publish for a check that is batch-natural. validate.ts already loads the DSD + codelists ONCE and checks all rows in memory; the allowed region loads the same way (one query for the constraint members, build the predicate set in memory, check every staged row with zero extra round-trips).
- Severity = **error** for the offending row (partial-success: other rows still publish; the bad row blocks publish via canPublish=false, consistent with UNKNOWN_CODE etc.). New IssueCode `ILLEGAL_COMBINATION`.
- **OPT-IN gold-level trigger:** decided NO standing per-dataset trigger in V26 (defense-in-depth here is the silver gate + the fitness function). A dataset wanting hard gold enforcement is served by the fitness function (asserts the invariant in CI), not a per-row runtime scan. Rationale: the silver gate already prevents bad rows reaching gold on the only write path (publish), and adding a hot-path combination scan contradicts the V25 reasoning that kept the cube write path free of cross-table coupling. (If a future direct-write path bypasses silver, revisit — the trigger is the escalation, gated behind a real second writer = YAGNI until then.)

### Constructor exposure
- `stats.cube_actual_region` view + a read route (e.g. `GET /stats/datasets/:code/cube-profile`) returning, per dimension, the three-way classification the renderer needs:
  - **has-data** = value/combo present in `cube_actual_region`.
  - **empty-by-design** = in the `allowed` region but NOT in actual (legal but unpopulated).
  - **missing** = NOT in allowed at all (illegal combination — should never have data).
- The Constructor offers only has-data combinations; the renderer badges empty-by-design vs treats missing as out-of-cube.

### Provisioning (authored data → loader)
- `allowed` constraints flow through the provisioning manifest (like pages/nav/dataSources). New optional `contentConstraints?: ContentConstraintProvision[]` on ProvisioningManifest + a new `upsertContentConstraint` upserter. Shape: `{ datasetCode, role:'allowed', members: [{ dimCode, code, when?: { dimCode, code } }] }`. Idempotent: identity by (dataset_code, role); replace member set transactionally only when changed (jsonEqual on the canonical member list). Never DELETE the constraint on file omission (same convention as other upserters).

## ILLEGAL_COMBINATION lives in the APP IssueCode vocabulary, not the DB
validation_issue.code is a free TEXT column (the closed vocabulary is the TS `IssueCode` union in ingest/types.ts, which the approver UI maps/i18ns). So `ILLEGAL_COMBINATION` is added to the TS union ONLY — no DB enum change. detail shape: `{ dim, value, requires: { dim, value }, actual: <dim_key> }`.

## Fitness function (the invariant that locks it)
"Every published observation's dim_key is within its dataset's allowed region, IF the dataset has a role='allowed' constraint." SQL assertion in the migration test suite: for each dataset with an allowed constraint, `SELECT count(*) FROM stats.observation o WHERE NOT stats.dim_key_in_allowed_region(o.dataset_code, o.dim_key)` = 0. (Helper predicate function `stats.dim_key_in_allowed_region(dataset_code, dim_key) RETURNS BOOLEAN` ships in V26 and is the SSOT the fitness test, the future opt-in trigger, and any ad-hoc audit all reuse — one definition of "in the region", not three.)

## Migration plan (V26, additive, two-way reversible)
- V26: `stats.content_constraint` + `stats.content_constraint_member` (PLAIN tables, FK into stats.dataset/dimension/classifier, all ON DELETE CASCADE) + `stats.dim_key_in_allowed_region(TEXT, JSONB) RETURNS BOOLEAN` (IMMUTABLE-ish, STABLE — reads the constraint tables) + `stats.cube_actual_region` VIEW. No ALTER of any V1-V25 object. Rollback = DROP VIEW + DROP FUNCTION + DROP the two tables. Blast radius NONE on existing objects (no trigger added to observation, no column added).
- Seed: V26 ships STRUCTURE only; the ACCOUNTS_SEQUENCE B9-only-on-U constraint is AUTHORED via provisioning (not seeded in SQL) so the rule lives with the other authored config (consistent with V11+ "no data seeded in migrations" posture).

## Rejected alternatives
1. **Hot BEFORE-INSERT trigger enforcing combinations.** Rejected: per-row constraint scan on the hottest table; contradicts the V25/V8 principle of keeping the cube write path free of cross-table coupling. Silver gate + fitness function gives the guarantee without the hot-path cost. (Kept as a documented escalation if a non-silver writer appears.)
2. **Explicit allowed-tuple table (one row per legal full combination).** Rejected: combinatorial blow-up + brittle authoring; the real rules are sparse cross-dim dependencies, not an enumerated product.
3. **`actual` as a hand-maintained table refreshed on publish.** Rejected for V26: violates SSOT (observations already ARE the actual region); a view is derived-by-definition and cannot drift. Materialized-view escalation noted behind a profiling trigger (same view contract).
4. **DB enum / CHECK for ILLEGAL_COMBINATION.** Rejected: the IssueCode vocabulary is owned by the TS union (validation_issue.code is intentionally free TEXT, V11 comment); adding a DB constraint would split the SSOT of the issue vocabulary.

## Files grounded in (read before implementation)
- V4 (observation, dataset_dimension DSD, validate_observation_dim_key trigger — the isolation-only gap), V7 (ACCOUNTS_SEQUENCE {measure,side,account} + the B9/side real case), V11 (stats_stage, validation_issue free-TEXT code), V18 (classifier is_current SCD-2 — actual region/region check filter is_current), V25 (risk-gate + migration style, publish_release as the mat-view refresh hook if escalated), V6 (bump_dataset_version).
- platform/apps/api/src/ingest/validate.ts (validateObs — where the region check hooks in, batch-loaded), ingest/types.ts (IssueCode union — add ILLEGAL_COMBINATION), provisioning/{types,loader,upsert}.ts (authored-data flow for allowed constraints), routes/stats/datasets.ts (read-route style for the cube-profile endpoint).
