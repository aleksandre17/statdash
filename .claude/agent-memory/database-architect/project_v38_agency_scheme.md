---
name: project-v38-agency-scheme
description: V38 AgencyScheme SSOT (DB-08) — stats.agency_scheme + stats.agency; nullable agency_id FK re-point via EXPAND; CONTRACT + multi-tenancy deferred
metadata:
  type: project
---
**V38__agency_scheme.sql** (head migration as of 2026-07-01) — the DB-08 identity keystone. Class-M, **EXPAND-only, TWO-WAY reversible**.

**Why:** free-text agency was copy-repeated (`stats.concept_scheme.agency` V27, `stats.metadataflow.agency` V31, both DEFAULT 'SDMX') + `stats.dataset.source` V4 ("agency/provider") with **no SSOT table**. Pure identity normalization — justified independent of multi-tenancy.

**Shape:**
- `stats.agency_scheme(code PK, label i18n '{}', metadata, ts)` — SDMX AgencyScheme namespace (concept_scheme idiom). Seed `'AGENCIES'`.
- `stats.agency(id UUID PK gen_random_uuid, scheme_code FK, code TEXT UNIQUE = SDMX agencyID, name JSONB NOT NULL, contact_name, contact_email, parent_id UUID self-FK ON DELETE SET NULL, metadata, ts, CHECK parent_id≠id)`. **id is a UUID surrogate** = the stable FK target (code is mutable business identity — Protected Variations). `name` wired to V13 **REQUIRED** `config.enforce_locale_string('name')` (the stats.dataset.label posture, not the '{}' structure-label posture). GIN(name jsonb_path_ops) mirrors V14.
- Seeds **GEOSTAT** (owning agency, fallback target) + **SDMX** (standards agency — seeded so backfill maps `agency='SDMX'` faithfully, NOT lossily into GEOSTAT). Both root, complete ka+en names.

**Re-point (EXPAND):** nullable `agency_id UUID` FK→`stats.agency(id)` on the **3** carriers only. **V29 category_scheme has NO agency column** (verified) → omitted. Old TEXT columns KEPT in parallel. Backfill: `UPPER(TRIM(text))=UPPER(agency.code)` then GEOSTAT fallback; DO-block asserts 0 rows NULL after backfill.

**Deferred (do NOT build without owner greenlight):** CONTRACT = drop TEXT columns / `agency_id NOT NULL` — a later door after a 2nd agency proves the model. Multi-tenancy (RLS FORCE, tenant GUC, tenant_id) — DEFERRED by owner. The **V6 `stats.dataset.tenant_id` + `USING(true)` RLS placeholder is UNTOUCHED** (agency_id=identity vs tenant_id=isolation-scope; a future MT migration MAY point tenant_id at `stats.agency(id)` since id is UUID). See `docs/architecture/decisions/ADR-multi-tenancy.md` §3 Plane-1.

**Provisioning:** `apps/api/scripts/seed.ts` idempotent GEOSTAT re-assert (guarded on V38 via `to_regclass`, `ON CONFLICT(code) DO UPDATE` name/contact).

**Fitness:** `platform/apps/api/src/routes/stats/agency-scheme.fitness.test.ts` — DB-gated (code UNIQUE teeth, re-point FK validity + backfill completeness across the 3 carriers, name completeness reject/all-valid, self-parent CHECK) + **no-DB EXPAND-only/no-MT source grep** (V38 must have no `DROP COLUMN`, no `agency_id … SET NOT NULL`, no FORCE RLS / current_setting / app.current_tenant / tenant_id in logic). NOTE: the grep strips `COMMENT ON … IS '…';` by terminating at the closing `';` (comment bodies legitimately mention tenant_id / the V6 seam).

Ran vs skipped: typecheck/build:engine/panel+api tsc/lint/check-laws/api-vitest all GREEN offline; **apply-migrations + DB-gated agency fitness SKIPPED** (no DATABASE_URL). Related: [[project-db-state]] [[project-multi-tenancy]] [[project-db-contracts]].
