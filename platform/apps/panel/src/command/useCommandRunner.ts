// ── useCommandRunner — execute a Command against the store (V6) ───────────────
//
//  The single executor for every command surface (Cmd-K palette + slash-insert).
//  An INSERT command resolves the SAME insert plan (resolveInsertPlan) and compiles
//  it through the SAME planInserts + store actions the other surfaces use — so a
//  Cmd-K / slash insert is byte-identical to a palette drop, including the M4.1
//  auto-wrap (page → section → type) and its ONE-undo batching (the V6 invariant).
//
//  Navigate selects; duplicate clones the selected node's shape into its
//  container; delete removes it. All mutations route through existing store
//  actions (history-composed) — no parallel mutation engine.
//
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { nodeRegistry } from '@statdash/react/engine'
import { resolveLocaleString } from '@statdash/engine'
import type { LocaleString } from '@statdash/engine'
import {
  useConstructorStore, useActivePage, useActivePageId, useSelectedNode,
} from '../store/constructor.store'
import { studioDataPath } from '../studio/useStudioRoute'
import { makeNode, resolvePlacementPlan, planPlacement } from '../canvas/insertNode'
import { placeSlotPart } from '../canvas/placeNode'
import { insertNeedsContainerHint } from '../canvas/paletteGroupLabels'
import { useToast } from '../store/notify'
import { useActiveLocales } from '../inspector/useActiveLocales'
import { newNodeId } from '../canvas/nodeId'
import type { Command } from './commandModel'

export function useCommandRunner() {
  const page       = useActivePage()
  const pageId     = useActivePageId()
  const selectedId = useSelectedNode()
  const insertNodes = useConstructorStore((s) => s.insertNodes)
  const insertNode = useConstructorStore((s) => s.insertNode)
  const moveNode   = useConstructorStore((s) => s.moveNode)
  const selectNode = useConstructorStore((s) => s.selectNode)
  const removeNode = useConstructorStore((s) => s.removeNode)
  const markDirty  = useConstructorStore((s) => s.markPageDirty)
  const navigate   = useNavigate()
  const notify     = useToast()
  const locale     = useActiveLocales()[0] ?? 'ka'

  return useCallback((cmd: Command) => {
    // Workspace navigation is document-independent (no active page required), so it
    // runs BEFORE the page guard. "Data model" is PURE NAVIGATION (AR-50 M5b): open
    // the always-reachable Data workspace WITHOUT touching the role lens, so the user
    // lands on the role-appropriate content (author → read-only Dictionary). ADR-051
    // DU1: the target is the ONE Data workspace's Model floor (`?dataFloor=model`).
    if (cmd.kind === 'action' && cmd.action === 'open-data-model') {
      navigate(studioDataPath('model'))
      return
    }

    if (!page || !pageId) return

    if (cmd.kind === 'insert' && cmd.nodeType) {
      // Single insert SSOT: resolve HOW the type lands (direct / auto-wrap / hint), then
      // compile + commit through the ONE placement grammar (resolvePlacementPlan → placePart).
      // Byte-identical to every other surface (the V6 invariant), now via the slot port (S0).
      const op = planPlacement(resolvePlacementPlan(page, null, selectedId, cmd.nodeType), { type: cmd.nodeType, makeId: newNodeId })
      if (!op) {
        // Blocked — no single unambiguous wrapper. Guide, never silently no-op.
        const rawLabel = nodeRegistry.getMeta(cmd.nodeType)?.label   // registry label (unknown)
        const label = typeof rawLabel === 'string' || (rawLabel != null && typeof rawLabel === 'object')
          ? resolveLocaleString(rawLabel as LocaleString, locale, 'en')
          : cmd.nodeType
        notify(insertNeedsContainerHint(label, locale), { type: 'info' })
        return
      }
      const insertedId = placeSlotPart(pageId, op, { insertNodes, moveNode, removeNode })
      markDirty(pageId)
      if (insertedId) selectNode(insertedId)   // select the inserted node (child, not the wrapper)
      return
    }

    if (cmd.kind === 'navigate' && cmd.nodeId) {
      selectNode(cmd.nodeId)
      return
    }

    if (cmd.kind === 'action' && cmd.action === 'delete' && selectedId) {
      removeNode(pageId, selectedId)
      markDirty(pageId)
      selectNode(null)
      return
    }

    if (cmd.kind === 'action' && cmd.action === 'duplicate' && selectedId) {
      const src = page.nodes[selectedId]
      if (!src) return
      // Clone the node's SHAPE (type/variant/props) as a sibling. Children are
      // not deep-cloned (YAGNI — a shallow duplicate is the document-editor
      // default; a deep clone would need fresh ids for the whole subtree).
      const clone = makeNode(src.type, newNodeId(), src.variant)
      clone.props = { ...src.props }
      // Find the container holding the source so the clone lands as its sibling.
      const parentId =
        page.nodeIds.includes(selectedId)
          ? pageId
          : Object.values(page.nodes).find((n) => n.childIds.includes(selectedId))?.id ?? pageId
      insertNode(pageId, clone, parentId)
      markDirty(pageId)
      selectNode(clone.id)
    }
  }, [page, pageId, selectedId, insertNodes, insertNode, moveNode, selectNode, removeNode, markDirty, navigate, notify, locale])
}
