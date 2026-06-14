/**
 * @geostat/plugins/registry
 * Full runtime registry — all plugin implementations.
 *
 * Consumed by apps/geostat (renderer) and engine/react rendering hooks.
 * Includes: Shell components, Skeleton loaders, chart renderers,
 * control slices (Shell + codec + validation), and META descriptors.
 *
 * This is the heavy face of @geostat/plugins.  Apps that only need
 * palette metadata (panel editor) should import from @geostat/plugins/catalog.
 */

// ── Controls ──────────────────────────────────────────────────────────────────
export * from './controls'

// ── Nodes ─────────────────────────────────────────────────────────────────────
export * from './nodes/section'
export * from './nodes/mode-bar'
export * from './nodes/filter-bar'
export * from './nodes/page-header'
export * from './nodes/georgraph'
export * from './nodes/links'
export * from './nodes/repeat'
export * from './nodes/hero'
export * from './nodes/stats-carousel'

// ── Layout nodes (re-exports all layout sub-node namespaces) ──────────────────
export * from './nodes/layout'

// ── Panels ────────────────────────────────────────────────────────────────────
export * from './panels/chart'
export * from './panels/kpi-strip'
export * from './panels/table'

// ── Pages ─────────────────────────────────────────────────────────────────────
export * from './pages'
