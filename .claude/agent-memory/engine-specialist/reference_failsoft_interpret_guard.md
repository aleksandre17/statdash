---
name: failsoft-interpret-guard
description: Per-node interpreters must be Postel-tolerant of an absent optional config input — return empty, never hard-throw into NodeErrorBoundary (engine twin of chrome fail-soft)
metadata:
  type: reference
---

**Rule:** a per-node interpreter entry point (called once per node by the render
pipeline) must tolerate an absent/empty optional config input by returning an EMPTY
result (the shell then renders its empty state), NOT by hard-throwing. A raw
`.filter`/`.map`/`for..of` on an OPTIONAL-but-runtime-absent field crashes the node
into `NodeErrorBoundary`'s fallback card in a real browser while jsdom/unit suites
stay green (they always pass the field) — the "green ≠ works" class.

**The seam (kpi.ts):** BOTH public `@statdash/engine` per-node KPI entries guard
`specs ?? []` — the render twin `interpretKpis` and the warm twin
`extractKpiRequirements`. Guarding both preserves warm === render at the empty
boundary (a spec-less kpi-strip warms nothing AND renders nothing). `items` is
REQUIRED by `KpiStripNode`, but a hand-authored / API-hydrated node-config may omit
it — the guard lives at the untyped JSON boundary, signature unchanged (no
architect escalation: same-sig runtime tolerance, not a contract change).

**This class has bitten twice** — the direct twin is the chrome shell:
`useChromeConfig() ?? EMPTY_CHROME_CONFIG` (packages/react, [[chrome-failsoft-chromeconfig]]
in plugins-specialist). When you touch ANY interpret-per-node path, scan for the
same class. Already-clean exemplars in kpi.ts: `spec.trend ?`, `spec.unit ?`,
`if (!spec.when)`, `withFilter(filter?)`, `coordIsPreliminary` try/catch.

**Out of the class (do NOT guess-guard):** REQUIRED-by-type fields (`spec.value`,
the `expr` variant's `codes`) — a config omitting them is a validate-config
structural concern, not runtime fail-soft. Regression net:
`packages/core/src/data/kpi-specless-failsoft.fitness.test.ts`.
