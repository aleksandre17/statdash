---
name: typecheck-peer-dep-resolution
description: Why bare third-party imports fail tsc in apps/geostat — engine peer deps + bundler resolution + in-graph source compilation
metadata:
  type: project
---

The canonical typecheck gate is `tsc -b apps/geostat/tsconfig.app.json --noEmit` (npm script `typecheck` in platform/package.json). Root `npx tsc --noEmit` validates nothing — root tsconfig.json has `"files": []`, a false green.

`apps/geostat/tsconfig.app.json` compiles engine source in-graph (`"include": ["src", "../../engine"]` + `@geostat/*` paths to engine/*/src). It uses `moduleResolution: bundler`.

**Why bare third-party imports (react-router-dom, apexcharts, leaflet, react-leaflet, react-apexcharts, i18next) fail with TS2307:** the engine/* packages declare these as `peerDependencies` (intentional — they don't ship their own copies). They are installed in `apps/geostat/node_modules`. pnpm only symlinks *satisfiable non-optional* peers into each engine package's node_modules — so engine/react gets react-router-dom but engine/plugins does NOT. `bundler` resolution walks up from the *importing file's* dir and never reaches apps/geostat/node_modules.

**Fix (config-layer, pure tsconfig):** add `paths` entries mapping each bare specifier to `./node_modules/<dep>`. Special case: `leaflet` ships no types, so its path entry points at `./node_modules/@types/leaflet`, not `./node_modules/leaflet` (otherwise TS7016).
**Why not change engine packages:** peer deps must stay peers (Clean Architecture, packages stay app-agnostic — see [[feedback-packages-react-agnostic]]).

`erasableSyntaxOnly: true` also conflicted with engine/core (parameter properties in error.ts, store-impl.ts) and engine/charts (placeholder.ts) — removed it (TS1294). engine/core intentionally uses these features.

`.stories.tsx` files import `@storybook/react-vite` which is not installed; excluded from the app build graph via tsconfig `exclude`.

**How to apply:** when third-party TS2307 reappears in apps/geostat for a dep imported from engine/**, the dep needs a `paths` entry in tsconfig.app.json (and `@types/*` redirect if it ships no own types) — do not add the dep to an engine package.
