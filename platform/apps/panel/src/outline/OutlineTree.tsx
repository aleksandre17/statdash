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
import { resolvePlacementPlan, planPlacement } from '../canvas/insertNode'
import { placeSlotPart } from '../canvas/placeNode'
import { useSetSurface } from '../studio/useStudioRoute'
import { StudioEmptyState } from '../studio/StudioEmptyState'
import { buildOutlineRows, type OutlineRow } from './outlineModel'
import { OutlineItem } from './OutlineItem'
import type { Locale } from '../types/constructor'
import './outline.css'

export function OutlineTree({ locale = 'ka' }: { locale?: Locale } = {}) {
  const page       = useActivePage()
  const pageId     = useActivePageId()
  const selectedId = useSelectedNode()
  const selectNode = useConstructorStore((s) => s.selectNode)
  const insertNodes = useConstructorStore((s) => s.insertNodes)
  const moveNode   = useConstructorStore((s) => s.moveNode)
  const removeNode = useConstructorStore((s) => s.removeNode)
  const markDirty  = useConstructorStore((s) => s.markPageDirty)
  const setSurface = useSetSurface()
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

  // ── Drag-end: resolve the drop into ONE placement plan, commit through the port ──
  //
  //  The nest-vs-reorder decision is no longer a local heuristic: it is `resolvePlacementPlan`
  //  (source present ⇒ move), the SAME resolved plan the canvas surface uses, gated by the ONE
  //  `slotAdmits` — then compiled to a `PlacementOp` and committed through `placeSlotPart` (the
  //  slot-residence structural port). Byte-identical to the retired Candidate-A/B logic; the
  //  navigator and canvas now speak ONE placement grammar (ADR-042 D2, Slice 0).
  //
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setDragId(null)
    if (!page || !pageId) return
    const activeId = String(e.active.id)
    const overId   = e.over ? String(e.over.id) : null
    if (!overId || overId === activeId) return

    const dragged = page.nodes[activeId]
    if (!dragged) return

    const op = planPlacement(resolvePlacementPlan(page, activeId, overId, dragged.type), { source: activeId })
    if (!op) return
    placeSlotPart(pageId, op, { insertNodes, moveNode, removeNode })
    markDirty(pageId)
  }, [page, pageId, insertNodes, moveNode, removeNode, markDirty])

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

  // No effective page ⇒ no pages exist (always-a-home). The single empty-state
  // component owns the copy (FF-ONE-EMPTYSTATE) — no inline literal here.
  if (!page) {
    return <StudioEmptyState kind="no-pages" locale={locale} />
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
        </ul>
      </SortableContext>
      {/* Page selected but empty → the page-blank empty-state (single component),
          its CTA routing to the Insert surface. Rendered OUTSIDE the tree <ul> so
          the tree stays valid (no non-treeitem child). */}
      {rows.length === 0 && (
        <StudioEmptyState kind="page-blank" locale={locale} onAction={() => setSurface('insert')} />
      )}
    </DndContext>
  )
}
