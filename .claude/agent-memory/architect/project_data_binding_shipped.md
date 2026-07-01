---
name: data-binding-shipped
description: VERIFIED-IN-CODE (2026-06-26) — the data-source-binding architecture proposed across four prior ADRs is now IMPLEMENTED, not aspirational. The old 3 variants (LOCAL/HREF/storeId) are unified as 3 store KINDS behind one DataStore port; the semantic layer (metric→store) and declarative cross-store blend also shipped. Future "should we evolve the storeId system?" questions = mostly already done; the open work is ADOPTION not architecture.
metadata:
  type: project
---

# Data-binding architecture — SHIPPED (the prior ADRs are now code)

**Fact (verified in repo 2026-06-26, not from memory).** The data-source-binding evolution proposed across
[[adr-data-source-reference-spectrum]], [[adr-data-reference-render-vision]], [[multistore-storeid-reintroduction]],
and [[adr-data-blending-decision]] is **implemented in code**. The old three variants the user remembers
(LOCAL/inline, HREF/url, storeId/query+pipe) are now **three KINDS behind one `DataStore` port**:
- `static` kind (LOCAL) — `packages/plugins/datasources/static-registrations.ts:119` (`ExternalStore` from `params.values`)
- `href` kind (HREF) — `href-registrations.ts:351` — D-HREF **OPENED** with format-parser + auth-strategy OCP registries + default-safe SSRF allowlist (`params.allowedOrigins`/`VITE_HREF_ALLOWED_ORIGINS`)
- `stats` kind (storeId) — `stats-registrations.ts:98` (live cube + CachedStore)

Plus two capabilities the old system never had, both wired:
- **Semantic layer / metric→store:** `core/data/metric.ts` (`resolveMeasureRef`, `MetricDef.dataSource`) + `core/data/metric-store.ts` (`specDataSource`) — the Cube.dev `dataSource`-on-measure pattern (R1/M1).
- **Declarative cross-store blend:** `core/data/transform/types.ts:304` + `react/engine/resolveNodeRows.ts` (`resolveBlends`, desugars to `joinByField`) — Tableau/Grafana-Mixed (blending ADR B0–B2).

**Why:** the architect ADRs (June 2026) recommended exactly this; it got built since. Several earlier ADR
memories still say "PROPOSED" / "DEFER href behind D-HREF" — that status is now **stale** for the shipped parts.

**How to apply:** When the user asks "which data-binding architecture is better / did we lose the 3 variants?"
the answer = the current one (3 kinds, 1 port + semantic layer + blend) is better AND more complete; nothing
lost. Do NOT propose re-architecting. The genuinely-open work is **adoption** (use metric refs instead of raw
codes across seeded cubes; author a real 2-store page that blends gdp+regional on `time`), guarded by existing
fitness fns (FF-STATIC-KIND, FF-SOURCE-KIND-CLOSED, FF-NO-FETCH-IN-CONFIG, FF-METRIC-FLOWS, FF-BLEND-*). Still
correctly deferred behind `D3-PLANNER`: symmetric N-store query planner / server-side join / pushdown. Full
write-up: `work/RESEARCH-data-binding-architecture.md`. Always re-verify the registered kinds before asserting
(grep `registerStoreBuilder(` in `packages/plugins/datasources/`) — they may grow.
