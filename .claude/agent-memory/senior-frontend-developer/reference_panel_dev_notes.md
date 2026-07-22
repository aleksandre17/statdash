---
name: reference-panel-dev-notes
description: "Four small operational references — the /api/config contract shape+quirks, where/how to run panel gates, the vitest .css?raw-is-empty gotcha, and node-vite's remote-deploy context-dir layout. Consolidated distillate."
metadata:
  type: reference
---

> Consolidated 2026-07-22 from 4 sibling files (config-api-contract, panel-gate-commands,
> vitest-css-raw-empty, node-vite-remote-deploy-layout).

## Config API contract (`/api/config`, Fastify, default `http://localhost:3001`)
Source of truth: `platform/apps/api/src/routes/config/*.ts`. Panel client:
`platform/apps/panel/src/lib/api.ts`. Envelope: success `{data:T}`; error `{error,message?}` +
non-200.

**Non-obvious details (verified against route source):**
- `data-sources` type enum is `'sdmx-json'|'rest'|'static'` (NOT `'sdmx'`).
- `POST /data-sources` body `url?` is optional-not-nullable; `PUT` takes `url` nullable; rows
  return `url:string|null`.
- `pages`: GET `/pages` lists non-archived; GET `/pages/:id` LEFT JOINs the latest `page_version`
  (config + data_specs live in the VERSION, not the page row). POST returns `{id}` only; PUT
  returns `{id,version_number?}` and appends a new immutable version. DELETE is a soft archive.
- `site` is a key/value upsert map (`config.site_config`); PUT echoes the body. GET `/site`
  returns the open settings map PLUS server-projected `activeLocales:string[]` (ordered) +
  `defaultLocale:string` — derived on read, NOT stored in the blob (SSOT = `config.locale`
  registry). Nav is a SEPARATE resource (`config.nav_item`), returned as a tree ordered by
  `depth,ord`.
- `SiteDef.activeLocales` is the active-locale SSOT for LocaleString authoring;
  `useActiveLocales` narrows to the known `Locale` union, falling back to
  `orderLocales(defaultLocale)` when empty. NOTE: `api-actions.ts` save-guard still builds its
  active set via `orderLocales(defaultLocale)`, not `site.activeLocales` — a deliberate
  non-expansion, revisit when a non-ka/en locale ships.
- Canvas tree (`nodeIds`+`nodes`) serializes into the page version's `config` object
  (`toApiPage`/`fromApiPage`), not separate columns.

**How to apply:** treat `spec`/`config` payloads as opaque `Record<string,unknown>` (Law 1/2 —
never narrow to stat dimensions, never put functions in config). The store stays synchronous;
async lives in `store/api-actions.ts` thunks (optimistic write-through, no rollback yet).

## Where to run panel gates
The pnpm workspace root is `platform/` (not repo root, not `apps/panel`):
`pnpm --filter ./apps/panel test` (vitest), `pnpm --filter ./apps/panel lint` (eslint),
`pnpm exec tsc -b apps/panel` (exit 0 = clean). Running from the repo root gives
`ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE`. Parse the LOG for `Tests N failed`=0, not just exit code.
Fitness source-scan tests use `import.meta.glob([...],{query:'?raw',eager:true})` + a local
`stripComments()` so doc-comment prose doesn't trip a literal scan.
**Known pre-existing failure:** ROOT `pnpm exec tsc -b` (whole graph) emits one TS2352 in
`packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts` — vitest (esbuild, no
typecheck) passes it at runtime; `tsc -b apps/panel` alone is clean. Not a panel-scope issue.

## vitest `.css?raw` resolves EMPTY in apps/panel
Both `import x from './f.css?raw'` and the `import.meta.glob(['./f.css'],{query:'?raw',...})`
idiom return `''` under panel vitest (`css:false` in config) — `.tsx`/`.ts` raw imports work fine.
**How to apply:** never assert on the TEXT of a `.css` file in a fitness/layout-contract test (it
passes vacuously on negative assertions, fails on positive ones) — assert the layout contract on
the component's own `.tsx` source (`?raw`) + rendered DOM structure instead. See
[[project_css_fitness_comment_stripping_gotcha]] for a real gate this makes vacuous.

## node-vite remote-deploy context-dir layout
`kits/geostat-kit/drivers/node-vite/ps1/deploy.ps1` `remote` mode ships `apps/{geostat,panel}` to
a server via `docker compose ... up --build`. These are pnpm-workspace SPAs whose per-module
compose declares `build:{context:../../, dockerfile:apps/<app>/src/Dockerfile}` — so the server
build context must be the WHOLE workspace (`platform/`), not the module dir.
**Layout:** tar the workspace root (walked up to `pnpm-workspace.yaml`) → extract to
`$DEPLOY_PATH/context/`; run compose from `$DEPLOY_PATH/context/<relModule>` so relative paths
resolve (`../../`→context root, `env_file:../../../ops/config/<app>/.env.<env>`→
`$DEPLOY_PATH/ops/config/<app>/.env.<env>`).
**env_file gotcha:** the env overlay points OUTSIDE the workspace tar (secrets, intentionally
separate) — `deploy.ps1` step 3 copies the combined env bundle to the server so the directive
resolves; `--env-file $DEPLOY_PATH/.env.<env>` (compose variable substitution) is a SEPARATE
concern from the per-service `env_file:` directive.
**Unaffected modes:** `local` (direct docker build), `dist`/`sync`/`watch` (local vite build →
nginx static) don't use the per-module compose at all.
