// ── nodeContextEditors — Element-context authoring augmentations by node type ──
//  (AR-49 D7.3 — the seam behind the filter-bar control drill bridge)
//
//  Most nodes are fully authored by the generic <Inspector> over their PropSchema.
//  A few are PLACEHOLDERS whose real CONTENT lives in a page-level SSOT the node
//  only REFERENCES — e.g. a `filter-bar` node carries `barIds`, but its controls
//  live in `page.meta.filterSchema`. For those, the Inspector alone can't reach the
//  content; a small type-specific editor bridges the node → its SSOT content.
//
//  This table is that seam. RightDock renders `nodeContextEditors[node.type]` (if
//  present) beneath the generic Inspector, in the Element context. Open for
//  extension (OCP / Law 8): a new placeholder node registers ONE entry here;
//  RightDock is unchanged. Kept declarative — no `if (type === …)` literal woven
//  through the dock's render flow.
//
import type { ComponentType } from 'react'
import type { CanvasNode, Locale } from '../types/constructor'
import { FilterBarControlsBridge } from '../features/filters'

export interface NodeContextEditorProps {
  node:    CanvasNode
  locale?: Locale
}

export const nodeContextEditors: Record<string, ComponentType<NodeContextEditorProps>> = {
  // A filter-bar node → drill into the controls its `barIds` resolves to, edited
  // through the filterSchema SSOT (no denormalization onto the node).
  'filter-bar': FilterBarControlsBridge,
}
