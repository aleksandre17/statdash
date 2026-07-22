---
name: dev-tooling-conventions
description: "platform/eslint.config.js conventions (_-prefix, accepted react-refresh co-location warnings), Storybook v10 package-layout trap, and the panel/geostat tsconfig erasableSyntaxOnly+verbatimModuleSyntax constraints. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 3 sibling files (eslint-conventions, storybook-v10-setup,
> panel-tsconfig-constraints).

## ESLint conventions (`platform/eslint.config.js`)
- **`@typescript-eslint/no-unused-vars` with `argsIgnorePattern:'^_'`** (+ vars/caughtErrors/
  destructuredArray, `ignoreRestSiblings`). A leading `_` marks a binding REQUIRED by a signature
  but deliberately unused (engine renderer params `(_def,_ctx,_children)` fulfilling
  `NodeRenderer`, destructure-rest key drops). Genuine dead code without `_` is still reported. Do
  NOT add inline disables for unused vars — prefix `_` instead.
- **`react-refresh/only-export-components` warnings are ACCEPTED** for deliberate co-locations —
  context modules (Provider + `useXxx` in one file) and engine renderer modules (renderer const +
  internal control). Don't split cohesive files just to clear these; they're warnings not errors.
  `extraHOCs:['defineShell']` already exempts shell HOCs.
- The dependency arrow is enforced via per-layer `no-restricted-imports` (a build gate, must stay 0).

## Storybook resolves to v10 — the version-alignment trap
Lives in `platform/packages/react` (`packages/react/.storybook/`, run via
`pnpm --filter @statdash/react storybook`). Installing `storybook`+`@storybook/react-vite`
resolves to v10 — older-doc addon names DO NOT EXIST for v10:
- `@storybook/addon-essentials` — frozen at 8.6.14, its addons are BUILT INTO v10 core. Do not
  list it in `main.ts`.
- `@storybook/test` — renamed to the `storybook/test` subpath export.
Installing either pulls v8.6.x against v10 core → unmet-peer breakage.
**How to apply:** for autodocs/MDX use `@storybook/addon-docs` (the one separately-installed
addon). Import `Meta`/`StoryObj`/`Preview` from `@storybook/react-vite` (the framework package),
not `@storybook/react` (only a transitive dep). v10 backgrounds API =
`parameters.backgrounds.options` (keyed map) + `initialGlobals.backgrounds.value` (the legacy
`{default,values}` shape is deprecated); `docs.autodocs` config key is gone, the `autodocs` story
tag drives it now.

## tsconfig constraints — panel + geostat forbid parameter-properties, require import type
Both `apps/panel/tsconfig.json` and `apps/geostat/tsconfig.app.json` compile with
`erasableSyntaxOnly:true` + `verbatimModuleSyntax:true` (bundler-mode strictness — only erasable
TS syntax, explicit import elision).
**How to apply:**
- Do NOT use constructor parameter-properties (`constructor(public x:number)`) in either app's
  `src/` — declare the field then assign in the body.
- Type-only imports must use `import type {...}`.
- `import.meta.env` is already typed (`"types":["vite/client"]` set) — no `vite-env.d.ts` needed.
- Type-checking either app also pulls in `engine/`+`plugins/` sources (geostat's
  `tsconfig.app.json include` reaches `../../engine`), which emit their OWN pre-existing errors
  unrelated to app work — when validating, filter `tsc -b` output to `src/...` and exclude
  `../../engine/`.
