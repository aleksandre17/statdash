---
name: demo-classifier-data
description: V33 seeds the aggregates virtual classifier + de-dups geo for the demo panels; isClosing lives in classifier.metadata; ON CONFLICT must target the partial unique (V18 dropped the blanket one)
metadata:
  type: project
---

V33__demo_classifier_data.sql (head as of 2026-06-26) seeds the classifier DATA
the surviving demo page configs (apps/api/provisioning/geostat.provisioning.json)
need so ACCOUNTS + REGIONAL panels render. Two gaps:

- **GAP 1 `aggregates`**: a VIRTUAL classifier (own dimension, concept_role=
  'classification') keyed to the CANONICAL measure codes (B1G, B2G_B3G, D4_D1, D5,
  D9P, P5G … — NOT the OLD CODE_MAP normalized codes). 19 members. The accounts
  pipe does join {$cl:'aggregates'} fields:['isClosing'] on measure + lookup
  {$d:'aggregates'} for label/color. **isClosing lives in stats.classifier.metadata**
  ({"isClosing":bool,"account":<sna-account-code>}) — that is the home the
  classifiers route GET /:dim_code returns and the engine $cl resolver spreads onto
  the entry. account is an ATTRIBUTE not a hierarchy edge (OLD list was flat per
  account) → parent_code stays NULL for aggregates. label/color → classifier_display
  (per locale) materialized FROM the classifier rows (DRY single-source).
- **GAP 1b `account`**: members already existed (V7 canonical ingest) with correct
  ord 1..6 but no `order` field + empty display. V33 stamps metadata.order=ord (the
  pipe joins fields:['order'] then sorts by:'order') + seeds account display overlay.
- **GAP 2 `geo` de-dup**: codelist carried BOTH ISO (GE-TB/GE-KA) and canonical Rn
  (R2/R6) for the same region. Facts use _T+R2..R12 (REGIONAL) and GE (GDP). RETIRE
  GE-TB/GE-KA via SCD-2 close (is_current=false, valid_to=now() — NEVER delete; 0
  facts reference them, verified live). KEEP GE + _T + R2..R12. EXCEED: parent_code=
  '_T' on R2..R12 (SDMX roll-up). Same _T-parent hierarchy for sector.

**Why DB-seed migration, not workbook+re-ingest:** the canonical parser
(apps/api/src/ingest/canonical/parse.ts) (1) only emits CL_<dim> for dims ∈ DSD —
aggregates is NOT a DSD dim; (2) hardcodes `metadata:{}` so it can't carry
isClosing; (3) ingest is additive/SCD-2 so it can't RETIRE the geo ISO dups or add
parent_code (workbooks carry none). aggregates is structural SNA metadata
(declarative, 19 rows) → migration per V7's "structure=migrations" principle.

**CRITICAL V4/V18 gotcha (cost a dry-run failure):** V18 Part A DROPPED the V4
blanket `classifier_dim_code_code_uq UNIQUE (dim_code, code)`. The live unique key
is the PARTIAL index `uq_classifier_current (dim_code, code) WHERE is_current` (V6).
So any INSERT INTO stats.classifier upsert MUST use
`ON CONFLICT (dim_code, code) WHERE is_current DO …` — a bare
`ON CONFLICT (dim_code, code)` raises "no unique or exclusion constraint matching".

**Validation without local docker/psql:** ssh -F ops/config/ssh/config geostat-deploy
(host up, statdash-postgres container). Dry-run a migration safely as
`psql -v ON_ERROR_STOP=1 -c 'BEGIN;' -f /tmp/Vxx.sql -c 'ROLLBACK;'` — proves every
statement + post-condition DO-block assertion executes on the live volume without
committing (the orchestrator does the real Flyway apply). See [[project-schema-ssot]],
[[db-gated-fixtures]], [[concept-role-ssot]].

**Engine coordinate:** fromStatsClassifiers (packages/plugins/datasources/stats-api.ts)
was being rewired concurrently to read parent_code (not parent_id), pull display
label/color, and spread metadata onto the entry — V33's rows carry label/color/
parent_code/metadata in the standard schema so that work integrates. See architect's
[[api-demo-parity]] root causes 4/5/6.
