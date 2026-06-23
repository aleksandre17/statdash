/**
 * @statdash/plugins/registry
 * Full runtime registry — all plugin implementations.
 *
 * Consumed by apps/geostat (renderer) and engine/react rendering hooks.
 * Includes: Shell components, Skeleton loaders, chart renderers,
 * control slices (Shell + codec + validation), and META descriptors.
 *
 * This is the heavy face of @statdash/plugins.  Apps that only need
 * palette metadata (panel editor) should import from @statdash/plugins/catalog.
 *
 * ── Namespaced exports ──
 * Every node and panel is re-exported under its own namespace to prevent
 * TS2308 collisions on shared member names (META, Shell, Skeleton).
 * Mirror pattern: nodes/index.ts · panels/index.ts · chrome/index.ts.
 */

// ── Controls ──────────────────────────────────────────────────────────────────
// Each control slice already carries a unique alias (yearSelect, select, …);
// no member-name collision is possible here.
export * from './controls'

// ── Nodes ─────────────────────────────────────────────────────────────────────
export * as section        from './nodes/section'
export * as modeBar        from './nodes/mode-bar'
export * as filterBar      from './nodes/filter-bar'
export * as pageHeader     from './nodes/page-header'
export * as georgraph      from './nodes/georgraph'
export * as links          from './nodes/links'
export * as repeat         from './nodes/repeat'
export * as hero           from './nodes/hero'
export * as statsCarousel  from './nodes/stats-carousel'

// ── Layout nodes — sub-nodes already namespaced (row, grid, columns, …) ──────
// nodes/layout/index.ts uses `export * as row from './row'` etc., so spreading
// here does not introduce any META/Shell/Skeleton collision.
export * from './nodes/layout'

// ── Panels ────────────────────────────────────────────────────────────────────
export * as chart    from './panels/chart'
export * as kpiStrip from './panels/kpi-strip'
export * as table    from './panels/table'
export * as map      from './panels/map'
export * as text     from './panels/text'
export * as gauge    from './panels/gauge'

// ── Pages ─────────────────────────────────────────────────────────────────────
export * from './pages'
