import js           from '@eslint/js'
import globals      from 'globals'
import reactHooks   from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint     from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// ── Dependency arrow (Clean Architecture) — enforced as a BUILD GATE ─────────
//
//   engine/expr ← engine/core ← engine/react ← engine/plugins ← apps/geostat
//   (engine/ at repo root — full platform library; apps/ = pure deployable units)
//
// Implemented via per-layer no-restricted-imports rules.  Each inner layer
// explicitly bans imports from every outer layer, whether by alias or relative
// path.  A violation is an ERROR: `pnpm lint` fails, CI fails.
// ─────────────────────────────────────────────────────────────────────────────

//
// Layer    may import
// ───────  ──────────────────────────────────────────────────────────────────
// expr     nothing (innermost)
// styles   nothing
// engine   expr
// react    engine · expr · styles · @geostat/react (self)
// plugins  react · engine · expr · styles · @geostat/plugins (self)
// apps     everything (outermost, no restrictions)
//
// apps/panel EXTRA: no src-relative reach-ins to engine/ (use @geostat/* only).
// This fitness function keeps the future panel→external-repo split a no-op.

const APPS_GEOSTAT = ['apps/geostat/**', '**/apps/geostat/**', '@/*']
const APPS_PANEL   = ['apps/panel/**',   '**/apps/panel/**']
const ALL_APPS     = [...APPS_GEOSTAT, ...APPS_PANEL]

// PLUGINS_ALL: all import paths that resolve to engine/plugins or apps.
// Used to restrict inner layers from importing anything outer than react.
const PLUGINS_ALL  = [
  ...ALL_APPS,
  'engine/plugins/**', '**/engine/plugins/**',
  '@plugins', '@plugins/**',
  '@geostat/plugins', '@geostat/plugins/**',
]

// engine/core restriction: no plugins, apps, @geostat/react, or react layer
const RESTRICT_ENGINE = [...PLUGINS_ALL, '@geostat/react', '@geostat/react/**', '**/engine/react/**']

// engine/react restriction: no plugins, apps (CAN use @geostat/react self-ref)
const RESTRICT_REACT  = PLUGINS_ALL

// expr/styles restriction: same as engine (innermost — nothing outer)
const RESTRICT_EXPR   = RESTRICT_ENGINE

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
    },
  },

  // ── engine/expr — zero dependencies (innermost) ──────────────────────
  {
    files: ['engine/expr/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_EXPR }] },
  },

  // ── engine/styles — no app-specific dependencies ─────────────────────
  {
    files: ['engine/styles/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_EXPR }] },
  },

  // ── engine/core — may only import expr (+ external npm) ──────────────
  {
    files: ['engine/core/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_ENGINE }] },
  },

  // ── engine/react — may import engine/core · expr · styles · self ──────
  {
    files: ['engine/react/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: RESTRICT_REACT }] },
  },

  // ── engine/plugins — may import react · engine/core · expr · styles · self ──
  {
    files: ['engine/plugins/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: ALL_APPS }] },
  },

  // ── apps/panel — no src-relative reach-ins to engine source ───────────
  // Panel must declare @geostat/* or @plugins as its public import surface.
  // This rule keeps the future filter-repo panel split a no-op:
  // panel has zero hidden knowledge of the monorepo's internal paths.
  {
    files: ['apps/panel/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../../engine/**', '../../../engine/**', '**/engine/**'],
            message: 'Panel must not reach into engine source by relative path. Use @geostat/* or @plugins aliases.',
          },
        ],
      }],
    },
  },

  // apps/geostat is the outermost layer — no import restrictions.
])
