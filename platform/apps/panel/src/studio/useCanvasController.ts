import { useState, useCallback, useMemo } from 'react'
import { useConstructorStore, useActivePage, useSelectedNode, useSelectedItemPath, useSite, usePages } from '../store/constructor.store'
import { nodeSchemaSource } from '../inspector/schemaSource'
import { firstMetricField, isMetricBindable, bindMetricToProps } from '../discovery/metricBinding'
import { setAtPath } from '../inspector/showWhen'
import { enumerateParts, getPartSource } from '../canvas/bandSource'
import { resolvePlacementPlan, planPlacement, resolveInsertPlan, planPresetPlacement } from '../canvas/insertNode'
import { placeSlotPart } from '../canvas/placeNode'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import { projectCanvasSiteChrome } from '../canvas/canvasSiteChrome'
import { nodeRegistry, chromeRegistry, presetRegistry, SITE_FRAME_ID, SITE_FRAME_META, CHROME_PART_PREFIX } from '@statdash/react/engine'
import type { PartAddress, PartResidence, ObjectMeta, PropSchema, PropertyGroup, PartSourceContext } from '@statdash/react/engine'
import { CHROME_STRUCTURAL_FIELDS } from '../inspector/facets/chromeFacetModel'
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
  /** The OWNING element's id — a page node, or `SITE_FRAME_ID` for a chrome region.
   *  Drives the dock crumb's back-target + the item Inspector's id namespace, so the
   *  dock projection never reaches the (possibly absent) page node directly. */
  ownerId:     string
  /** The owning element's crumb label (a page node's type, or the chrome parent token). */
  ownerLabel:  string
  /** Whether "Back" reselects the owner as a WHOLE node (a real page node) or DESELECTS
   *  (the synthetic site-frame has no whole-node authoring surface). */
  ownerSelectable: boolean
  /** A pre-resolved crumb title, when the part's title is not on its subject (a chrome
   *  region's title is its slot name); else undefined → the generic `itemTitle` fallback. */
  crumbTitle?: string
  /** The part's own declared ELEMENT META, when it HAS one (a chrome region → its
   *  `ChromeSliceMeta`). The FACET axis reads it to project the part's universal facets
   *  (chrome → variant/region/order). A positional value/filter part carries none (its
   *  contract is an `itemSchema`, projected by `element.schema`) → the facets stay hidden
   *  during a value-band drill, exactly as before this facet extension. */
  partMeta?:   ObjectMeta
  /** The part's STRUCTURAL subject — the `ChromeSlotConfig` top level (`variant`/`region`/
   *  `order`) a chrome region's facet edits, distinct from `itemObject` (its `config` bag). */
  slotConfig?: Record<string, unknown>
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
  const site       = useSite()
  const pages      = usePages()
  const selectNode    = useConstructorStore((s) => s.selectNode)
  const selectItem    = useConstructorStore((s) => s.selectItem)
  const selectChrome  = useConstructorStore((s) => s.selectChrome)
  const insertNodes   = useConstructorStore((s) => s.insertNodes)
  const moveNode      = useConstructorStore((s) => s.moveNode)
  const updateNode    = useConstructorStore((s) => s.updateNode)
  const updatePage    = useConstructorStore((s) => s.updatePage)
  const updateChromeConfig = useConstructorStore((s) => s.updateChromeConfig)
  const updateChromeSlotField = useConstructorStore((s) => s.updateChromeSlotField)
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

  // The ONE Part-source context — the external SSOTs a `sourced` part projects: the
  // page filter schema (`page-filters`) and the site chrome map (`site-chrome`, S6).
  // A new sourced consumer adds one field here; the port signature is unchanged (OCP).
  const partCtx = useMemo<PartSourceContext>(
    () => ({ filterSchema, chrome: site.chrome }),
    [filterSchema, site.chrome],
  )

  // ── Bounded part selection (ADR-041) — resolved through the ONE Part port ──────
  //  When a part (value-band item / filter control / chrome region) is selected,
  //  enumerate the OWNING element's parts through `enumerateParts` — the ONE port that
  //  reads its declared `PartField`s and routes each to its residence adapter (value/
  //  sourced/slot) — and pick the one matching the selection wire. The owning element is
  //  resolved GENERICALLY: a real page node, OR the synthetic SITE-FRAME (which owns the
  //  chrome parts and is never in `page.nodes`). The port carries each part's OWN
  //  contract + live subject, so the dock projects a bounded element with NO per-type
  //  branch and NO residence-specific reach — a chrome region flows through the EXACT
  //  same projection as a filter control.
  const selectedBand: SelectedPart | null = useMemo(() => {
    if (!selectedItemPath || !selectedId) return null
    // The owning element — a page node, or the site-frame (chrome parts, S6). The
    // site-frame carries no whole-node authoring surface, so its parts' "Back" deselects.
    const owner = selected
      ? {
          id: selected.id, container: selected.props, label: selected.type, selectable: true,
          meta: nodeRegistry.getMeta(selected.type, selected.variant) as ObjectMeta | undefined,
        }
      : selectedId === SITE_FRAME_ID
        // The site-frame is now a REACHABLE whole element (D-CH1): its parts' "Back"
        // reselects it (selectable: true) → the chrome-composition inspector, where the
        // WHOLE set of regions (enable/variant/order) is managed — not just per-region config.
        ? { id: SITE_FRAME_ID, container: {} as Record<string, unknown>, label: CHROME_PART_PREFIX, selectable: true, meta: SITE_FRAME_META }
        : null
    if (!owner) return null
    // Match on the ONE `PartAddress.partPath` — the SAME stable-key address the selection
    // stores (positional for value, Delta-1 key for sourced/chrome). The address is the
    // identity (ADR-041 R4); no positional re-derivation.
    const found = enumerateParts(owner.container, owner.meta, partCtx, owner.id)
      .find((p) => p.address.partPath === selectedItemPath)
    if (!found) return null
    // A chrome region carries its OWN element META (the ChromeSliceMeta for the resolved
    // variant) + its structural subject (the ChromeSlotConfig top level) — the FACET-axis
    // inputs. A positional value/filter part carries neither (source ≠ 'site-chrome').
    const isChrome  = found.source === 'site-chrome'
    const slotEntry = isChrome
      ? (site.chrome[found.field] as unknown as Record<string, unknown> | undefined)
      : undefined
    const variant   = (slotEntry?.variant as string | undefined) ?? 'default'
    const partMeta  = isChrome
      ? (chromeRegistry.getMeta(found.field, variant) as ObjectMeta | undefined)
      : undefined
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
      ownerId:    owner.id,
      ownerLabel: owner.label,
      ownerSelectable: owner.selectable,
      // A chrome region's title is its slot name (not on its subject); a page-node part
      // uses the generic `itemTitle` fallback.
      crumbTitle: isChrome ? found.field : undefined,
      partMeta,
      slotConfig: isChrome ? (slotEntry ?? {}) : undefined,
    }
  }, [selected, selectedId, selectedItemPath, site.chrome, partCtx])

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
    (parentId: string, _slotKey: string, nodeType: string, presetId?: string) => {
      if (!pageId || !page) return
      const container = parentId === pageId ? null : parentId
      // A PRESET drop (ADR-049 P2b): expand the registered composed whole through the SAME
      // placement resolver a bare tile uses — the preset ROOT flows through `resolveInsertPlan`
      // (→ direct / wrap / blocked), then `planPresetInserts` overlays `makeNode` recursively
      // so the bound DataSpec + pre-wired trend/visibility/children all land as ONE undoable
      // action. Falls back to the bare-tile path when no preset rides the drop. Both commit
      // through the ONE slot-residence port (`placeSlotPart`) — one placement grammar.
      const preset = presetId ? presetRegistry.get(presetId) : undefined
      const op = preset
        ? planPresetPlacement(preset.seed, resolveInsertPlan(page, container, preset.seed.type), newNodeId)
        // ONE placement grammar: resolve the plan, compile the op, commit through placePart
        // (the slot-residence structural port). Byte-identical to the old resolveInsertPlan
        // → planInserts → insertNodes path — the seam, not a behaviour change (Slice 0).
        : planPlacement(resolvePlacementPlan(page, null, container, nodeType), { type: nodeType, makeId: newNodeId })
      if (!op) return
      const insertedId = placeSlotPart(pageId, op, { insertNodes, moveNode, removeNode })
      markPageDirty(pageId)
      if (insertedId) selectNode(insertedId) // select the inserted leaf, not the wrapper
    },
    [pageId, page, insertNodes, moveNode, removeNode, markPageDirty, selectNode],
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
  //   • sourced band (filter-schema) → `updatePage({ meta.filterSchema })` via setBarParams;
  //   • chrome region (site-chrome) → `updateChromeConfig` (the site SSOT — no page node
  //     required, since the site-frame owns the part, not a page node).
  // No denormalised copy on any node (CLAUDE.md Law 2 / SSOT).
  const patchItemProp = useCallback(
    (subfield: string, value: unknown) => {
      if (!selectedBand) return
      // The value adapter reads the owning node's props to build the merged write; the
      // sourced/chrome adapters ignore the element (they read ctx / write a keyed SSOT).
      const mut = getPartSource(selectedBand.residence, selectedBand.source)
        ?.writePart(selected?.props ?? {}, selectedBand.address, subfield, value, partCtx)
      if (!mut) return
      if (mut.target === 'node-props') {
        if (!pageId || !selected) return
        updateNode(pageId, selected.id, { props: mut.props })
        markPageDirty(pageId)
      } else if (mut.target === 'filter-schema') {
        if (!pageId || !page) return
        updatePage(pageId, { meta: { ...page.meta, filterSchema: mut.schema } })
        markPageDirty(pageId)
      } else if (mut.target === 'site-chrome') {
        updateChromeConfig(mut.slot, mut.field, mut.value)
      }
    },
    [pageId, selected, page, selectedBand, partCtx, updateNode, updatePage, updateChromeConfig, markPageDirty],
  )

  // Chrome STRUCTURAL facet onChange — write one top-level ChromeSlotConfig field
  // (`variant`/`region`/`order`) of the SELECTED chrome region, through the structural
  // write lane (`updateChromeSlotField` → the site SSOT). This is the FACET-axis peer of
  // `patchItemProp` (which writes the region's `config` bag): a chrome region's full
  // contract = its config (element.schema) ⊕ its structural facets (element.facet.chrome),
  // two residence-tagged lanes over the ONE `site.chrome[slot]` shape (no denormalised
  // node copy). Guarded to a chrome region declaring a structural field (never a mis-write).
  const patchChromeStructural = useCallback(
    (field: string, value: unknown) => {
      if (!selectedBand || selectedBand.source !== 'site-chrome') return
      if (!CHROME_STRUCTURAL_FIELDS.has(field)) return
      updateChromeSlotField(selectedBand.field, field, value)
    },
    [selectedBand, updateChromeSlotField],
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
    page, pageId, selected, selectedId, nodeConfig, selectedBindable,
    // Bounded band-item selection (ADR-038): the drilled item path + its resolved
    // declared contract + the item write path.
    selectedItemPath, selectedBand,
    canvasSite,
    dragging, setDragging,
    previewPerspectiveId, setPreviewPerspectiveId,
    selectNode, selectItem, selectChrome,
    bindMetric, handleDrop, patchProp, patchItemProp, patchChromeStructural, setVisibleWhen, deleteSelected,
  }
}

export type CanvasController = ReturnType<typeof useCanvasController>
