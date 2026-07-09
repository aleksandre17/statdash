---
name: fitness-raw-source-scan
description: In panel fitness tests, scan a module's source text via Vite `?raw` import — not import.meta.url / __dirname (both fail under Vitest 4)
metadata:
  type: project
---

To read a module's OWN SOURCE TEXT inside a panel (`apps/panel`) fitness test — e.g. an
import-scan structural lock — import it as raw text:

```ts
import SRC from './semanticCatalogOptions.ts?raw'
```

**Why:** the two obvious alternatives both fail here:
- `fileURLToPath(new URL('./x.ts', import.meta.url))` → `TypeError: The URL must be of
  scheme file` — Vitest 4 does not give `import.meta.url` a `file://` scheme.
- `__dirname` → Vitest workspace injects it as the WORKSPACE ROOT, not the test dir
  (see the user auto-memory `feedback_vitest_workspace_dirname`).

`?raw` is Vite-native, CWD-independent, and tsc-safe because the panel tsconfig already
lists `vite/client` in `types` (which declares `module '*?raw'`). No new .d.ts needed.

**How to apply:** any time a fitness needs to grep/parse a source file's own text
(import scans, forbidden-token scans) from a panel test. First used by
`catalogDiscoveryPure.fitness.test.ts` (FF-CATALOG-DISCOVERY-PURE) — scans
`semanticCatalogOptions.ts` for value/React/store/network imports to lock the resolver
leaf's purity structurally.

Related: [[project_metric_catalog_store]] (the seam these fitness files assert over).
