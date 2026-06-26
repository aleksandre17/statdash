import js           from '@eslint/js'
import globals      from 'globals'
import reactHooks   from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint     from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// ── Dependency arrow (Clean Architecture) — enforced as a BUILD GATE ─────────
//
//   packages/contracts ← packages/expr ← packages/core ← packages/react ← packages/plugins ← apps/geostat
//   packages/contracts ← apps/api
//   (packages/ at repo root — full platform library; apps/ = pure deployable units)
//   contracts is the innermost layer: it imports NOTHING and is importable by ALL
//   (incl. apps/api, which the arrow forbids from importing @statdash/react).
//
// Implemented via per-layer no-restricted-imports rules.  Each inner layer
// explicitly bans imports from every outer layer, whether by alias or relative
// path.  A violation is an ERROR: `pnpm lint` fails, CI fails.
// ─────────────────────────────────────────────────────────────────────────────

//
// Layer    may import
// ───────  ──────────────────────────────────────────────────────────────────
// contracts nothing (innermost — zero-dep, importable by ALL incl. apps/api)
// expr     nothing
// styles   nothing
// core     expr
// react    core · expr · styles · @statdash/react (self)
// plugins  react · core · expr · styles · @statdash/plugins (self)
// apps     everything (outermost, no restrictions)
//
// apps/panel EXTRA: no src-relative reach-ins to packages/ (use @statdash/* only).
// This fitness function keeps the future panel→external-repo split a no-op.

const APPS_GEOSTAT = ['apps/geostat/**', '**/apps/geostat/**', '@/*']
const APPS_PANEL   = ['apps/panel/**',   '**/apps/panel/**']
const ALL_APPS     = [...APPS_GEOSTAT, ...APPS_PANEL]

// PLUGINS_ALL: all import paths that resolve to packages/plugins or apps.
// Used to restrict inner layers from importing anything outer than react.
const PLUGINS_ALL  = [
  ...ALL_APPS,
  'packages/plugins/**', '**/packages/plugins/**',
  '@plugins', '@plugins/**',
  '@statdash/plugins', '@statdash/plugins/**',
]

// packages/core restriction: no plugins, apps, @statdash/react, or react layer
const RESTRICT_ENGINE = [...PLUGINS_ALL, '@statdash/react', '@statdash/react/**', '**/packages/react/**']

// packages/react restriction: no plugins, apps (CAN use @statdash/react self-ref)
const RESTRICT_REACT  = PLUGINS_ALL

// expr/styles restriction: same as engine (innermost — nothing outer)
const RESTRICT_EXPR   = RESTRICT_ENGINE

// contracts restriction: imports NOTHING from any workspace package — it is the
// zero-dep shared root. Ban every @statdash/* sibling and every relative reach into
// another package; the purity fitness test (contracts.fitness.test.ts)
// double-locks this at the compiler/runtime level.
const RESTRICT_CONTRACTS = [
  ...RESTRICT_ENGINE,
  '@statdash/expr', '@statdash/expr/**',
  '@statdash/engine', '@statdash/engine/**',
  '@statdash/charts', '@statdash/charts/**',
  '@statdash/styles', '@statdash/styles/**',
  '../**', // no relative reach into sibling packages
]

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**']),

  // ── Global rules (all layers) ──────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
        extraHOCs: ['defineShell'],
      }],

      // ── Underscore-prefix convention for intentionally-unused bindings ──────
      //
      //  The codebase's established convention is a leading `_` to mark a binding
      //  that is REQUIRED by a signature/interface but deliberately unused — e.g.
      //  renderer params `(_def, _ctx, _children)` that fulfil the
      //  `(def, ctx, children) => ReactNode` contract, or a destructure-rest that
      //  drops a key (`const { type: _, ...rest } = node`).  Encoding the
      //  convention here (standards-as-code) is the root fix: it lets the linter
      //  distinguish "intentionally unused, contract-required" from genuine dead
      //  code, instead of relying on per-line disables.  Genuine dead code (no
      //  `_` prefix) is still reported and removed.
      //
      '@typescript-eslint/no-unused-vars': ['error', {
        args:                     'all',
        argsIgnorePattern:        '^_',
        varsIgnorePattern:        '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings:       true,
      }],
    },
  },

  // ── packages/contracts — zero dependencies (innermost, importable by all) ──
  {
    files: ['packages/contracts/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_CONTRACTS }] },
  },

  // ── packages/expr — zero dependencies (innermost) ──────────────────────
  {
    files: ['packages/expr/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_EXPR }] },
  },

  // ── packages/styles — no app-specific dependencies ─────────────────────
  {
    files: ['packages/styles/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_EXPR }] },
  },

  // ── packages/core — may only import expr (+ external npm) ──────────────
  {
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_ENGINE }] },
  },

  // ── packages/react — may import packages/core · expr · styles · self ──────
  {
    files: ['packages/react/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_REACT }] },
  },

  // ── packages/react/scripts — BUILD TOOLING, not shipped library code ──────
  //  emit-page-config-schema.ts must populate the FULL plugin registry to emit
  //  the whole-config JSON Schema (ADR §7.7). It runs at build time only and is
  //  NEVER in the published surface (react package `files: ["dist"]`; scripts/
  //  is excluded). The shipped library (src/**) keeps the strict arrow — this
  //  override is scoped to scripts/ exactly as apps/api/scripts import seed data.
  //  It permits importing the node-safe plugin META catalog to drive describeApp().
  {
    files: ['packages/react/scripts/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ── packages/plugins — may import react · packages/core · expr · styles · self ──
  {
    files: ['packages/plugins/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ALL_APPS }],

      // ── DI consumption exception ────────────────────────────────────────────
      //
      //  Shells use useInject(ctx.ui, TOKEN) to obtain UI components from the
      //  MapContainer DI container. The reference IS stable: useInject wraps
      //  container.inject(token) in useMemo([container, token]); both deps are
      //  stable per page lifecycle (ctx.ui = same MapContainer instance created
      //  once in SiteRenderer; TOKEN = module-level singleton InjectionToken).
      //
      //  react-hooks/static-components is over-conservative for this pattern —
      //  it cannot statically prove the returned ComponentType is stable, even
      //  when useMemo guarantees it.  The exception is scoped to plugins/ only
      //  (the shell layer that consumes UIRegistry via useInject).
      //
      //  If this rule's API gains an `allowedHooks` option (as react-hooks
      //  exhaustive-deps has `additionalHooks`), replace this off-override with
      //  a targeted configuration.
      //
      'react-hooks/static-components': 'off',
    },
  },

  // ── PanelExportBar — the react-layer twin of the plugins DI exception ─────
  //
  //  PanelExportBar is the promoted panel-export seam (the wrapper every panel
  //  shell consumes instead of re-wiring useInject(EXPORT_BAR) + the bus). It
  //  uses the SAME useInject(ctx.ui, EXPORT_BAR) DI pattern as the shells, with
  //  the SAME stability guarantee (useMemo([container, token]); both deps stable
  //  per page lifecycle). The rule cannot statically prove that, exactly as in
  //  the plugins block above. The override is scoped to this single file so the
  //  gate stays fully active across the rest of packages/react.
  {
    files: ['packages/react/src/components/feedback/PanelExportBar.tsx'],
    rules: { 'react-hooks/static-components': 'off' },
  },

  // ── apps/panel — no src-relative reach-ins to packages source ───────────
  // Panel must declare @statdash/* or @plugins as its public import surface.
  // This rule keeps the future filter-repo panel split a no-op:
  // panel has zero hidden knowledge of the monorepo's internal paths.
  {
    files: ['apps/panel/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../../packages/**', '../../../packages/**', '**/packages/**'],
            message: 'Panel must not reach into platform package source by relative path. Use @statdash/* or @plugins aliases.',
          },
        ],
      }],
    },
  },

  // ── apps/api — xlsx Anti-Corruption Layer (F-3, ADR-0031 §5) ───────────────
  //
  //  The `xlsx` vendor SDK is confined to ONE file: the canonical workbook reader
  //  (`ingest/canonical/read-workbook.ts`). Every other file in apps/api is banned
  //  from importing it, so the spreadsheet's idioms cannot leak past the ACL
  //  boundary into the pure parser, the worker hot path, or the routes. A new
  //  `import xlsx` anywhere else is an ERROR (`pnpm lint` fails). The single
  //  permitted file is exempted by the scoped override directly below.
  {
    files: ['apps/api/**/*.{ts,tsx}'],
    ignores: ['apps/api/src/ingest/canonical/read-workbook.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'xlsx',
          message: 'xlsx is confined to ingest/canonical/read-workbook.ts (the ACL boundary, ADR-0031 §5 / F-3). Parse already-read sheet matrices instead.',
        }],
      }],
    },
  },
  {
    files: ['apps/api/src/ingest/canonical/read-workbook.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // apps/geostat is the outermost layer — no import restrictions.
])
