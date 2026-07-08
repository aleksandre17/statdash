---
name: project-multi-tenancy
description: The ratified multi-tenancy data-plane decision (tiered hybrid POOL+RLS / SILO escape) and the red-team amendments that gate the build
metadata:
  type: project
---

Multi-tenancy fork for the platform (becoming a multi-AGENCY hosted SaaS). Decision docs: `docs/architecture/proposals/DESIGN-multi-tenancy-decision.md` (decided design) + `docs/architecture/proposals/DESIGN-multi-tenancy-final.md` (my red-team + ratification, the signed artifact) + `docs/architecture/decisions/ADR-multi-tenancy.md` (to be upgraded to match the final once signed).

**Ratified call:** tiered hybrid — POOL (shared-schema + FORCE RLS, non-owner app role) default + SILO-per-deploy escape; one `TenantContext` resolved at the request boundary into a `SET LOCAL app.current_tenant` GUC. `tenant_id UUID FK → stats.agency`. Agency = tenant (SDMX agencyID). GUC precedent already in prod: `publish.ts:101` `set_config('app.revised_by',$1,true)`.

**Why:** owner vision-led decision (Law 7); onboard an agency = insert a row, not stand up a deploy.
**How to apply:** when touching schema/auth/pooling, treat tenant as a boundary scope (never a cube dimension — Law 1); enforce isolation via RLS below the DataStore port, not app-layer WHERE.

**My red-team amendments (gate the build — must be honored):**
1. HEADLINE: `withTenant` is request-scoped, but the ingest worker drain, boot provisioning, reclaim sweep, and `publishSubmission` (takes the pool, opens its OWN txn) run with NO GUC and break under FORCE RLS. Fix: per-unit-of-work GUC inside publish's own BEGIN (needs `stats_stage.submission.tenant_id`) + admin-role for cross-tenant sweeps. Gate: FF-11.
2. `config.snapshot` is capability-isolated (HMAC token in `routes/embed`), NOT tenant-RLS — exclude from FORCE set or embeds 404. FF-3 needs a capability-isolated allowlist.
3. Global `stats.dataset.code` PK + tenant-less `uq_observation_series` ⇒ "shared DSD, different data" is unachievable as written. Adopt the SHARED-REFERENCE / SCOPED-FACT invariant: classifier/dimension/dataset_dimension/concept_scheme/category_scheme/metadataflow stay GLOBAL/shared; config.*/dataset/observation/cube_actual_region/stats_stage scoped. dataset_code stays global, tenants own disjoint codes. `obs.tenant_id = dataset.tenant_id` WITH CHECK. Gate: FF-12.
4. Three-role split (owner=DDL/Flyway, admin=cross-tenant RLS-exempt DML, app=tenant non-owner FORCE-bound) beats the two-role plan. FF-5 must land before the pgBouncer rewire (app still on direct Postgres today).

**Live-state facts (verified V1-V37):** only inert tenant_id placeholders today — `stats.dataset.tenant_id UUID` (V6, USING(true) no-op) + `config.snapshot.tenant_id TEXT` (V36, type defect → reconcile to UUID FK). No `stats.agency` table yet. `JwtPayload` has no tenant claim. Flyway + app both run as owner `statdash`; pgBouncer `POOL_MODE: transaction`. See [[project_db_state]].
