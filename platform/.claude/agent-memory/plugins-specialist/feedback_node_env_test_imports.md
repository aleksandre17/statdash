---
name: node-env-test-imports
description: In @vitest-environment node, @geostat/react sub-path imports and @geostat/engine fail because dist/ doesn't exist — avoid Shell imports in node-env tests
metadata:
  type: feedback
---

In `@vitest-environment node`, Vite uses conditions `["node", "development", "import"]`. The `@geostat/*` packages have `"import": "./dist/index.js"` which doesn't exist in dev (no build step). The `"source": "./src/index.ts"` condition is NOT matched in node env — only browser env gets `source` from the vitest config's `conditions` array.

This causes two failure classes:
- `@geostat/engine` bare import → "Failed to resolve entry for package" (dist doesn't exist)
- `@geostat/react/engine` sub-path → `"./engine" is not exported under conditions ["node", "development", "import"]` (sub-path not in package.json exports)

**Why:** `annotationUtils.test.ts` has been failing pre-existing with the same issue. The vitest workspace config (`vitest.workspace.ts`) excludes `engine/plugins`, so these tests run standalone but pick up node conditions from `@vitest-environment node`.

**How to apply:** In `engine/plugins` test files using `@vitest-environment node`:
- Do NOT import from `@geostat/react/engine` (sub-path)
- Do NOT import Shell components that transitively import from `@geostat/react/engine`  
- DO test pure utilities (topologyRegistry, mapColorUtils, etc.) directly
- DO test shell logic by testing the decision data (what the shell computes), not the shell call itself
- Mark in test comment: "shell import omitted — see pre-existing annotationUtils.test.ts limitation"
