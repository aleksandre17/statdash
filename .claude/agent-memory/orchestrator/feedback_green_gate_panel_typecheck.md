---
name: green-gate-panel-typecheck
description: The orchestrator green-gate MUST include the panel typecheck (tsc -b apps/panel), not just geostat — they are separate tsconfig graphs and parallel agents miss cross-app type breaks
metadata:
  type: feedback
---

The root `pnpm typecheck` script compiles ONLY geostat (`tsc -b apps/geostat/tsconfig.app.json --noEmit`). `apps/panel` is a SEPARATE tsconfig graph; its typecheck is `tsc -b apps/panel` (its `build` = `tsc -b && vite build`). So a green `pnpm typecheck` says NOTHING about the panel.

**Why:** 2026-06-27 night, two parallel agents (engine-cleanup + i18n) each self-verified green in their own scope, but their combination broke the panel: an i18n agent put a `{ka,en}` LocaleString into `PerspectiveOption.label` (intentionally a plain resolved `string` — localize-at-boundary). `pnpm typecheck` (geostat, which does not compile apps/panel) stayed green; only `tsc -b apps/panel` caught the 2× TS2322. A classic parallel-interleave defect: individually green, combined red.

**How to apply:** the orchestrator green-gate before any commit is `build:engine · typecheck (geostat) · tsc -b apps/panel · lint · check-laws · test`. Add the panel typecheck explicitly — it is the gap neither agent's self-verify covers. Sibling of the standing "ALWAYS include pnpm lint" rule. When agents work in parallel on the engine type layer AND its panel consumers, expect exactly this class of break and gate for it. See [[parallel-interleave-false-alarms]] — but note this one was a REAL break, not a transient.
