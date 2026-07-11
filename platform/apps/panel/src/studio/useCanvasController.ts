import { useState, useCallback, useMemo } from 'react'
import { useConstructorStore, useActivePage, useSelectedNode, useChromeSelection, useSite, usePages } from '../store/constructor.store'
import { nodeSchemaSource } from '../inspector/schemaSource'
import { firstMetricField, isMetricBindable, bindMetricToProps } from '../discovery/metricBinding'
import { setAtPath } from '../inspector/showWhen'
import { resolveProjectedNode, type ProjectedNode } from '../canvas/nodeProjection'
import { makeNode } from '../canvas/insertNode'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import { projectCanvasSiteChrome } from '../canvas/canvasSiteChrome'
import type { VisibilityExpr } from '@statdash/engine'

// ── useCanvasController — the canvas↔store glue, extracted for reuse (AR-49 M1.2)
//
//  The wizard's PageStep grew a set of small store-wiring closures — metric bind,
//  palette drop, prop patch, node-level visibility, and the perspective-preview
//  view-state. The Studio shell needs the SAME wiring to mount the SAME canvas +
//  inspector into its docks. Rather than fork those closures (duplication) or edit
//  the wizard (forbidden in M1.2 — Strangler keeps it frozen until M1.3), the glue
//  is lifted here as one reusable hook built from the SAME shared primitives
//  (nodeSchemaSource / metricBinding / setAtPath / makeNode + store actions).
//
//  The writes are byte-identical to PageStep's (and to hand-authoring): a metric
//  bind funnels through firstMetricField → bindMetricToProps → updateNode; a drop
//  through makeNode → insertNode; a prop edit through setAtPath → updateNode. In
//  M1.3 the surviving canvas points here and PageStep's inline copy is deleted.

const newNodeId = () => `node-${Math.random().toString(36).slice(2, 9)}`

export function useCanvasController() {
  const page       = useActivePage()
  const selectedId = useSelectedNode()
  const chromeSel  = useChromeSelection()
  const site       = useSite()
  const pages      = usePages()
  const selectNode    = useConstructorStore((s) => s.selectNode)
  const insertNode    = useConstructorStore((s) => s.insertNode)
  const updateNode    = useConstructorStore((s) => s.updateNode)
  const removeNode    = useConstructorStore((s) => s.removeNode)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)

  // Transient canvas view-state (like PageStep's local state; not persisted).
  const [dragging, setDragging] = useState(false)
  const [previewPerspectiveId, setPreviewPerspectiveId] = useState<string | undefined>(undefined)

  const pageId   = page?.id ?? null
  // Selection resolves to a STORED tree node first; failing that, to a PROJECTED
  // value-band child (a promoted card the strip owns as items[], surfaced as its
  // own object — ADR-023 authoring twin). The projection carries write-back
  // provenance (owner node + field + index) so edits route back into items[].
  const projected: ProjectedNode | undefined =
    page && selectedId && !page.nodes[selectedId] ? resolveProjectedNode(page, selectedId) : undefined
  const selected = page && selectedId ? page.nodes[selectedId] ?? projected?.node ?? null : null
  const nodeConfig = page ? toNodePageConfig(page) : null
  const selectedBindable = selected ? isMetricBindable(nodeSchemaSource.getSchema(selected)) : false

  // The canvas's runner-parity chrome inputs (nav/chrome/chromeConfig) — projected
  // from the authoring session so the live canvas rail renders the REAL nav links +
  // slot config (WYSIWYG). Memoised on the two inputs it derives from.
  const canvasSite = useMemo(() => projectCanvasSiteChrome(site, pages), [site, pages])

  // Bind a governed metric onto a block — one write, both gestures (drag + click).
  const bindMetric = useCallback(
    (nodeId: string, metricId: string) => {
      if (!pageId || !page) return
      const node = page.nodes[nodeId]
      if (!node) return
      const field = firstMetricField(nodeSchemaSource.getSchema(node))
      if (!field) return
      updateNode(pageId, nodeId, { props: bindMetricToProps(node.props, field.field, metricId) })
      markPageDirty(pageId)
      selectNode(nodeId)
    },
    [pageId, page, updateNode, markPageDirty, selectNode],
  )

  // Palette drop → new node into a container's slot (parentId === pageId ⇒ top-level).
  const handleDrop = useCallback(
    (parentId: string, _slotKey: string, nodeType: string) => {
      if (!pageId || !page) return
      const node = makeNode(nodeType, newNodeId())
      insertNode(pageId, node, parentId)
      markPageDirty(pageId)
      selectNode(node.id)
    },
    [pageId, page, insertNode, markPageDirty, selectNode],
  )

  // Inspector onChange — write one prop on the selected node at its schema dot-path.
  // A PROJECTED card writes THROUGH to its owner strip's value band: the same
  // dot-path, re-based onto `items.<index>.<field>` (the card's schema fields are
  // 1:1 with the value-band item, so the re-base is an identity mapping). No stored
  // node exists for the card — the write lands on the strip that owns items[].
  const patchProp = useCallback(
    (field: string, value: unknown) => {
      if (!pageId || !page) return
      if (projected) {
        const owner = page.nodes[projected.owner.nodeId]
        if (!owner) return
        const path = `${projected.owner.field}.${projected.owner.index}.${field}`
        updateNode(pageId, owner.id, { props: setAtPath(owner.props, path, value) })
        markPageDirty(pageId)
        return
      }
      if (!selected) return
      updateNode(pageId, selected.id, { props: setAtPath(selected.props, field, value) })
      markPageDirty(pageId)
    },
    [pageId, page, projected, selected, updateNode, markPageDirty],
  )

  // Node-level view.visibleWhen gate — null clears it (byte-clean round-trip). A
  // PROJECTED card's visibility lives in the LEGACY value band as `items.<i>.when`
  // (the strip's stored residence, not yet migrated) — the projection surfaces it
  // as `view.visibleWhen` for the editor, so the write is mapped back to `when`.
  const setVisibleWhen = useCallback(
    (next: VisibilityExpr | undefined) => {
      if (!pageId || !page) return
      if (projected) {
        const owner = page.nodes[projected.owner.nodeId]
        if (!owner) return
        const base = `${projected.owner.field}.${projected.owner.index}`
        if (next == null) {
          const items = (owner.props[projected.owner.field] as Array<Record<string, unknown>>).map((it, i) =>
            i === projected.owner.index ? (() => { const { when: _drop, ...rest } = it; return rest })() : it,
          )
          updateNode(pageId, owner.id, { props: { ...owner.props, [projected.owner.field]: items } })
        } else {
          updateNode(pageId, owner.id, { props: setAtPath(owner.props, `${base}.when`, next) })
        }
        markPageDirty(pageId)
        return
      }
      if (!selected) return
      if (next == null) {
        const view = { ...(selected.props.view as Record<string, unknown> | undefined) }
        delete view.visibleWhen
        const nextProps = { ...selected.props, view }
        if (Object.keys(view).length === 0) delete (nextProps as Record<string, unknown>).view
        updateNode(pageId, selected.id, { props: nextProps })
      } else {
        updateNode(pageId, selected.id, { props: setAtPath(selected.props, 'view.visibleWhen', next) })
      }
      markPageDirty(pageId)
    },
    [pageId, page, projected, selected, updateNode, markPageDirty],
  )

  // Delete a PROJECTED card = splice it out of the owner strip's value band; a
  // stored node deletes normally. Selection clears in both cases.
  const deleteSelected = useCallback(() => {
    if (!pageId || !page) return
    if (projected) {
      const owner = page.nodes[projected.owner.nodeId]
      if (!owner) return
      const items = (owner.props[projected.owner.field] as unknown[]).filter((_it, i) => i !== projected.owner.index)
      updateNode(pageId, owner.id, { props: { ...owner.props, [projected.owner.field]: items } })
      markPageDirty(pageId)
      selectNode(null)
      return
    }
    if (!selected) return
    removeNode(pageId, selected.id)
    markPageDirty(pageId)
    selectNode(null)
  }, [pageId, page, projected, selected, removeNode, updateNode, markPageDirty, selectNode])

  return {
    page, pageId, selected, selectedId, chromeSel, nodeConfig, selectedBindable,
    canvasSite,
    dragging, setDragging,
    previewPerspectiveId, setPreviewPerspectiveId,
    selectNode,
    bindMetric, handleDrop, patchProp, setVisibleWhen, deleteSelected,
  }
}

export type CanvasController = ReturnType<typeof useCanvasController>
