// ── outline — Webflow-Navigator structural tree (V6) ──────────────────────────
//
//  A structural navigation pane over the Constructor's flat CanvasPage store —
//  click-to-select (bidirectional with the canvas), drag-to-reorder/re-nest
//  (@dnd-kit, accepts-validated), collapse/expand, delete. No parallel tree
//  model: it projects + mutates the SAME store the canvas uses.
//
export { OutlineTree }        from './OutlineTree'
export { buildOutlineRows }   from './outlineModel'
export type { OutlineRow }    from './outlineModel'
