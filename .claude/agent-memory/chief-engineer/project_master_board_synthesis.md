---
name: master-board-synthesis
description: 2026-06-27 authoritative synthesis of 6 domain boards into work/MASTER-BOARD.md — the multi-tenancy fork, adoption-debt pattern, and meta-fitness invariant
metadata:
  type: project
---

# Master Board synthesis (2026-06-27)

Merged six parallel senior domain boards (engine/react/constructor/backend/database/architecture-vision, ~108 cards) into `work/MASTER-BOARD.md`. Successor to [[project_ship_readiness]] and [[project_finish_line_recon]]. **Frozen snapshot** — for current state prefer `git log` + reading code; verify any card before acting.

**Verdict:** planned roadmap essentially built + fitness-locked to a high standard. Remaining work is three unfinished *commitments*, not architecture defects:
1. **One undecided one-way fork — multi-tenancy.** Branch `feat/tenant-agnostic-platform` delivers *agnostic* (rebrandable single-tenant), NOT *isolated*. Verified: only `tenant_id` in 35 migrations is the V6 placeholder on `stats.dataset` under `USING(true)` RLS. P0-DECISION (USER): per-deploy vs SaaS. Gates DB-08 agency, RBAC scoping, JWT claim, per-request theming, governance.
2. **Adoption debt ("cathedrals without congregations").** Semantic layer (ENG-05) fully built+wired, ZERO prod consumers — verified `registerMetric` only in tests, `apps/geostat/src/data/metrics.ts` doesn't exist. Nuance: `VISION-...v3-PLAN.md:265` shows this was a *conscious deferral* ("optional, not a blocker"), not an oversight. Also ENG-06/08/10/16, multistore M0-M2, N26 (97 raw codes). Antidote = one meta-fitness: "no registered/authorable capability without a runtime consumer or explicit shrinking deferred-list."
3. **Operational/security/a11y floor** that green CI masks: API rate-limit=0, no request-id/metrics, in-memory audit+snapshot (die on restart/deploy), datasource secret leak to anon boot; real plugin shells have zero axe gates; perspective-bar keyboard-broken; no prefers-reduced-motion; ~20 node files single-locale labels (i18n drift).

**Genuine correctness defects (not missing features):** ENG-10 `scope.metric` authorable+persists+validates but does nothing at runtime (verified — runtime folds only `timeBinding`); API-02 ingest worker crash strands `parsing` rows; RX-16 two map node types (Law-6 dup).

**Innovation crown (build-next):** Perspective Lattice (ARCH-INNOV-01) — N orthogonal axes → 2^N permalink views, rides the just-shipped `perspectiveState` seam. Caveat I flagged: build it WITH a real vintage-toggle consumer (V25 models vintage) or it becomes adoption-debt itself. Runner-up: coverage-complete Constructor fitness (cheapest, is the meta-fitness for theme #2).

**Overseer honesty calls logged:** ARCH "~46 DONE" over-counts (mechanism-only items rounded up); CON "0 NOT-DONE" elides latent i18n GAPs + one-way migration-runner debt; engine count line internally inconsistent. Per-card detail sound.
