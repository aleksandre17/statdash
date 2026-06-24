import { defineConfig } from 'tsup'

// @statdash/plugins — build config (the outermost engine-layer package).
//
// Why a dedicated config (the inner packages build via the inline CLI):
// plugins' source imports several DEEP subpaths of its workspace deps that
// are not enumerated in those deps' `exports` maps, e.g.
//   @statdash/react/context/SectionNavContext
//   @statdash/react/engine/{NodeRegistry,registerSlice,slice-meta,types}
//   @statdash/plugins/panels/map/default            (self deep-import)
// rollup-plugin-dts (tsup's dts pass) resolves an externalized workspace
// specifier through that package's `exports` first and only falls back to
// tsconfig `paths` if not external — so these deep subpaths fail with TS2307
// even though the root tsconfig `paths` map @statdash/*/* → source.
//
// Fix: in the dts pass, map the workspace specifiers (incl. deep subpaths)
// to SOURCE so the type program resolves them directly from .ts. plugins is
// the outermost layer (with-the-arrow consumer of react/engine/charts), so
// inlining their referenced types into plugins' own .d.ts does not violate
// the dependency arrow. vite/client supplies import.meta.env ambients used
// by shell components. The ESM (runtime) build keeps deps external.
const workspaceRoot = '../..'

export default defineConfig({
  entry: ['catalog.ts', 'registry.ts', 'datasources/index.ts'],
  format: ['esm'],
  clean: true,
  dts: {
    // Resolve (inline) workspace specifiers from source rather than chasing
    // the deps' exports maps, which omit these deep subpaths.
    resolve: [/^@statdash\//],
    compilerOptions: {
      types: ['vite/client', 'node'],
      baseUrl: workspaceRoot,
      paths: {
        '@statdash/contracts': ['./packages/contracts/src/index.ts'],
        '@statdash/contracts/*': ['./packages/contracts/src/*'],
        '@statdash/expr': ['./packages/expr/index.ts'],
        '@statdash/expr/*': ['./packages/expr/src/*'],
        '@statdash/styles': ['./packages/styles/src/index.ts'],
        '@statdash/styles/*': ['./packages/styles/src/*'],
        '@statdash/engine': ['./packages/core/src/index.ts'],
        '@statdash/engine/*': ['./packages/core/src/*'],
        '@statdash/charts': ['./packages/charts/src/index.ts'],
        '@statdash/charts/*': ['./packages/charts/src/*'],
        '@statdash/react': ['./packages/react/src/index.ts'],
        '@statdash/react/engine': ['./packages/react/src/engine/index.ts'],
        '@statdash/react/*': ['./packages/react/src/*'],
        '@statdash/plugins/catalog': ['./packages/plugins/catalog.ts'],
        '@statdash/plugins/registry': ['./packages/plugins/registry.ts'],
        '@statdash/plugins/datasources': ['./packages/plugins/datasources/index.ts'],
        '@statdash/plugins/*': ['./packages/plugins/*'],
      },
    },
  },
})
