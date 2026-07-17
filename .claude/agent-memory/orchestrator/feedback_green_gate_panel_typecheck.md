---
name: green-gate-panel-typecheck
description: The orchestrator green-gate MUST include the panel typecheck (tsc -b apps/panel), not just geostat — they are separate tsconfig graphs and parallel agents miss cross-app type breaks
metadata:
  type: feedback
---

The root `pnpm typecheck` script compiles ONLY geostat (`tsc -b apps/geostat/tsconfig.app.json --noEmit`). `apps/panel` is a SEPARATE tsconfig graph; its typecheck is `tsc -b apps/panel` (its `build` = `tsc -b && vite build`). So a green `pnpm typecheck` says NOTHING about the panel.

**Why:** 2026-06-27 night, two parallel agents (engine-cleanup + i18n) each self-verified green in their own scope, but their combination broke the panel: an i18n agent put a `{ka,en}` LocaleString into `PerspectiveOption.label` (intentionally a plain resolved `string` — localize-at-boundary). `pnpm typecheck` (geostat, which does not compile apps/panel) stayed green; only `tsc -b apps/panel` caught the 2× TS2322. A classic parallel-interleave defect: individually green, combined red.

**How to apply:** the orchestrator green-gate before any commit is `build:engine · typecheck (geostat) · tsc -b apps/panel · lint · check-laws · test`. Add the panel typecheck explicitly — it is the gap neither agent's self-verify covers. Sibling of the standing "ALWAYS include pnpm lint" rule. When agents work in parallel on the engine type layer AND its panel consumers, expect exactly this class of break and gate for it. See [[parallel-interleave-false-alarms]] — but note this one was a REAL break, not a transient.

**THIRD GAP (2026-07-16, proven again):** `tsc -b apps/panel` AND `pnpm typecheck` (geostat) BOTH miss type errors in `packages/plugins` **test files** — only the FULL root `tsc -b` (all referenced projects, incl. plugins `*.fitness.test.ts`) catches them. The B1 grid work landed a `defineSchema()` literal-narrowing break in `grid.fitness.test.ts` (TS2345/TS2339 on `.field`/`.plane`); the agent's `tsc -b apps/panel` was green, so it slipped — caught only when a LATER agent ran full `tsc -b`. **Rule: when an agent touches `packages/*` (esp. a fitness test), the gate MUST run the full `tsc -b`, not just `tsc -b apps/panel`.** An agent reporting "tsc clean" on the panel scope is NOT proof the plugins/engine test graph typechecks. Instrument agent briefs accordingly.

**FOURTH GAP (2026-07-16, bit on the dev SERVER):** vitest + lint + every tsc leg ALL miss **production `vite build` breaks** — postcss/CSS is outside every one of them. New package CSS using `@layer components` built fine everywhere locally, then killed the geostat image build on the server (Tailwind v3 postcss hijacks that reserved layer name per-file; panel has no Tailwind so it never showed). **Rule: when a change adds/renames package CSS or touches anything an app's vite/postcss pipeline processes, the gate MUST include the consuming app's production build (`pnpm --filter national-accounts build`, and panel's when relevant).** Deploy-blocking class: only a real `vite build` proves it. (Layer names in package CSS: never Tailwind-reserved names — use `sd-*`.)
