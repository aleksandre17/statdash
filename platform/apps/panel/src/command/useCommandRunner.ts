// ── useCommandRunner — execute a Command against the store (V6) ───────────────
//
//  The single executor for every command surface (Cmd-K palette + slash-insert).
//  An INSERT command builds the node with the SAME makeNode helper and writes it
//  through the SAME insertNode store action the drag palette uses, into the
//  container resolveInsertParent picks from the current selection — so a Cmd-K /
//  slash insert is byte-identical to a palette drop (the V6 invariant).
//
//  Navigate selects; duplicate clones the selected node's shape into its
//  container; delete removes it. All mutations route through existing store
//  actions (history-composed) — no parallel mutation engine.
//
import { useCallback } from 'react'
import {
  useConstructorStore, useActivePage, useActivePageId, useSelectedNode,
} from '../store/constructor.store'
import { makeNode, resolveInsertParent } from '../canvas/insertNode'
import { useSetRole } from '../studio/useRole'
import type { Command } from './commandModel'

// Same id factory shape PageStep uses (collision-resistant short id).
const newNodeId = () => `node-${Math.random().toString(36).slice(2, 9)}`

export function useCommandRunner() {
  const page       = useActivePage()
  const pageId     = useActivePageId()
  const selectedId = useSelectedNode()
  const insertNode = useConstructorStore((s) => s.insertNode)
  const selectNode = useConstructorStore((s) => s.selectNode)
  const removeNode = useConstructorStore((s) => s.removeNode)
  const markDirty  = useConstructorStore((s) => s.markPageDirty)
  const setSurface = useConstructorStore((s) => s.setSurface)
  const setRole    = useSetRole()

  return useCallback((cmd: Command) => {
    // Workspace navigation is document-independent (no active page required), so it
    // runs BEFORE the page guard. "Data model" is the composed one-action jump: set
    // the Steward lens (through the useSetRole seam — never the store source) AND
    // open the Model surface, landing the user directly in metric authoring.
    if (cmd.kind === 'action' && cmd.action === 'open-data-model') {
      setRole('steward')
      setSurface('model')
      return
    }

    if (!page || !pageId) return

    if (cmd.kind === 'insert' && cmd.nodeType) {
      const parentId = resolveInsertParent(page, selectedId, cmd.nodeType)
      const node = makeNode(cmd.nodeType, newNodeId())
      insertNode(pageId, node, parentId)
      markDirty(pageId)
      selectNode(node.id)
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
  }, [page, pageId, selectedId, insertNode, selectNode, removeNode, markDirty, setSurface, setRole])
}
