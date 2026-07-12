// ── SchemaSource — the Inspector's schema-resolution port (C1 / Phase C) ─────
//
//  The Inspector renders a property panel GENERICALLY from a PropSchema. Until
//  now it read that schema directly from `nodeRegistry` — coupling the ONE
//  generic Inspector to ONE slice kind (nodes/panels live in the node registry).
//
//  A CHROME region's schema lives in a DIFFERENT registry, but chrome is no longer
//  authored through a forked panel + its own source: S6 folded chrome into the ONE
//  Part port, so a chrome region's contract is projected as a `sourced` part
//  (`chromeParts`, resolving `chromeRegistry.getMeta(slot,key).schema`) and rendered
//  through the generic `element.schema` dock section via `fixedSchemaSource` — the SAME
//  bounded-part path a filter control takes. So this port now serves the node/panel case;
//  a future kind is still one new source with the Inspector unchanged (DIP + Strategy).
//
//    Inspector(schemaSource) ← nodeSchemaSource    (nodes / panels — the default)
//                            ← fixedSchemaSource    (any bounded PART — value/sourced/chrome)
//                            ← …any future kind     (one new source, Inspector unchanged)
//
import type { PropSchema, PropertyGroup } from '@statdash/react/engine'
import { nodeRegistry } from '@statdash/react/engine'
import type { CanvasNode } from '../types/constructor'

/**
 * Resolves the schema + property groups for a selected element. A pure lookup
 * keyed by the element's identity (the CanvasNode's type/variant); no React, no
 * store — so it is trivially testable and swappable per slice kind.
 */
export interface SchemaSource {
  /** The element's typed property descriptors, or [] when the kind has none. */
  getSchema: (node: CanvasNode) => PropSchema
  /** The element's property-panel grouping (accordion sections), or []. */
  getGroups: (node: CanvasNode) => PropertyGroup[]
}

// ── Node / panel source (the default — preserves all existing behavior) ──────
//
//  Nodes and panels are both registered in the NodeRegistry, so one source
//  serves both. `type` is the registry key, `variant` selects the variant.
//
export const nodeSchemaSource: SchemaSource = {
  getSchema: (node) => nodeRegistry.getSchema(node.type, node.variant) ?? [],
  getGroups: (node) =>
    (nodeRegistry.getMeta(node.type, node.variant)?.groups as PropertyGroup[] | undefined) ?? [],
}
