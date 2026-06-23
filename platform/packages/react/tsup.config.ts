import { defineConfig } from 'tsup'

// @statdash/react — build config.
//
// Why a dedicated config (the other engine packages build via the inline
// `tsup … --dts` CLI): react has three build needs the bare CLI cannot meet.
//
//   1. Two entries — the package advertises two `exports` subpaths:
//        "."        → dist/index.js        (src/index.ts)
//        "./engine" → dist/engine/index.js (src/engine/index.ts)
//      The inline `tsup src/index.ts` emitted only the root entry, so the
//      ./engine subpath had no dist and downstream `@statdash/react/engine`
//      imports (e.g. @statdash/plugins) failed to resolve at dts time.
//
//   2. Self-reference — src/engine/SiteRenderer.tsx imports the package's own
//      public barrel ('@statdash/react') rather than relative paths. During
//      react's OWN dts pass its dist/*.d.ts does not exist yet, so node
//      self-referencing resolution → dist → TS7016. Mapping the self-name to
//      SOURCE in the dts compiler lets those types inline into react's own
//      .d.ts (same package — no cross-package leakage, the arrow is preserved
//      because sibling @statdash/* deps still resolve to their built dist).
//
//   3. import.meta.env — SiteRenderer guards a dev-only middleware behind
//      `import.meta.env.DEV`. rollup-plugin-dts compiles with the tsconfig
//      `lib`/`types`, which omit Vite's ambient `ImportMetaEnv`; `vite/client`
//      supplies it.
//
// Sibling workspace deps (@statdash/engine|charts|contracts|styles|expr) are
// intentionally NOT remapped to source: they resolve to their built dist
// .d.ts (topological build order guarantees those exist first), so react's
// published types reference them as `import('@statdash/…')` — the dependency
// arrow holds in the emitted types, no duplication.
export default defineConfig({
  entry: ['src/index.ts', 'src/engine/index.ts'],
  format: ['esm'],
  clean: true,
  dts: {
    // Inline the self-reference (only) from source.
    resolve: [/^@statdash\/react($|\/)/],
    compilerOptions: {
      types: ['vite/client', 'node'],
      // Map ONLY the self-name to source so the dts program does not chase
      // the package's own (not-yet-built) dist. baseUrl anchors the relative
      // path to this package dir.
      baseUrl: '.',
      paths: {
        '@statdash/react': ['./src/index.ts'],
        '@statdash/react/*': ['./src/*'],
      },
    },
  },
})
