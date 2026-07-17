---
name: project-gate-panel-flake
description: Full-graph `pnpm test` can false-RED on a panel StyleSurface timeout flake; verify heavy panel React tests in isolation before treating as a real failure
metadata:
  type: project
---

Running the whole-graph gate (`pnpm test` from `platform/`, a single Vitest run
over all `test.projects`) can report **1 failed** in
`apps/panel/src/studio/surfaces/StyleSurface.test.tsx` — a **5000ms testTimeout**,
NOT a logic failure. The test's isolated import alone is ~6.25s; under full-suite
CPU contention the heavy React render (jsdom `getContext`/`getComputedStyle`
not-implemented noise) blows the 5s `testTimeout`.

**Why:** a core-engine change must run the WHOLE graph (a core change ripples up),
but the aggregate Vitest reporter only prints per-file lines for FAILURES and one
aggregate `Tests` line — so a contention flake looks like a real red.

**How to apply:** before treating a panel React-render failure as real, re-run it
in isolation — `pnpm exec vitest run --project=@statdash/panel <file>` — or run the
whole panel project alone (`--project=@statdash/panel`); reduced contention clears
the flake. This is the *false-RED* dual of the [[project-gate-false-green-tsc]]
false-GREEN hazard the gate protocol already warns about. Project vitest names:
core=`@statdash/engine`, geostat=`national-accounts`; `packages/expr` has zero test
files (contributes 0, not a failure).
