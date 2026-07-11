export * as chart    from './chart'
export * as table    from './table'
export * as kpiStrip from './kpi-strip'
// kpi-card (ADR-023 · R2 expand) — the PROMOTED first-class card node, built
// ALONGSIDE kpi-strip's legacy items[] path (Law 7). Nested under kpi-strip (its
// plugin family), so it is not a top-level panel dir; registered here so the app's
// setupRegistrations spreads it into registerSlice. Renders only behind the
// isPromotionEnabled('kpi-card') flag until R2-contract.
export * as kpiCard  from './kpi-strip/card'
export * as text     from './text'
export * as gauge    from './gauge'