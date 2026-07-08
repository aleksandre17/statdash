---
name: node-env-test-imports
description: In @vitest-environment node, @statdash/react sub-path imports and @statdash/engine fail because dist/ doesn't exist — avoid Shell imports in node-env tests
metadata:
  type: feedback
---

In `@vitest-environment node`, Vite uses conditions `["node", "development", "import"]`. The `@statdash/*` packages have `"import": "./dist/index.js"` which doesn't exist in dev (no build step). The `"source": "./src/index.ts"` condition is NOT matched in node env — only browser env gets `source` from the vitest config's `conditions` array.

This causes two failure classes:
- `@statdash/engine` bare import → "Failed to resolve entry for package" (dist doesn't exist)
- `@statdash/react/engine` sub-path → `"./engine" is not exported under conditions ["node", "development", "import"]` (sub-path not in package.json exports)

**Why:** `packages/plugins/panels/chart/default/annotationUtils.test.ts` has been failing pre-existing with the same issue. Node-env test files pick up node conditions from `@vitest-environment node` regardless of the surrounding project config.

**How to apply:** In `packages/plugins` test files using `@vitest-environment node`:
- Do NOT import from `@statdash/react/engine` (sub-path)
- Do NOT import Shell components that transitively import from `@statdash/react/engine`
- DO test pure utilities (topologyRegistry, mapColorUtils, etc.) directly
- DO test shell logic by testing the decision data (what the shell computes), not the shell call itself
- Mark in test comment: "shell import omitted — see pre-existing annotationUtils.test.ts limitation"
