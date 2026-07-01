---
name: eslint-conventions
description: platform/eslint.config.js conventions — _-prefix unused-var ignore, react-refresh co-location warnings are accepted
metadata:
  type: project
---

`platform/eslint.config.js` global rules encode two deliberate conventions:

- **`@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'`** (also vars/caughtErrors/destructuredArray + `ignoreRestSiblings`). A leading `_` marks a binding REQUIRED by a signature but deliberately unused — chiefly engine renderer params `(_def, _ctx, _children)` fulfilling the `NodeRenderer` contract, and destructure-rest key drops (`const { type: _, ...rest }`). Genuine dead code (no `_`) is still reported.
  - **Why:** ~45 of the lint-debt "unused" errors were interface-required `_` params. Encoding the existing convention (standards-as-code) is the root fix, not per-line disables.
  - **How to apply:** to silence an intentional unused param, prefix `_`. Do NOT add inline disables for unused vars.

- **`react-refresh/only-export-components` warnings are ACCEPTED for deliberate co-locations** — context modules (Provider + `useXxx` hooks in one file, the canonical React pattern) and engine renderer modules (renderer const + internal control component). ~35 such warnings are the steady-state residual; fixing them would fragment cohesive modules against the architecture. `extraHOCs: ['defineShell']` already exempts shell HOCs.
  - **How to apply:** don't split context/renderer files just to clear these. They are warnings, not errors. Only act if a NEW co-location is cheaply avoidable.

The eslint config also enforces the **dependency arrow** via per-layer `no-restricted-imports` (build gate, must stay 0). See [[panel_tsconfig_constraints]].
