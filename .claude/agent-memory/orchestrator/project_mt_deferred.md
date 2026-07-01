---
name: mt-decision-deferred
description: Multi-tenancy SaaS decision DEFERRED by owner — finish everything else to reference-grade first, then migrate to multi-site later via the preserved seam
metadata:
  type: project
---

Owner decision (2026-07-01): **DEFER multi-tenancy.** Take everything else to the highest concept/architecture first (reference-grade), THEN migrate to multi-tenant / multi-site.

**Why:** Multi-tenancy (SaaS/POOL) is the single genuine one-way door (data plane). Both seniors (architect ADR-multi-tenancy + database-architect RED-TEAM `DESIGN-multi-tenancy-final.md`) ratified SaaS-POOL as the correct + *surpassing* model and confirmed it's cheap here (config-is-data + tenant-as-boundary-scope → one `tenant_id`+one RLS isolates 5 planes, ZERO core/react change). But it's an L build + a permanent isolation-discipline tax. Owner wants the single-tenant platform perfected first; the Strangler seam makes "add later" cheap (additive nullable `tenant_id`, `USING(true)` today → `FORCE`-flip only after a 2nd tenant proven in STAGING).

**How to apply:**
- Do NOT launch MT-1…MT-7 build lanes until the owner re-opens this. `ADR-multi-tenancy.md` stays PROPOSED/unsigned.
- **PRESERVE THE SEAM — do not degrade it:** keep the V6 nullable `stats.dataset.tenant_id` + `USING(true)` RLS; don't let any refactor rip out the tenant seam or the `[data-tenant]` theming hook. Tenant must stay a boundary scope, never `ctx.dims['tenant']` (Law 1 / FF-6).
- Branch name `feat/tenant-agnostic-platform` over-promises isolation; harmless (agnostic ≠ isolated is documented in CLOSE-BOARD). Don't "fix" by building MT.
- Current focus = CLOSE-BOARD PART 1 remaining work MINUS MT: styles/responsive/sizing (Lane A), TM-STRANGLER (Lane B), then RX-16 map consolidation, grain G4/G5/G6, RSP remainder, perspective-lattice crown, geomode-axis, i18n-render polish, SDMX DQAF/REST (judge need). See [[verify-board-empirically]].
