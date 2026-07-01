---
name: expr-bundler-agnostic-env
description: @statdash/expr is zero-dep + bundler-agnostic; never use process.env, vite/client ambients, or global ImportMeta augmentation for its dev flag
metadata:
  type: project
---

`@statdash/expr` (platform/packages/expr) is a zero-dep, bundler-agnostic pure-TS package with its OWN standalone `tsup index.ts --format esm --dts` build (no Vite, no Node types in scope).

Dev-only diagnostics there must read the dev flag via a self-contained local cast, NOT via:
- `process.env.NODE_ENV` — Node-ism, undefined in browser, needs @types/node.
- `import.meta.env.DEV` bare — needs `vite/client` ambient types, absent in the package's own tsup --dts build (TS2339 "Property 'env' does not exist on type 'ImportMeta'").
- a global `interface ImportMeta { env?: ... }` ambient `.d.ts` — LEAKS through the `@statdash/expr/src/*` path alias into the consuming apps' type graph and WEAKENS their `import.meta.env` (every app-side `import.meta.env.X` becomes "possibly undefined", TS2532). Declaration merging on a global interface from a shared package is not scoped.

Correct pattern (in derive.ts): `function isDevMode(){ const env = (import.meta as { env?: { DEV?: boolean } }).env; return env?.DEV === true }`. Local cast, no global augmentation — Vite still statically replaces DEV; other bundlers read falsy and the branch is dead-stripped.

**Why:** found while making the platform typecheck-build green (param-properties + leaflet + process fixes). The first two attempts (bare import.meta.env, then a global env.d.ts) each broke a different build.
**How to apply:** any time you add an env/dev-flag check inside packages/expr (or any package with its own bundler-less tsup --dts build that is also path-aliased into apps). The general engine convention elsewhere (packages/core, packages/react) is `import.meta.env.DEV` because those run only through Vite — see [[law4_i18n_check]] siblings.

Note: `build:engine` (`pnpm -r --filter ./packages/* build`) is pre-existing RED independent of this — packages/core's standalone dts build fails with TS7016 on `@statdash/expr` when expr's dist .d.ts is stale. It is NOT one of the platform's green gates (build / typecheck / test / lint are).
