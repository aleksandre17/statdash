// ── migratePageConfig — N19: page-level schema migration runner ────────
//
//  Complements renderNode's per-node maybeMigrate (which runs during render).
//  migratePageConfig is the PRE-LOAD gate: run once when a stored config is
//  loaded to upgrade every node to its current schema version BEFORE render.
//
//  Use cases:
//    1. Constructor save-gate: ensure the config being saved is at the latest
//       version before persisting.
//    2. Page-load upgrade: load stored JSON → migratePageConfig → render.
//    3. Batch migration: upgrade all stored pages to the latest schema version.
//
//  Architecture: mirrors validatePageTree's traversal (children ?? items,
//  named slots via getSlots) but transforms nodes instead of collecting errors.
//
//  The traversal MUST be structurally identical to renderNode's child-expansion
//  to avoid missing nodes: children ?? items (primary), then SlotDef fields.

import type { NodeBase, NodePageConfig } from './types'
import { nodeRegistry }                  from './register-all'

// ── Platform schema version ───────────────────────────────────────────
//
//  Bumped when the page-level schema itself evolves (distinct from per-node
//  slice versions). Stamp this onto NodePageConfig.schemaVersion after any
//  migration run so callers know the page is at the current format.

const PLATFORM_SCHEMA_VERSION = 1

// ── Public API ────────────────────────────────────────────────────────

/**
 * Walk a full page tree and forward-migrate every node that is behind its
 * current registered schema version.
 *
 * Returns a new `NodePageConfig` only when at least one node was migrated.
 * Returns the **same reference** (`page`) when nothing changed — preserving
 * reference equality for hook-dependency optimisation.
 *
 * Does NOT render. Pure config transform — no React.
 *
 * @param page - The page config loaded from storage (JSON parse output).
 * @returns Migrated page (new ref) or the original page (same ref).
 */
export function migratePageConfig(page: NodePageConfig): NodePageConfig {
  const migratedRoot = migrateNode(page as unknown as NodeBase)

  // Nothing changed — return the original reference
  if (migratedRoot === (page as unknown as NodeBase)) return page

  return {
    ...page,
    ...(migratedRoot as U),
    schemaVersion: PLATFORM_SCHEMA_VERSION,
  } as NodePageConfig
}

// ── Internal helpers ──────────────────────────────────────────────────

type U = NodeBase & Record<string, unknown>

/**
 * Migrate a single node, then recursively migrate its children (primary slot
 * and named slots). Returns the same reference if nothing changed.
 */
function migrateNode(node: NodeBase): NodeBase {
  // Step 1 — forward-migrate this node's own fields
  const migratedSelf = migrateSelf(node)

  // Step 2 — recurse into primary child slot (children ?? items)
  const selfAsU = migratedSelf as U
  const primary: NodeBase[] | undefined =
    (selfAsU['children'] as NodeBase[] | undefined) ??
    (selfAsU['items']    as NodeBase[] | undefined)

  let migratedPrimary: NodeBase[] | undefined
  if (primary !== undefined) {
    migratedPrimary = migrateChildList(primary)
  }

  // Step 3 — recurse into named slots (SlotDef-driven)
  const type    = migratedSelf.type
  const variant = (migratedSelf as U)['variant'] as string | undefined ?? 'default'
  const slotDefs = nodeRegistry.getSlots(type, variant)

  // Collect slot-field mutations lazily — only create overrides map when needed
  let slotOverrides: Record<string, NodeBase | NodeBase[]> | undefined

  if (slotDefs) {
    for (const slotDef of Object.values(slotDefs)) {
      const slotRaw = (migratedSelf as U)[slotDef.field]

      if (Array.isArray(slotRaw)) {
        const migrated = migrateChildList(slotRaw as NodeBase[])
        if (migrated !== slotRaw) {
          slotOverrides ??= {}
          slotOverrides[slotDef.field] = migrated
        }
      } else if (slotRaw && typeof slotRaw === 'object') {
        const migrated = migrateNode(slotRaw as NodeBase)
        if (migrated !== slotRaw) {
          slotOverrides ??= {}
          slotOverrides[slotDef.field] = migrated
        }
      }
    }
  }

  // No changes at any level → return the original node reference
  const primaryFieldName: string | undefined =
    (node as U)['children'] !== undefined ? 'children'
    : (node as U)['items']  !== undefined ? 'items'
    : undefined

  const primaryChanged = migratedPrimary !== undefined && migratedPrimary !== primary
  const slotsChanged   = slotOverrides !== undefined
  const selfChanged    = migratedSelf !== node

  if (!selfChanged && !primaryChanged && !slotsChanged) return node

  // Compose a new node with updated fields
  const result: U = { ...(migratedSelf as U) }

  if (primaryChanged && primaryFieldName !== undefined) {
    result[primaryFieldName] = migratedPrimary as NodeBase[]
  }

  if (slotOverrides) {
    Object.assign(result, slotOverrides)
  }

  return result as NodeBase
}

/**
 * Forward-migrate a single node's own config fields by calling its registered
 * `migrate` hook when `_version` is behind the registered `version`.
 * Mirrors `maybeMigrate` in `renderNode.ts` exactly.
 */
function migrateSelf(node: NodeBase): NodeBase {
  const type    = node.type
  const variant = (node as U)['variant'] as string | undefined ?? 'default'
  const migrateFn = nodeRegistry.getMigrate(type, variant)
  if (!migrateFn) return node

  const meta    = nodeRegistry.getMeta(type, variant)
  const current = meta?.version ?? 1
  const stored  = (node as U)['_version'] as number | undefined ?? 1
  if (stored >= current) return node

  return migrateFn(node as U, stored) as NodeBase
}

/**
 * Migrate a list of child nodes. Returns the same array reference if no
 * child in the list was migrated (reference equality optimisation).
 */
function migrateChildList(children: NodeBase[]): NodeBase[] {
  let changed = false
  const result = children.map(child => {
    const migrated = migrateNode(child)
    if (migrated !== child) changed = true
    return migrated
  })
  return changed ? result : children
}
