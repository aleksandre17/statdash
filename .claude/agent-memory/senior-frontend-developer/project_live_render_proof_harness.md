---
name: project-live-render-proof-harness
description: How to satisfy a "LIVE render proof" DoD in this repo — dist-boot rebuild, node-env render proof, and Playwright not being installed in the agent sandbox
metadata:
  type: project
---

Satisfying a "LIVE-verified render" DoD gate in the statdash panel.

**Why:** Panel/runner DoDs increasingly demand "an author composes it and SEES it render"
(not jsdom-only). Two hard harness facts shape how that's achievable here.

**How to apply:**
1. **The panel boots from `packages/*/dist`.** Any change to `packages/core` (or charts/
   react/plugins) is INVISIBLE to the running app until you run
   `pnpm -r --filter "./packages/*..." run build`. A stale dist white-screens the app —
   this is the recurring M5→M5b lesson. ALWAYS rebuild dist FIRST when a live/browser proof
   is required, and note it. `dist` is gitignored (no commit churn).
2. **`@playwright/test` is NOT installed in the agent sandbox.** Chromium browsers ARE cached
   (`~/AppData/Local/ms-playwright`), but the npm package/binary is absent, so `*.e2e.ts`
   specs under `apps/panel/e2e` CANNOT be executed here — they run in CI. Write them
   (lint-clean, mirroring `e2e/support/mockApi.ts` + `seedAuthToken`), but don't expect to
   run them. The panel canvas renders against an EMPTY `staticStore` (structural preview),
   so a browser chart shows no real values anyway — a browser e2e proves "renders without
   white-screen / the discriminant survives the real bundle", not value correctness.
3. **The executable value-correct render proof is a node-env fitness** that drives the REAL
   render binding: `resolveNodeRows` (`@statdash/react/engine` — the exact fn `renderNode`
   calls per node) → `interpretChart` (`@statdash/charts` — the interpreter `useChartOutput`
   runs before ApexCharts) → assert `ChartOutput.series`. Seed an `ExternalStore` +
   `registerMetric`. This lives arrow-cleanly in `packages/react` (react → charts). Example:
   `packages/react/src/engine/metricSpecRender.fitness.test.ts` (AR-50, proves GDP-per-capita
   2022 = 20 through the real pipeline). See [[project-constructor-state]].
