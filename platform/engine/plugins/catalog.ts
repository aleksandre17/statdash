/**
 * @geostat/plugins/catalog
 * Platform vocabulary for the Constructor (panel) palette editor.
 *
 * Exports: META descriptors (type, label, category, schema, defaults, slots, groups)
 * for every registered node, panel, and control.  No React rendering required —
 * panel reads this to populate its palette, property editors, and drag-and-drop slots.
 *
 * Shell (React) components are not explicitly imported here; bundlers tree-shake
 * them when only META constants are consumed.  Future: extract META into *Node.ts
 * files for a hard zero-React module-graph boundary.
 */

// ── Nodes ─────────────────────────────────────────────────────────────────────
export { META as section }       from './nodes/section'
export { META as modeBar }       from './nodes/mode-bar'
export { META as filterBar }     from './nodes/filter-bar'
export { META as pageHeader }    from './nodes/page-header'
export { META as georgraph }     from './nodes/georgraph'
export { META as links }         from './nodes/links'
export { META as repeat }        from './nodes/repeat'
export { META as hero }          from './nodes/hero'
export { META as statsCarousel } from './nodes/stats-carousel'

// ── Layout nodes (namespace: layout.grid.META, layout.row.META, …) ────────────
export * as layout from './nodes/layout'

// ── Panels ────────────────────────────────────────────────────────────────────
export { META as chart }    from './panels/chart'
export { META as kpiStrip } from './panels/kpi-strip'
export { META as table }    from './panels/table'

// ── Pages ─────────────────────────────────────────────────────────────────────
export * as pages from './pages'

// ── Controls (slices contain META + codec + Shell; bundler tree-shakes Shell) ──
export * from './controls'
