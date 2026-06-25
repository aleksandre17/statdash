// ── OutlineTree — Webflow-Navigator structural tree over the SAME store (V6) ──
//
//  A structural navigation pane beside the WYSIWYG canvas. It is NOT a second
//  model: it projects the Constructor store's flat CanvasPage (buildOutlineRows)
//  and writes back through the store's selectNode / moveNode / removeNode — the
//  canvas and the Outline are two views of one source of truth, so selection is
//  bidirectional and a reorder is byte-identical to a canvas reorder.
//
//  Interaction:
//    • click / Enter / Space  → select (bidirectionally synced with the canvas).
//    • drag (pointer OR keyboard, dnd-kit shared sensors) → reorder / re-nest,
//      respecting the registry's slot `accepts` contract (nestAccepts) so an
//      invalid nest is refused. Keyboard drag is the WCAG equivalent of pointer.
//    • ▶/▼ toggle → collapse / expand (view state, never touches config).
//    • Delete / ⌫ on a focused row → remove the node.
//
//  Accessibility: role="tree" + role="treeitem" with aria-level / aria-posinset /
//  aria-setsize / aria-selected / aria-expanded; roving arrow-key navigation
//  (↑/↓ move, ←/→ collapse-or-ascend / expand-or-descend) per the WAI-ARIA
//  Tree View pattern.
//
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDndSensors } from '../shared/dnd/useDndSensors'
import {
  useConstructorStore, useActivePage, useActivePageId, useSelectedNode,
} from '../store/constructor.store'
import { nestAccepts } from '../canvas/insertNode'
import { buildOutlineRows, type OutlineRow } from './outlineModel'
import { OutlineItem } from './OutlineItem'
import './outline.css'

export function OutlineTree() {
  const page       = useActivePage()
  const pageId     = useActivePageId()
  const selectedId = useSelectedNode()
  const selectNode = useConstructorStore((s) => s.selectNode)
  const moveNode   = useConstructorStore((s) => s.moveNode)
  const removeNode = useConstructorStore((s) => s.removeNode)
  const markDirty  = useConstructorStore((s) => s.markPageDirty)
  const sensors    = useDndSensors()

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [dragId, setDragId]       = useState<string | null>(null)
  const treeRef = useRef<HTMLUListElement>(null)

  const rows = useMemo<OutlineRow[]>(
    () => (page ? buildOutlineRows(page, collapsed) : []),
    [page, collapsed],
  )
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    if (!pageId) return
    removeNode(pageId, id)
    markDirty(pageId)
    if (selectedId === id) selectNode(null)
  }, [pageId, removeNode, markDirty, selectedId, selectNode])

  // ── Drag-end: translate a sortable drop into a (parentId, index) store move ──
  //
  //  Default behaviour (Principle of Least Astonishment): a drop places the
  //  dragged node as a SIBLING of the drop target, in the target's container, at
  //  the target's position. Re-nest "into" a container happens when the target is
  //  itself an empty/accepting container row dropped onto directly — kept simple:
  //  we nest into the target when it accepts the type AND the drag crosses INTO
  //  it (target is a container the dragged node isn't already a sibling within).
  //
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setDragId(null)
    if (!page || !pageId) return
    const activeId = String(e.active.id)
    const overId   = e.over ? String(e.over.id) : null
    if (!overId || overId === activeId) return

    const dragged = page.nodes[activeId]
    const target  = rows.find((r) => r.id === overId)
    if (!dragged || !target) return

    // Candidate A — nest INTO the target (target is an accepting container).
    if (nestAccepts(target.type, dragged.type) && page.nodes[overId]?.childIds != null) {
      const isContainer = page.nodes[overId].childIds.length > 0 || target.hasChildren
      // Only auto-nest when the target genuinely models children AND the drop is a
      // cross-container move; otherwise treat as a sibling reorder (below).
      if (isContainer && target.parentId !== activeId) {
        moveNode(pageId, activeId, overId, 0)
        markDirty(pageId)
        return
      }
    }

    // Candidate B — sibling reorder within the target's container.
    if (nestAccepts(parentTypeOf(target.parentId), dragged.type)) {
      const siblings = containerOrder(target.parentId)
      const fromIdx  = siblings.indexOf(activeId)
      let toIdx      = siblings.indexOf(overId)
      // Dropping below the current position shifts the index down by one after detach.
      if (fromIdx !== -1 && fromIdx < toIdx) toIdx -= 1
      moveNode(pageId, activeId, target.parentId, toIdx < 0 ? undefined : toIdx)
      markDirty(pageId)
    }

    function parentTypeOf(parentId: string): string | undefined {
      return parentId === page!.id ? undefined : page!.nodes[parentId]?.type
    }
    function containerOrder(parentId: string): string[] {
      return parentId === page!.id ? page!.nodeIds : (page!.nodes[parentId]?.childIds ?? [])
    }
  }, [page, pageId, rows, moveNode, markDirty])

  // ── Roving arrow-key navigation (WAI-ARIA tree pattern) ────────────────────
  const focusRow = useCallback((id: string | null) => {
    if (!id) return
    treeRef.current?.querySelector<HTMLElement>(`[data-outline-id="${id}"]`)?.focus()
  }, [])

  const handleKeyNav = useCallback((e: React.KeyboardEvent, row: OutlineRow) => {
    const idx = rows.findIndex((r) => r.id === row.id)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault(); focusRow(rows[idx + 1]?.id ?? null); break
      case 'ArrowUp':
        e.preventDefault(); focusRow(rows[idx - 1]?.id ?? null); break
      case 'ArrowRight':
        e.preventDefault()
        if (row.hasChildren && collapsed.has(row.id)) toggleCollapse(row.id)
        else if (row.hasChildren) focusRow(rows[idx + 1]?.id ?? null)
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (row.hasChildren && !collapsed.has(row.id)) toggleCollapse(row.id)
        else if (row.parentId !== pageId) focusRow(row.parentId)
        break
      default:
        break
    }
  }, [rows, collapsed, focusRow, toggleCollapse, pageId])

  if (!page) {
    return (
      <div className="outline outline--empty" data-testid="outline-empty">
        <span className="outline__empty-text">გვერდი არ არის არჩეული</span>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={treeRef}
          className="outline"
          role="tree"
          aria-label="Page outline"
          data-testid="outline-tree"
        >
          {rows.map((row) => (
            <OutlineItem
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              collapsed={collapsed.has(row.id)}
              dragging={dragId === row.id}
              onSelect={selectNode}
              onToggle={toggleCollapse}
              onDelete={handleDelete}
              onKeyNav={handleKeyNav}
            />
          ))}
          {rows.length === 0 && (
            <li className="outline__empty-text" role="treeitem" aria-disabled="true">
              ცარიელი გვერდი — გადმოიტანეთ ელემენტი
            </li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
