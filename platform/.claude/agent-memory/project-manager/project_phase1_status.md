---
name: project-phase1-status
description: Phase-1 completion state — almost all roadmap moves shipped; the real open gap is the live ApiStore
metadata:
  type: project
---

As of 2026-06-22, statdash-platform Phase 1 is feature-complete against its own audits:
N34–N44 and JSON-target gaps G1–G10 are shipped (per IMPLEMENTATION-ROADMAP.md "Shipped" sections, verified in code). geostat + api tsc build clean. 572 tests pass.

**The real remaining Priority-1 gap is the live data path, not features:**
- `ApiStore` (engine/core/src/data/store-impl.ts) is effectively dead code against the real API: its `prefetch()` POSTs to `/indicators/values`, an endpoint that does NOT exist (api only has /stats/classifiers, /datasets, /observations). It also has no `queryAsync`, so it never joined the N34 async contract.
- Frontend `stats` mode (site-manifest.ts fetchStats) does NOT use ApiStore — it eagerly fetches ALL observations per dataset into an in-memory ExternalStore. No per-panel queries, no pagination, whole-cube client load.
- `verify-parity.ts` is a fail-fast STUB (Phase1 ExternalStore vs Phase2 ApiStore parity) — comparators written, not wired to a live store.

**Why:** national-accounts data is small and static, so ExternalStore works today; but a true live/large/governed deployment needs the async REST ApiStore the N34 contract was built for.

**How to apply:** when the user asks "what's left for Phase 1 production", lead with: live ApiStore (queryAsync + real observations endpoint + per-panel/paginated reads), wire verify-parity as a CI gate, and pagination enforcement (G6, deferred until ApiStore lands). Also a test-hygiene gap: 3 engine/react suites fail at import because they pull SiteContext→i18next without mocking it (mock pattern in tokens.test.ts).
