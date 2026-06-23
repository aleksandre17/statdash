// ── SchemaSource — the Inspector's schema-resolution port (C1 / Phase C) ─────
//
//  The Inspector renders a property panel GENERICALLY from a PropSchema. Until
//  now it read that schema directly from `nodeRegistry` — coupling the ONE
//  generic Inspector to ONE slice kind (nodes/panels live in the node registry).
//
//  Phase C adds chrome authoring: a CHROME element's schema lives in a DIFFERENT
//  registry (`chromeRegistry.getMeta(slot,key).schema`). Rather than fork a
//  chrome-specific inspector (a Law-6 / DRY violation) or teach the Inspector
//  about every registry (an OCP violation — a new slice kind would edit it), we
//  INVERT the dependency: the Inspector depends on this small port, and each
//  caller supplies the source for the kind of element it selected.
//
//    Inspector(schemaSource) ← nodeSchemaSource    (nodes / panels — the default)
//                            ← chromeSchemaSource   (chrome slots — Phase C)
//                            ← …any future kind     (one new source, Inspector unchanged)
//
//  Dependency Inversion + Strategy: the Inspector owns the rendering policy; the
//  source owns "where this kind of element's schema comes from". Both the node
//  and chrome sources return the SAME shape, so the Inspector is identical for
//  every slice kind — exactly the "one Inspector, all kinds" requirement.
//
import type { PropSchema, PropertyGroup } from '@statdash/react/engine'
import { nodeRegistry, chromeRegistry } from '@statdash/react/engine'
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

// ── Chrome source (Phase C — the per-element chrome schema seam) ──────────────
//
//  A chrome element is addressed by slot+key (the chromeRegistry's composite
//  key). We model the selection as a CanvasNode whose `type` carries the slot
//  and `variant` carries the key, so the SAME Inspector path renders it. The
//  schema is the chrome slice's OWN per-element PropSchema (ISP: each chrome
//  element owns its config, never a shared base) declared on its meta.
//
//  Chrome metas carry `groups?` for parity with node metas; we read it
//  defensively so a chrome slice that declares grouping gets it for free.
//
export const chromeSchemaSource: SchemaSource = {
  getSchema: (node) => chromeRegistry.getMeta(node.type, node.variant ?? 'default')?.schema ?? [],
  getGroups: (node) =>
    ((chromeRegistry.getMeta(node.type, node.variant ?? 'default') as { groups?: PropertyGroup[] } | undefined)
      ?.groups) ?? [],
}
