---
id: "0083"
title: "CANVAS CTX BOOT DIVERGENCE — no-param studio entry renders a lying coordinate (persistent KPI no-data)"
status: RESOLVED (2026-07-18, debugger root-traced + fixed — commit a84ab3a on main)
class: M
priority: P0
owner: lead (diagnosis) → debugger (root trace + fix — DONE)
implements: Canon C2 (the canvas never lies) + Law 9 (URL = state SSOT) — violated on one boot path
links:
  - platform/e2e/probes/probe-0081-replica.mjs      # REPRODUCES: no-param entry → persistent no-data
  - platform/e2e/probes/probe-bind-transient.mjs     # HEALTHY: ?page=regional entry → values at 1.5s AND 6s
  - platform/apps/panel/src/studio/StudioShell.tsx   # Effect A/B page-param binding (looks sound; ctx init is the suspect)
---
**The deterministic boundary (lead, instrumented, 2026-07-18 00:0x):**
- `goto /` → login → `goto /studio/insert` (NO param; app appends `?page=regional` itself via Effect B) → **ALL canvas KPI cards render "მონაცემი არ არის" PERSISTENTLY** (1.5s AND 6.5s — not transient).
- `goto /studio/insert?page=regional` (param at boot) → all four KPIs render real values (80 979 · +15.1% · 100.0 · 10.7), zero console errors, at both timings.
- Same final URL, same active page, same api, same data both ways. Obs WIRES on the healthy path are byte-identical to the portal's. The divergence is INTERNAL ctx/default initialization order, boot-path-dependent.
- Bind gesture is IRRELEVANT (earlier suspicion falsified — bind works and leaves KPIs healthy on the param path).

**Eliminated by instrumentation:** metric registry (palette via describeApp = populated; governed ref lowers to raw code on the wire live) · storeGenId fold (present in useKpiRows) · filter.measure corruption (fixed b544819, reprovisioned) · stale panel src (synced, md5-verified) · transient loading window (persists at 6.5s).

**Suspect class (memory: debugger/async-store traps #10):** section-ctx filter DEFAULTS (e.g. year) resolving through an async options source during the no-param boot — loading-vs-empty hole → a dim resolves ''/0 → point-read coordinate wrong → honest no-data forever (no re-resolution). The no-param path mounts the canvas BEFORE Effect B settles the URL; the param path mounts with the page known. Find where canvas section ctx defaults resolve relative to page activation, and make BOTH boot paths flow through ONE initialization sequence (root fix — never a re-render kick).

**DoD:** replica probe prints VALUES on the no-param path · both probes green at 1.5s · panel gate (vitest parsed + lint + tsc -b apps/panel) · a fitness test pinning one-init-path (both entries produce identical resolved ctx) · synced to dev + live-verified.

---

**RESOLUTION (debugger, 2026-07-18) — the "boot-path divergence" was FALSIFIED, not fixed as one.**

Reproduced `probe-0081-replica.mjs` live (no-data, confirmed). Then isolated by removing
one variable at a time:
1. No-param entry with **zero clicks** → already healthy (real values at 1.5s AND 6.5s).
   This falsifies any ctx/filter-default init-order race relative to page activation —
   there is no boot-path divergence in section-ctx resolution; Effect A/B settle
   identically either way, exactly as `StudioShell.tsx` documents.
2. The EXACT SAME click sequence as `probe-0081-replica.mjs`, run against the "healthy"
   `?page=regional` direct-entry path, reproduced the IDENTICAL corruption. This falsifies
   "bind gesture is irrelevant" / any boot-path specificity of the bind.
3. Root cause: `packages/plugins/panels/kpi-strip/default/meta.ts` falsely declared the
   `data-bindable` cap (copy-pasted from chart/table/geograph, which genuinely own a
   `data: DataSpec` field). This mounted the Inspector's generic Data facet for a
   kpi-strip selection; binding a metric there wrote a stray `node.data` the shell never
   reads, but the engine's generic `effectiveStoreKey` (renderNode.ts) DOES walk any
   node's `.data` to route `ctx.pageStoreKey` — silently rerouting the WHOLE strip's
   store to the bound metric's dataSource, corrupting every sibling KPI card's read to
   the wrong cube (own raw code, wrong dataset → 0 rows → the honest no-data state seen
   on screen).
4. Why it LOOKED boot-path-dependent: the two reproducer probes' canvas-node selectors
   differ in breadth — `probe-0081-replica.mjs` matches `[data-node-type="chart"],
   [data-node-type="kpi-strip"]` and `.first()` picks the kpi-strip (renders above any
   chart); `probe-bind-transient.mjs` matches `[data-node-type="chart"]` only (a
   legitimately data-bindable node) — an incidental selector difference, not a ctx-timing
   one.

**Fix:** removed the false `data-bindable` cap (one line, `meta.ts`). Guards:
`packages/plugins/panels/kpi-strip/default/storeRoutingIntegrity.fitness.test.ts` (new) +
corrected the same false assumption baked into
`apps/panel/src/inspector/facetProjection.fitness.test.ts`. Full trace + the panel
dev-container `packages/*` bake-in gap (no live sync path — needed `docker cp` + restart
to verify live):
`.claude/agent-memory/debugger/project_kpistrip_data_bindable_misdiagnosis.md`.

**Verified live** (both probes, post-fix, container restarted): `probe-0081-replica.mjs`
now prints values at 1.5s AND 6.5s; `probe-bind-transient.mjs` stays green. Gates:
`packages/plugins` vitest 77/77 files · `apps/panel` vitest 134/134 files (978 tests) ·
`tsc -b apps/geostat/tsconfig.app.json --noEmit` clean · `eslint` clean on all
changed/new files (the 20 pre-existing `apps/panel` lint errors in
`packages/plugins/panels/chart/default/components/ApexRenderer.tsx` are baseline,
unrelated to this change — untouched). Committed `a84ab3a` on `main`, pushed.

No `data-pipeline`/architectural seam change was made — the root cause was a
capability-declaration bug (a `caps` lie), not a missing engine mechanism, so no new seam
was required.
