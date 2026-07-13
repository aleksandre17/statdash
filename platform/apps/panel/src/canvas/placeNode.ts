// ── placeNode — the ONE slot-residence structural-commit site (ADR-042 D2 · Slice 0) ─
//
//  Every structural node edit (palette/command insert · outline move) resolves a
//  `PlacementPlan` (`resolvePlacementPlan`), compiles a `PlacementOp` (`planPlacement`),
//  and lands HERE: `getPartSource('slot').placePart` tags it as a residence-keyed
//  `PartMutation` (`node-children`), and this ONE switch commits it through the store's
//  tree reducers. So NO surface calls `moveNode` / `insertNodes` directly — the placement
//  grammar is the port (`FF-ONE-PLACEMENT-GRAMMAR`). This is the structural peer of the
//  scalar commit switch in `useCanvasController.patchItemProp` (which routes `node-props` /
//  `filter-schema` / `site-chrome`) — the SAME residence-tagged-mutation discipline, one
//  more target (`node-children`).
//
import { getPartSource } from './bandSource'
import type { PlacementOp } from '@statdash/react/engine'
import type { CanvasNode } from '../types/constructor'

/** The store's tree reducers — the SSOT that owns the childId/nodeIds algebra. The commit
 *  site holds them by injection so it stays a pure router (testable without the store). */
export interface PlacementStoreActions {
  insertNodes: (pageId: string, ops: ReadonlyArray<{ node: CanvasNode; parentId: string; index?: number }>) => void
  moveNode:    (pageId: string, nodeId: string, parentId: string, index?: number) => void
  removeNode:  (pageId: string, nodeId: string) => void
}

/**
 * Route a resolved slot-residence `PlacementOp` through the ONE Part port and commit its
 * residence-tagged mutation to the store. Returns the id of the newly-inserted leaf (the
 * last built node — the selection target for an insert), or null (a move/remove/no-op has
 * no fresh id to select). The dispatch is by RESIDENCE (`getPartSource('slot')`) then by
 * the mutation's `op.kind` — never by a node type (Law 1).
 */
export function placeSlotPart(
  pageId:  string,
  op:      PlacementOp,
  actions: PlacementStoreActions,
): string | null {
  const mut = getPartSource('slot')?.placePart({}, op, {})
  if (!mut || mut.target !== 'node-children') return null
  const nco = mut.op
  if (nco.kind === 'insert') {
    if (nco.ops.length === 0) return null
    // Re-type the opaque port nodes back to CanvasNode at the commit boundary (the app owns
    // the concrete shape; the port carried it verbatim as a record).
    const ops = nco.ops as unknown as ReadonlyArray<{ node: CanvasNode; parentId: string; index?: number }>
    actions.insertNodes(pageId, ops)
    return ops[ops.length - 1].node.id
  }
  if (nco.kind === 'move') {
    actions.moveNode(pageId, nco.nodeId, nco.parentId, nco.index)
    return null
  }
  actions.removeNode(pageId, nco.nodeId)   // kind === 'remove'
  return null
}
