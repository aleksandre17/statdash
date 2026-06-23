import { defineConfig }  from 'vitest/config'
import react             from '@vitejs/plugin-react'
import { resolve }       from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

// Workspace-safe __dirname: import.meta.url is always this config file's URL,
// regardless of the CWD when Vitest is invoked from the workspace root.
// DO NOT use __dirname — Vitest workspace injects it as the workspace root.
const dir = fileURLToPath(new URL('.', import.meta.url))
const req = createRequire(import.meta.url)

// ── Host-provided externals ───────────────────────────────────────────────
//
//  packages/react + packages/plugins import shared runtime libs (react-router-dom,
//  i18next) as peer/undeclared deps satisfied by the HOST app. Under pnpm's
//  isolated layout those bare specifiers are unresolvable from the package
//  source dirs during a panel-rooted transform, so we pin each to the panel-
//  resolved copy. (packages/react declaring i18next is the deeper fix — flagged.)
//
// Package root dir from a resolved entry path, by locating `node_modules/<pkg>`
// in the path (handles pnpm's nested .pnpm store layout + Win/Posix separators).
const pkgRootFromEntry = (pkg: string, entry: string): string => {
  const norm = entry.replace(/\\/g, '/')
  const marker = `node_modules/${pkg}`
  const at = norm.lastIndexOf(marker)
  return at === -1 ? resolve(entry, '..') : norm.slice(0, at + marker.length)
}

// Bare-specifier externals — exact-match alias to the panel-resolved entry file.
// Resolving the entry never trips a blocked "./package.json" export.
const bareExternals = ['i18next', 'react-router-dom', 'react-apexcharts', 'apexcharts'].map((pkg) => ({
  find: new RegExp(`^${pkg.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}$`),
  replacement: req.resolve(pkg),
}))

// Directory-prefix externals — leaflet/react-leaflet import deep subpaths
// (e.g. 'leaflet/dist/leaflet.css'), so alias the whole package dir.
const dirExternals = ['leaflet', 'react-leaflet'].map((pkg) => ({
  find: pkg,
  replacement: pkgRootFromEntry(pkg, req.resolve(pkg)),
}))

const hostExternals = [...bareExternals, ...dirExternals]

// apps/panel — Constructor platform. jsdom for the canvas/overlay/palette
// component tests; aliases mirror vite.config.ts so package layers resolve to
// TypeScript source via the "source" export condition (no build step).
export default defineConfig({
  plugins: [react()],
  test: {
    globals:     true,
    environment: 'jsdom',
    include:     ['src/**/*.test.{ts,tsx}'],
    setupFiles:  ['./vitest.setup.ts'],
  },
  resolve: {
    conditions: ['source', 'browser', 'module', 'import', 'default'],
    dedupe:     ['react', 'react-dom', 'react-router-dom', 'i18next'],
    alias: [
      { find: '@statdash/contracts', replacement: resolve(dir, '../../packages/contracts/src/index.ts') },
      { find: '@statdash/plugins', replacement: resolve(dir, '../../packages/plugins')   },
      { find: '@plugins',         replacement: resolve(dir, '../../packages/plugins')   },
      { find: '@statdash/expr',    replacement: resolve(dir, '../../packages/expr')       },
      { find: '@statdash/styles',  replacement: resolve(dir, '../../packages/styles/src') },
      { find: '@statdash/engine',  replacement: resolve(dir, '../../packages/core/src')   },
      { find: '@statdash/charts',  replacement: resolve(dir, '../../packages/charts/src') },
      // More-specific subpath first — wins over the bare alias AND over the
      // symlinked package's exports map (which omits an "./engine" subpath).
      { find: '@statdash/react/engine', replacement: resolve(dir, '../../packages/react/src/engine') },
      { find: '@statdash/react',   replacement: resolve(dir, '../../packages/react/src')  },
      { find: '@',                replacement: resolve(dir, 'src')                      },
      ...hostExternals,
    ],
  },
})
