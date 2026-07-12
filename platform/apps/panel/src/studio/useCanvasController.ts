import { useState, useCallback, useMemo } from 'react'
import { useConstructorStore, useActivePage, useSelectedNode, useSelectedItemPath, useChromeSelection, useSite, usePages } from '../store/constructor.store'
import { nodeSchemaSource } from '../inspector/schemaSource'
import { firstMetricField, isMetricBindable, bindMetricToProps } from '../discovery/metricBinding'
import { setAtPath } from '../inspector/showWhen'
import { enumerateParts, getPartSource } from '../canvas/bandSource'
import { resolveInsertPlan, planInserts } from '../canvas/insertNode'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import { projectCanvasSiteChrome } from '../canvas/canvasSiteChrome'
import { nodeRegistry } from '@statdash/react/engine'
import type { PartAddress, PartResidence, ObjectMeta, PropSchema, PropertyGroup } from '@statdash/react/engine'
import type { VisibilityExpr, FilterSchemaInput } from '@statdash/engine'

/** The selected bounded PART, resolved through the port — the item projection the dock
 *  renders (its own contract + live subject + crumb coordinates), plus the residence +
 *  the ONE STABLE `PartAddress` the port write commits through (ADR-041 Ph.3). */
interface SelectedPart {
  field:       string
  index:       number
  /** The part's `PartAddress.partPath` — the session selection wire (stable for sourced). */
  path:        string
  itemSchema:  PropSchema
  itemGroups:  PropertyGroup[]
  itemLabel?:  string
  /** The part's live value object — the bounded subject the Inspector edits. */
  itemObject:  Record<string, unknown>
  residence:   PartResidence
  /** sourced residence: the adapter id (Delta 1), re-resolved for the WRITE. */
  source?:     string
  address:     PartAddress
}

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
  const selectedItemPath = useSelectedItemPath()
  const chromeSel  = useChromeSelection()
  const site       = useSite()
  const pages      = usePages()
  const selectNode    = useConstructorStore((s) => s.selectNode)
  const selectItem    = useConstructorStore((s) => s.selectItem)
  const selectChrome  = useConstructorStore((s) => s.selectChrome)
  const insertNodes   = useConstructorStore((s) => s.insertNodes)
  const updateNode    = useConstructorStore((s) => s.updateNode)
  const updatePage    = useConstructorStore((s) => s.updatePage)
  const removeNode    = useConstructorStore((s) => s.removeNode)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)

  // Transient canvas view-state (like PageStep's local state; not persisted).
  const [dragging, setDragging] = useState(false)
  const [previewPerspectiveId, setPreviewPerspectiveId] = useState<string | undefined>(undefined)

  const pageId   = page?.id ?? null
  const selected = page && selectedId ? page.nodes[selectedId] ?? null : null
  const nodeConfig = page ? toNodePageConfig(page) : null
  const selectedBindable = selected ? isMetricBindable(nodeSchemaSource.getSchema(selected)) : false

  // The page-owned filter SSOT (a page-owned band source reads/writes it, never a
  // denormalised node copy — CLAUDE.md Law 2 / SSOT).
  const filterSchema = page?.meta?.filterSchema as FilterSchemaInput | undefined

  // ── Bounded part selection (ADR-041) — resolved through the ONE Part port ──────
  //  When a part (value-band item / filter control) is selected, enumerate the node's
  //  parts through `enumerateParts` — the ONE port that reads the node's declared
  //  `PartField`s and routes each to its residence adapter (value/sourced/slot) — and
  //  pick the one matching the (positional) selection wire. The port carries each
  //  part's OWN contract + live subject, so the dock projects a bounded element with
  //  NO per-type branch and NO residence-specific reach. The resolved part also
  //  carries its residence + STABLE address, through which the edit commits (below).
  const selectedBand: SelectedPart | null = useMemo(() => {
    if (!selected || !selectedItemPath) return null
    const meta = nodeRegistry.getMeta(selected.type, selected.variant) as ObjectMeta | undefined
    // Match on the ONE `PartAddress.partPath` — the SAME stable-key address the
    // selection now stores (positional for value, Delta-1 key for sourced). No
    // positional re-derivation: the address is the identity (ADR-041 Ph.3).
    const found = enumerateParts(selected.props, meta, { filterSchema }, selected.id)
      .find((p) => p.address.partPath === selectedItemPath)
    if (!found) return null
    return {
      field:      found.field,
      index:      found.index,
      path:       found.address.partPath ?? selectedItemPath,
      itemSchema: found.contract,
      itemGroups: found.itemGroups ?? [],
      itemLabel:  found.itemLabel,
      itemObject: found.subject,
      residence:  found.residence,
      source:     found.source,            // the sourced adapter id (Delta 1) — re-resolved on write
      address:    found.address,           // the ONE STABLE address the write commits through
    }
  }, [selected, selectedItemPath, filterSchema])

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

  // Palette drop → resolve through the SAME insert path every surface uses (⌘K /
  // slash / outline share `resolveInsertPlan` + `planInserts`, insertNode.ts). So a
  // palette drop onto the page root AUTO-WRAPS (page → section → type) exactly like a
  // command insert — closing the "blank page only section" gap (SPEC S2): the honest
  // palette offers wrap-reachable tiles and this makes them actually land. The drop
  // target IS the insertion container: a real container node nests directly; the page
  // root (parentId === pageId, not in page.nodes) resolves to direct-page or the
  // canonical wrap. A 'blocked' plan compiles to zero ops — never an invalid tree.
  const handleDrop = useCallback(
    (parentId: string, _slotKey: string, nodeType: string) => {
      if (!pageId || !page) return
      const container = parentId === pageId ? null : parentId
      const ops = planInserts(resolveInsertPlan(page, container, nodeType), nodeType, newNodeId)
      if (ops.length === 0) return
      insertNodes(pageId, ops)
      markPageDirty(pageId)
      selectNode(ops[ops.length - 1].node.id) // select the inserted leaf, not the wrapper
    },
    [pageId, page, insertNodes, markPageDirty, selectNode],
  )

  // Inspector onChange — write one prop on the selected node at its schema dot-path.
  const patchProp = useCallback(
    (field: string, value: unknown) => {
      if (!pageId || !selected) return
      updateNode(pageId, selected.id, { props: setAtPath(selected.props, field, value) })
      markPageDirty(pageId)
    },
    [pageId, selected, updateNode, markPageDirty],
  )

  // Bounded part onChange — write one subfield of the SELECTED part, RESIDENCE-ROUTED
  // through the port. The item Inspector is projected over the part's own contract, so
  // `subfield` is one of its declared fields; the residence adapter returns a residence-
  // tagged mutation the host commits at its true home:
  //   • value band (node-props)  → `updateNode` (immutable, only the touched branch clones);
  //   • sourced band (filter-schema) → `updatePage({ meta.filterSchema })` via setBarParams
  //     (the ONE SSOT, no denormalised copy on the node — CLAUDE.md Law 2).
  const patchItemProp = useCallback(
    (subfield: string, value: unknown) => {
      if (!pageId || !selected || !page || !selectedBand) return
      const mut = getPartSource(selectedBand.residence, selectedBand.source)
        ?.writePart(selected.props, selectedBand.address, subfield, value, { filterSchema })
      if (!mut) return
      if (mut.target === 'node-props') {
        updateNode(pageId, selected.id, { props: mut.props })
      } else if (mut.target === 'filter-schema') {
        updatePage(pageId, { meta: { ...page.meta, filterSchema: mut.schema } })
      }
      markPageDirty(pageId)
    },
    [pageId, selected, page, selectedBand, filterSchema, updateNode, updatePage, markPageDirty],
  )

  // Node-level view.visibleWhen gate — null clears it (byte-clean round-trip).
  const setVisibleWhen = useCallback(
    (next: VisibilityExpr | undefined) => {
      if (!pageId || !selected) return
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
    [pageId, selected, updateNode, markPageDirty],
  )

  const deleteSelected = useCallback(() => {
    if (!pageId || !selected) return
    removeNode(pageId, selected.id)
    markPageDirty(pageId)
    selectNode(null)
  }, [pageId, selected, removeNode, markPageDirty, selectNode])

  return {
    page, pageId, selected, selectedId, chromeSel, nodeConfig, selectedBindable,
    // Bounded band-item selection (ADR-038): the drilled item path + its resolved
    // declared contract + the item write path.
    selectedItemPath, selectedBand,
    canvasSite,
    dragging, setDragging,
    previewPerspectiveId, setPreviewPerspectiveId,
    selectNode, selectItem, selectChrome,
    bindMetric, handleDrop, patchProp, patchItemProp, setVisibleWhen, deleteSelected,
  }
}

export type CanvasController = ReturnType<typeof useCanvasController>
