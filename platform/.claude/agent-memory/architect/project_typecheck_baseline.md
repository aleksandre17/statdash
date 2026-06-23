---
name: typecheck-baseline
description: The real typecheck gate for statdash-platform is `tsc -b` from apps/geostat, NOT root `tsc --noEmit` (false green). Baseline is now GREEN (0 errors) as of 2026-06-17.
metadata:
  type: project
---

The verification command `npx tsc --noEmit` at `platform/` root returns EXIT 0 but checks NOTHING: root `tsconfig.json` has `"files": []` + project `references` only, and without `--build` the referenced projects are skipped. It is a false green.

**The real typecheck** is `tsc -b` (build mode), run from `apps/geostat` (its `build` script = `tsc -b && vite build`). Engine packages (`engine/core`, `engine/react`, `engine/plugins`, `engine/charts`) have NO tsconfig of their own; they are pulled into the app graph via `tsconfig.app.json` `"include": ["src", "../../engine"]`.

**BASELINE IS NOW GREEN.** As of 2026-06-17, both `cd apps/geostat && npx tsc -b` AND `npx tsc -b tsconfig.app.json --noEmit` return EXIT 0 / 0 errors. The previously-recorded ~293-error baseline (TS2307 module resolution, TS1294 erasableSyntaxOnly enums, TS2308 registry barrel collisions, TS2345/TS2488 transform StepFn drift) is NO LONGER observed — it was either reconciled or was a config-state artifact. Do not assume a RED baseline; verify by running the command.

**Runtime truth is GREEN:** `npx vitest run engine/react` = 23 suites / 275 tests passing. NOTE: 3 suites (`auth.test.ts`, `a11y.test.tsx`, `targets/buildStaticContext.test.ts`) fail to LOAD with `Could not resolve "i18next"` — an unresolved optional peer-dep at the vite resolution layer, NOT a logic/type failure. They die at import before any test body runs. Treat these 3 as a known environmental failure, not a regression signal. See [[vite-resolution]].

**Why:** Baseline re-measured during the 2026-06-17 open-UIRegistry implementation; observed 0 errors directly, contradicting the prior RED record.
**How to apply:** Never trust root `tsc --noEmit` as the gate — run `cd apps/geostat && npx tsc -b`. The baseline is clean now, so a non-zero count after your edit means YOUR edit. The i18next suite-load failures are pre-existing — exclude them when judging whether tests regressed. See [[deferred-framework-seams]].
