# ADR — True Multi-Tenancy as a First-Class Generic Seam

> Status: **PROPOSED** (one-way-door decision; user sign-off required before MT-2 lands)
> Date: 2026-06-28 · Branch: `feat/tenant-agnostic-platform` · Author: architect
> Supersedes the implicit "agnostic ≈ multi-tenant" conflation flagged in `work/board/06-architecture-vision.md` [ARCH-01] and `work/MASTER-BOARD.md` [X-1].
> Scope: **analysis + design only.** No product code or schema changed by this ADR.
> Decision class: **M** (Class-M API/data, architect-gated) · Door: **1-way** (the data plane) · Priority: **P0-DECISION**.

---

## 1. Context

The branch promises *tenant-agnostic*; the owner has now made a **vision-led decision** to become a real multi-**agency** statistical-dashboard **platform** (many statistical agencies author + publish + serve dashboards on one instance). Law 7 governs: the single-tenant state is **migration work, not a constraint.**

**Verified current state (truth = source, not docs):**

| Plane | Evidence | State |
|---|---|---|
| Data | `ops/postgres/migrations/V6:159` — one nullable `stats.dataset.tenant_id UUID`, `USING(true)` permissive RLS; **no `tenant_id` on any other table** across V1→V35 | placeholder seam only |
| Config | `V3` `config.site_config` flat key/value PK=`key`; `config.page`/`page_version`/`nav_item`/`data_source`/`data_spec` — **no tenant column** | single-tenant |
| Theming | `packages/styles/src/css/tokens.css` `[data-tenant]` selector exists but is **build-time / global**, not request-resolved | static |
| Auth | `apps/api/src/lib/auth.ts` `JwtPayload{sub,uid,iat,exp,roles?}` — **no tenant claim**; `config.user` (V10) has `roles[]`, **no tenant_id** | flat RBAC |
| Authoring | `apps/api/src/routes/catalog`, Constructor in `apps/panel` — edit one site, **no tenant context** | single-site |
| Identity SSOT | `agency TEXT NOT NULL DEFAULT 'SDMX'` repeated on V27/V29/V31 + `stats.dataset.source` — **no `stats.agency` table** (DB-08) | unmodeled |

**Two sharp correctness facts discovered (load-bearing — most RLS designs get these wrong):**

1. **The app connects as the table OWNER.** `ops/compose/*` + `flyway.yml` + `pgbouncer.yml` all use the single role `statdash` (`POSTGRES_USER:-statdash`) for migrations *and* the app. **Postgres RLS is silently bypassed for a table's owner** unless `ALTER TABLE … FORCE ROW LEVEL SECURITY` is set. Without this, the entire isolation spine is a no-op that *passes every happy-path test*. This is the single most dangerous trap and is promoted to a fitness function (FF-3).
2. **pgBouncer runs transaction-pooling** (`db.ts`: "transaction-pooling mode"). A session-level `SET app.current_tenant` **leaks across tenants** when a pooled connection is reused. The tenant GUC **MUST** be `SET LOCAL` inside an explicit per-request transaction. This is a cross-tenant-leak vector and is promoted to a fitness function (FF-5).

---

## 2. Decision

Adopt **multi-tenant SaaS** using the **POOL model** (shared database, shared schema, **Postgres RLS** as the enforcement spine), with **agency = tenant** as the identity SSOT, and a door left open to promote a single high-isolation tenant to the **BRIDGE/SILO** model later through the same seam.

The non-negotiable framing — what makes this **ours, not a bolt-on** — is one architectural insight:

> **Tenancy is a SCOPE resolved at the request boundary and enforced declaratively below the `DataStore` port — it is NOT a privileged dimension and NOT a column the application threads through queries.**

This is the exact discipline of the just-shipped **perspective axis** and of **locale**:
- *Locale* is not `ctx.dims['locale']` — it is a resolution context (`LocaleString` resolved at render).
- *Perspective* is generic in the engine (`ctx.perspectiveState: Record<param,string>`), composed at one container.
- **Tenant is the same primitive at the boundary:** one resolved `TenantContext`, pushed into (a) a Postgres GUC so **RLS** isolates data/config declaratively, and (b) the `RenderContext` so theming/config/catalog resolve per-tenant — while **`packages/core` and `packages/react` change by ZERO lines** because the `DataStore` port (Law 5) already hides *where data comes from* from the engine.

That is why multi-tenancy is **cheap and elegant for us** and a heavy retrofit for the incumbents (§7): our config **is data** (JSON in `config.*` tables), so **one** `tenant_id` + **one** RLS mechanism isolates **all five planes** through **one** SSOT — where Grafana/Looker/Tableau/Cube re-implement tenant-scoping per subsystem.

### The generic seam shape (registry-driven, Law-1, Law-8)

```
              ┌─────────────────────────────────────────────────────────┐
  request ──▶ │  TenantResolver registry (Strategy + Registry)          │
              │   subdomain · path · header · jwt-claim  (open for ext.) │
              └───────────────────────────┬─────────────────────────────┘
                                          │  resolves ONE
                                          ▼
                                   ┌──────────────┐
                                   │ TenantContext│  { tenantId, agencyCode, capabilities }
                                   └──────┬───────┘
                 ┌───────────────────────┼────────────────────────┬───────────────────────┐
                 ▼                       ▼                         ▼                       ▼
        SET LOCAL app.current_tenant   RenderContext.tenant   theme: data-tenant=     catalog/Constructor
        (per-request txn)              (injected port, Law 3) agencyCode (per-req)    capability filter
                 │                       │                         │                       │
                 ▼                       ▼                         ▼                       ▼
            RLS isolates           engine stays              token set rebinds        registry filtered
            config.* + stats.*     tenant-BLIND              per request              by tenant grant
            (declarative policy)   (ZERO core change)        (spine already supports) (registry seam)
```

- **One primitive** (`TenantContext`), resolved once, read identically everywhere — the perspective-axis discipline.
- **Registry-driven** resolution: `TenantResolver` strategies register (subdomain/path/header/JWT); adding one is a registration, not a rewrite (Law 8, OCP).
- **Declarative enforcement**: the isolation invariant is an **RLS policy** (config/data), not a `WHERE` clause sprinkled in code (Grafana's failure mode — a missed clause leaks).
- **Law 1 preserved**: tenant is **never** `ctx.dims['tenant']`. It is a boundary scope, like locale. FF-6 forbids `tenant` appearing as a cube dimension in `packages/core`.

### Why POOL (the trade-off, ISO 25010)

| Model | Isolation | Cost (our TimescaleDB cube) | Migration ops | Verdict |
|---|---|---|---|---|
| **Silo** (DB per tenant) | strongest (physical) | N hypertables, N pools, N flyway runs; **kills shared structure** (shared DSDs, CL_GEO, AgencyScheme) | ×N every migration | reject as default — operationally heavy, fragments the cube |
| **Bridge** (schema per tenant) | strong | hypertable per schema; `search_path` juggling; RLS unneeded but migration fans out ×N | ×N | reject as default — same fan-out, complex |
| **POOL** (shared + RLS) | strong *if RLS forced* | **one** `stats.observation` hypertable (stays time-partitioned), `tenant_id` as a segmentation column + index; **one** migration | ×1 | **ADOPT** |

**Trade-off named:** POOL gains *deployability + cost-efficiency + maintainability* (one migration, one cube, one pool) and *cross-tenant shared structure* (two agencies share a DSD, publish different data). It trades away *physical isolation* — recovered by **`FORCE` RLS + non-owner app role** (defense in depth) and by the **escape door**: because isolation rides a `tenant_id` FK, **any one tenant can later be promoted to BRIDGE/SILO** (e.g. a regulator demanding physical separation) **without the pool tenants moving** — the seam is model-agnostic. This is the Protected-Variations (GRASP) payoff: the variation point (isolation strength per tenant) sits behind a stable seam.

---

## 3. The five isolation planes — seam · migration · fitness

### Plane 1 — DATA (the spine)

- **Seam:** `tenant_id UUID` (FK → `stats.agency`) on the cube write-surface + config tables; **RLS policy** `USING (tenant_id = current_setting('app.current_tenant', true)::uuid)`; the app sets the GUC via `SET LOCAL` in a per-request transaction. The engine reads through a `DataStore` whose connection is already tenant-GUC'd → **engine unaware**.
- **Identity SSOT = AgencyScheme (DB-08):** model `stats.agency_scheme` + `stats.agency(id, code, name i18n, contact, parent)` **first**. `tenant_id` is a UUID FK to `stats.agency`; `agency.code` is the SDMX `agencyID`. Agency **is** the tenant in SDMX terms (agencies own maintainable artefacts) — this is the structural-ownership SSOT the model already "names everywhere and stores nowhere." The four free-`TEXT` `agency` columns re-point to this FK by expand-contract.
- **TimescaleDB honored:** `stats.observation` stays a **time-partitioned hypertable**; `tenant_id` is a column + index, **not** a new space partition (avoid over-partitioning until measured — ARCH-05 budget gates that). RLS policies live on the parent hypertable; chunk inheritance verified in MT-4.
- **Migration:** expand-contract — add nullable `tenant_id` → backfill all rows to the Geostat agency → keep `USING(true)` → (MT-4) flip to tenant-scoped + `FORCE` + non-owner role → `NOT NULL` once proven.
- **Fitness:** **FF-1 FF-TENANT-ISOLATION** — real-Postgres integration test: as tenant A, every read of every tenant-scoped table returns **zero** tenant-B rows; a write with a mismatched GUC fails `WITH CHECK`. **FF-3 FF-EVERY-TENANT-TABLE-HAS-RLS** (below).

### Plane 2 — CONFIG

- **Seam:** the **same** `tenant_id` on `config.site_config` (drop the bare `key` PK → composite `(tenant_id, key)`), `config.page`, `page_version`, `nav_item`, `data_source`, `data_spec`. The bootstrap route (`apps/api/src/routes/bootstrap/index.ts`) already composes the whole site from these tables in one read — **once they are RLS-scoped, bootstrap becomes per-tenant with near-zero route change** (the GUC is set by the resolver preHandler; the existing SELECTs are unchanged and automatically filtered). This is the elegance: config-as-data means config-isolation rides the data spine.
- **Provisioning generalizes:** `geostat.provisioning.json` is *one tenant's* config; the GitOps loader (`apps/api/src/provisioning/loader.ts`) gains a `tenant` field per manifest (default = Geostat), upserting into the tenant's namespace via the same idempotent path. The forward-migrate-on-read (`migratePageConfig`) path is untouched.
- **Fitness:** **FF-2 FF-NO-CROSS-TENANT-LEAK** — a bootstrap request resolved to tenant A never returns a page/nav/source authored by tenant B (extends the existing `bootstrap-parity.fitness.test.ts`).

### Plane 3 — THEMING

- **Seam:** the spine **already** supports the override — `[data-tenant]` rebinds Tier-2 accent tokens over the brand-neutral default (`tokens.css`). The only change is **WHO sets the attribute and WHEN**: promote it from build-time/global to **request-time**, driven by `TenantContext.agencyCode`. The tenant's token set ships in the (now tenant-scoped) bootstrap manifest; the runner sets `data-tenant={agencyCode}` per request. No new theming machinery — a *promotion* of an existing seam from compile-time to request-time (the ADR-semantic-token spine anticipated exactly this).
- **Fitness:** **FF-7 FF-FIRST-TENANT-BYTE-IDENTICAL** — Geostat renders **byte-identical** tokens before/after (extends `tokens.parity.test.ts`); a second tenant's `data-tenant` resolves a *different* accent without touching the neutral base.

### Plane 4 — AUTH

- **Seam:** add `tid` (tenant id) claim to `JwtPayload` (additive — Postel: pre-`tid` tokens resolve to the default tenant during migration, exactly as `roles?`/`uid?` already degrade). `config.user` gains `tenant_id` (a user belongs to one agency; cross-agency super-admin is a later door). **RBAC becomes tenant-scoped:** roles are *within* a tenant (DB-19). The auth preHandler resolves tenant → sets the GUC.
- **Resolution strategy (single-origin deploy):** three layers, defense in depth —
  1. **Subdomain** (`geostat.statdash.app`) — *primary selector* for the **public delivery surface** (the bootstrap route is unguarded — no token at boot, so host is the only signal). Clean origin/cookie isolation; respects the single-origin reverse-proxy topology (relative `/api/`, empty Vite base — path-prefix `/t/geostat/` would break that, so path is **not** primary).
  2. **JWT `tid` claim** — *the authority* for the **authoring surface** (`config/*` Bearer-guarded). The claim, not the host, is trusted for writes.
  3. **`X-Tenant` header** — for programmatic API clients (registered strategy, last in the chain).
  The resolver registry tries strategies in order; **public surface → host; authoring surface → claim.** Both converge on one GUC. (This is precisely why a *registry of strategies* is the right shape, not an `if/else`.)
- **Fitness:** **FF-4 FF-TENANT-CLAIM-OR-HOST** — no route runs a tenant-scoped query without the GUC set (the resolver preHandler is mandatory on every tenant-scoped scope); a request with neither host nor claim fails **closed**, never defaults to "all tenants."

### Plane 5 — AUTHORING

- **Seam:** the Constructor + catalog scope to the tenant automatically — the catalog route reads `config.*`/`stats.*`, which are now RLS-scoped, so **the dataset palette is tenant-filtered with zero route change.** Per-tenant **capability surface** (which registered plugins/chart-kinds a tenant may author) = a `TenantContext.capabilities` grant filtering the existing capability registries (the `describeApp()` manifest is already the introspection seam). **Defer** the grant table behind door **D-CAP** until a second tenant needs a *different* plugin set (YAGNI — the registry filter is the seam, the grant is the data).
- **Fitness:** **FF-8 FF-CATALOG-TENANT-SCOPED** — the Constructor palette for tenant A lists only tenant-A datasets + tenant-A-granted capabilities.

---

## 4. Strangler-Fig migration roadmap (expand-contract; each phase independently green; **Geostat = tenant 0, byte-identical throughout**)

| Phase | Move | Door | Reversible? | Green criterion |
|---|---|---|---|---|
| **MT-0** | This ADR — decide POOL + agency=tenant + RLS spine | model choice | one-way (decision) | sign-off |
| **MT-1** | **AgencyScheme (DB-08)**: `stats.agency_scheme` + `stats.agency`; seed `GEOSTAT` | new tables | two-way (drop) | existing suite green; agency SSOT exists |
| **MT-2** | **Expand**: add nullable `tenant_id` FK→agency to `config.*` + `stats.*` write surface; backfill **all** rows → Geostat; composite `(tenant_id,key)` on `site_config`; RLS stays `USING(true)` | additive cols | two-way (drop cols) | one-tenant ⇒ behavior identical; FF-7 byte-identical |
| **MT-3** | **Boundary**: `TenantResolver` registry (host/JWT/header) + per-request txn `SET LOCAL app.current_tenant`; add `tid` to JWT (Postel); `config.user.tenant_id`; inject `TenantContext` into `RenderContext` (app-side, Law 3) | new code | two-way | GUC always = Geostat; FF-5 SET-LOCAL-only |
| **MT-4** | **Enforce (the switch)**: flip policies `USING(true)` → tenant-scoped + `WITH CHECK`; `ALTER TABLE … FORCE ROW LEVEL SECURITY`; introduce a **non-owner app role** the API connects as | policy + role | two-way (revert policy) but **hardening** | FF-1 isolation; FF-3 every-table-RLS; one tenant ⇒ identical, but missing GUC now fails-closed |
| **MT-5** | **Theming + config per-request**: promote `data-tenant` from build-time → `TenantContext`-resolved; verify per-tenant bootstrap | promotion | two-way | FF-7 still byte-identical Geostat |
| **MT-6** | **Onboard tenant #2** (a real second agency) — the proof; **contract**: `tenant_id` `NOT NULL` once backfill proven | data commitment | one-way (NOT NULL) | two real tenants isolated; full FF suite green |
| **MT-7** | **Cleanup/contract**: drop legacy free-`TEXT` `agency` columns (DB-08 contract); retire single-tenant assumptions; (optional) `D-CAP` grant table when a 2nd plugin set is real | contract | one-way (drop cols) | grep-clean; no single-tenant remnant |

Phases MT-1→MT-3 and MT-5 are **two-way doors** — build freely. MT-4 is the enforcement flip (reversible policy, but the role change is the real hardening). MT-6/MT-7 carry the **irreversible** `NOT NULL` + column drops — gated on a *proven* second tenant.

---

## 5. One-way-door ledger (ranked by irreversibility; how each is de-risked)

| # | Door | Severity | De-risk |
|---|---|---|---|
| 1 | **POOL vs silo/bridge** | HIGH | The `tenant_id` FK seam is **model-agnostic** — one tenant can be promoted to BRIDGE/SILO later without the pool tenants moving (Protected Variations). We commit to POOL *as the default*, not *as the only* model. |
| 2 | **Backfill + `NOT NULL` + `FORCE` RLS** (the data commitment) | HIGH | Expand-contract: add **nullable** → backfill to a **default tenant** (Geostat) → `USING(true)` stays until MT-4 → flip is reversible → `NOT NULL` only at MT-6 after two real tenants proven. Nothing irreversible until the model is validated in production. |
| 3 | **tenant = agency identity** | MED-HIGH | Model `stats.agency` **first** (MT-1); `tenant_id` is a UUID **FK** (indirection), so the tenant↔agency binding is swappable; aligns with SDMX (agencies own structures) so the semantics are standard, not invented. |
| 4 | **JWT `tid` claim** | LOW | Additive, optional (Postel) — old tokens resolve to default tenant during the window; no flag day. |
| 5 | **Resolution authority (subdomain primary)** | LOW | Registry of strategies — add/reorder freely (two-way); the JWT claim remains the authority for writes regardless of host. |

---

## 6. Fitness functions (PROVE isolation — encode, don't comment)

These extend `ops/scripts/check-laws.sh` (schema-introspection + grep gates) and the real-Postgres test suite.

- **FF-1 · FF-TENANT-ISOLATION** *(integration)* — set GUC=A, assert every tenant-scoped table read returns 0 B-rows; a write with GUC=A and `tenant_id=B` is rejected by `WITH CHECK`. The positive proof.
- **FF-2 · FF-NO-CROSS-TENANT-LEAK** *(integration)* — bootstrap/catalog resolved to A never surfaces a B-authored page/nav/source/dataset (extends `bootstrap-parity.fitness.test.ts`).
- **FF-3 · FF-EVERY-TENANT-TABLE-HAS-RLS** *(introspection)* — for every table carrying `tenant_id`: `relrowsecurity = true` **AND** `relforcerowsecurity = true` (catches the owner-bypass trap, §1.1) **AND** a tenant-scoped policy exists. Fails CI on any tenant table missing `FORCE` or policy.
- **FF-4 · FF-TENANT-CLAIM-OR-HOST** *(integration)* — a tenant-scoped route with neither resolved host nor claim **fails closed** (no GUC ⇒ RLS returns 0 rows ⇒ explicit 400/403, never "all tenants").
- **FF-5 · FF-GUC-SET-LOCAL-ONLY** *(grep/AST)* — the tenant GUC is only ever `SET LOCAL` inside a transaction; **no** session-level `SET app.current_tenant` anywhere (the pgBouncer leak, §1.2).
- **FF-6 · FF-NO-TENANT-DIM-IN-ENGINE** *(grep, Law 1)* — `tenant` never appears as a cube dimension or privileged key in `packages/core`/`packages/react`; it lives only in the injected `TenantContext`/DB boundary (tenant is a scope, not a dimension).
- **FF-7 · FF-FIRST-TENANT-BYTE-IDENTICAL** *(parity)* — Geostat's bootstrap manifest + resolved token set are byte-identical pre/post every phase (extends `tokens.parity.test.ts` + `bootstrap-parity.fitness.test.ts`). The Strangler safety net.
- **FF-8 · FF-CATALOG-TENANT-SCOPED** *(integration)* — Constructor palette for A lists only A's datasets + A-granted capabilities.

---

## 7. How the field does it — steal the good, name what we beat

| Platform | Their mechanism | Cost / weakness | Where our generic seam is cleaner |
|---|---|---|---|
| **Grafana** | `org_id` FK on every table, threaded through every query in Go | **application-enforced** — a missed `WHERE org_id` leaks; re-implemented per subsystem | RLS is **declarative + below the port** — can't-forget; one policy, not N hand-written clauses |
| **Looker** | per-tenant connection/model, or `user_attributes` injected into SQL | a LookML model duplicated per tenant; heavy modeling | config **is data** — no per-tenant model duplication; the same `tenant_id` scopes model + data |
| **Tableau** | **Sites** (content isolation) + manual row-level calc filters | data row-security is hand-built per workbook | RLS isolates content **and** data through one SSOT |
| **Cube** | `securityContext` + `queryRewrite` injects tenant filters into compiled SQL; per-tenant pre-aggregations | imperative **query-rewrite** layer; closest to us | we get the same below the `DataStore` port via RLS — **no rewrite layer**, engine unaware |
| **Supabase/Postgres** | RLS + `auth.uid()` GUC pattern | the *correct* pattern — but apps often forget `FORCE` (owner bypass) and session-`SET` leaks under poolers | we **encode both traps as fitness functions** (FF-3, FF-5) — the pattern done airtight |
| **Auth0** | organizations + `org_id` claim | identity only — no data plane | our `tid` claim feeds the **same** GUC that drives the data plane — auth and data isolation share one path |

**The headline win:** every incumbent **privileged tenancy into one subsystem and bolted it onto the others.** We have *one* identity SSOT (**agency = SDMX maintenance agency**), *one* enforcement (**RLS below the `DataStore` port**), and *one* resolution primitive (**`TenantContext` at the boundary**) covering **all five planes** — because the platform already speaks generic-dimension / registry / config-as-data / port. Multi-tenancy is **cheap for us and a retrofit for them** for the same reason the Perspective Lattice is: we built neutrality first, and tenancy is just another scope resolved at a seam that already exists.

---

## 8. Rejected alternatives

- **A. Silo (DB per tenant) as the default.** Rejected: ×N migrations, ×N hypertables, ×N pools; fragments the cube and kills shared SDMX structure (shared DSDs, CL_GEO, AgencyScheme). Kept as a **per-tenant escape door** (door 1) for a high-isolation tenant.
- **B. `tenant_id` sprinkled defensively + application-enforced `WHERE`.** Rejected: this is exactly Grafana's failure mode — imperative, forgettable, re-implemented per subsystem; violates "declarative, logic in the enforcer." RLS makes isolation a **property**, not a discipline.
- **C. Tenant as a cube dimension (`ctx.dims['tenant']`).** Rejected: violates Law 1's *spirit* — tenant is a **boundary scope** (like locale), not a measured axis. Making it a dimension would thread it through the engine, the encoders, and every chart; FF-6 forbids it.
- **D. Defer the decision / ship more features first.** Rejected: `tenant_id` threading is the most invasive change a data platform can make *late*; the branch name already promises isolation. Deciding now (and backfilling Geostat as tenant 0) is strictly cheaper than retrofitting onto a feature-laden tree.
- **E. Stay single-tenant-per-deploy (agnostic is enough).** A legitimate alternative the owner has explicitly overruled (vision: hosted multi-agency). Documented so the decision is *explicit*, not implicit — if the hosted goal ever reverts to per-agency on-prem, MT-2→MT-7 are YAGNI and "agnostic" suffices.

---

## 9. Recommendation + effort/phasing

**Build it — POOL + RLS + agency-as-tenant — as a generic boundary scope, fitness-locked.** This raises the platform from *tool* to *platform* without lowering any existing bar: the engine stays pure (Law 1/3/5 untouched — **zero core changes**), isolation is declarative (Law 2 spirit — logic in the enforcer, not the config), and every invariant is a fitness function (evolutionary architecture).

**Effort (L overall; front-loaded on prerequisites, not the planes):**
- **MT-0** decision — **S** (this ADR + sign-off). *Now.*
- **MT-1** AgencyScheme — **S–M** (pairs with DB-08, already prioritized P2). *Unblocks everything; the quiet prerequisite.*
- **MT-2** expand columns + backfill — **M** (mechanical, additive, two-way).
- **MT-3** boundary (resolver registry + GUC + `tid` + `TenantContext`) — **M** (the one genuinely new subsystem; app-side, no core change).
- **MT-4** enforce (policy flip + `FORCE` + non-owner role) — **M** (small surface, high rigor; the two traps live here — FF-3/FF-5 are the guardrails).
- **MT-5** per-request theming/config — **S** (promotion of an existing seam).
- **MT-6/MT-7** onboard tenant #2 + contract — **M**, **gated on a real second agency** (don't `NOT NULL`/drop columns before the model is production-proven).

**Critical path:** MT-0 → **MT-1 (do this first — it is the SSOT prerequisite)** → MT-2 → MT-3 → **MT-4 (the airtight gate: `FORCE` + non-owner role + SET-LOCAL or the whole spine is a silent no-op)** → MT-5 → MT-6 (proof) → MT-7 (contract). Geostat stays byte-identical (tenant 0) at every step, guarded by FF-7.

**Sequence dependency:** ARCH-03 governance, ARCH-02 per-tenant SLOs, DB-19 tenant-scoped RBAC, and DB-21 agency-scoped rollups all **ride this seam** — they become cheap once `TenantContext` + RLS exist. Decide and build the spine before stacking them.
