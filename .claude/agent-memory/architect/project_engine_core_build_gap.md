---
name: engine-core-build-gap
description: engine/core is a dist-pointing publishable package but has NO tsconfig + empty dist + undeclared @geostat/expr dep — only bundler apps consume it (from source). Node consumers (apps/api) break.
metadata:
  type: project
---

`engine/core` is configured as a publishable dist package (`package.json`: `files:["dist"]`, exports/types/main point at `./dist/index.*`) but in this tree it has **no `tsconfig.json` and an empty/absent `dist/`**, and its `package.json` declares **no `dependencies`** — even though `engine/core/src/index.ts` (~line 197) does a runtime `import { registerExprOp } from '@geostat/expr'` and registers 7 filter-derive ops as an import-time side-effect (lines ~197-216).

Consequence: every consumer to date is `apps/geostat` (Vite, `moduleResolution: bundler`), which compiles engine **from source** via root + app `tsconfig` `paths` (`@geostat/engine → ../../engine/core/src/index.ts`) and `include: ["../../engine"]`. That hides both gaps. Any **Node/NodeNext** consumer (`apps/api`, runs under tsx, builds `tsc -p` to dist, Dockerized) resolving `@geostat/engine` via package exports finds a dangling dist and, if built standalone, fails on the undeclared `@geostat/expr` bare specifier. This is the "@geostat/expr dist-resolution issue."

**Why:** core was source-resolved by the only consumer (a bundler app), so the dist build path was never exercised. Not a cycle (expr is zero-dep, does not import core) and not CI flake — a missing dependency declaration + missing build config.

**How to apply:** Before any Node-tier package imports `@geostat/engine` values: (1) add `"@geostat/expr": "workspace:*"` to `engine/core/package.json` dependencies; (2) create `engine/core/tsconfig.json` (NodeNext emit, declaration:true, outDir dist); (3) build expr then core; (4) consumer declares `@geostat/engine: workspace:*`. Do NOT use source `paths` for a Node service — the barrel's import-time `registerExprOp` side-effect drags the full engine value graph + expr into the process. Barrel is NOT tree-shakeable for non-bundler consumers; a deep entry (`@geostat/engine/config`) is the deferred seam if a minimal Node surface is ever needed. See [[project_platform_layout]], [[project_deferred_framework_seams]].
