import { useState, useCallback, lazy, Suspense } from 'react'
import { Box, Typography, Paper, Chip, Divider, Button } from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import { useConstructorStore, useActivePage, useSelectedNode, useChromeSelection } from '../../../store/constructor.store'
import { NodePalette }   from '../../../canvas/NodePalette'
import { MetricPalette } from '../../../discovery/MetricPalette'
import { nodeSchemaSource } from '../../../inspector/schemaSource'
import { firstMetricField, isMetricBindable, bindMetricToProps } from '../../../discovery/metricBinding'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import { OutlineTree }   from '../../../outline'
import { useCommandPalette } from '../../../command/useCommandPalette'
import { SuspenseFallback } from '../../../shared/SuspenseFallback'
import { makeNode }      from '../../../canvas/insertNode'

// ── Heavy sub-surfaces, split out of the PageStep chunk ───────────────────────
//
//  CanvasView is the single heaviest dependency in the panel: it mounts the REAL
//  @statdash/react NodePageRenderer, which pulls the whole panel registry and
//  ApexCharts. CommandPalette pulls cmdk. Both are deferred to their own chunks so
//  they load only when the canvas paints / the palette opens — transparent (same
//  components, identical behavior), just no longer in the eager PageStep chunk.
const CanvasView = lazy(() =>
  import('../../../canvas/CanvasView').then((m) => ({ default: m.CanvasView })),
)
const CommandPalette = lazy(() =>
  import('../../../command/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
import { toNodePageConfig } from '../../../canvas/canvasPageAdapter'
import { Inspector, ChromeInspectorPanel, ChromePalette } from '../../../inspector'
import { setAtPath } from '../../../inspector/showWhen'
import { PageWorkflowBar } from '../../page-workflow'
import { FiltersDrawer } from '../../filters'
import { PageInspectorPanel } from '../../page-config'
import { PerspectivesPane } from '../../perspectives'
import { VisibilitySection } from '../../visibility'
import type { VisibilityExpr } from '@statdash/engine'
import '../../../canvas/page-step.css'

// Generate a short, collision-resistant node id (matches existing convention).
const newNodeId = () => `node-${Math.random().toString(36).slice(2, 9)}`

export function PageStep() {
  const page          = useActivePage()
  const selectedId    = useSelectedNode()
  const chromeSel     = useChromeSelection()
  const selectNode    = useConstructorStore((s) => s.selectNode)
  const insertNode   = useConstructorStore((s) => s.insertNode)
  const updateNode   = useConstructorStore((s) => s.updateNode)
  const removeNode   = useConstructorStore((s) => s.removeNode)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)
  const goToStep     = useConstructorStore((s) => s.goToStep)

  const [dragging, setDragging] = useState(false)
  // Perspective PREVIEW — the author's local switcher selection (transient canvas
  // view-state, like `dragging`; not a persisted store slice). Lifted here so the
  // PerspectivesPane (the switcher SSOT) and the live CanvasView share it: the canvas
  // renders `perspective = f(previewPerspectiveId)`. undefined ⇒ the engine folds to
  // perspectives[0] (the SSOT default).
  const [previewPerspectiveId, setPreviewPerspectiveId] = useState<string | undefined>(undefined)
  const cmdk = useCommandPalette()
  const locale = useActiveLocales()[0] ?? 'ka'

  const pageId   = page?.id ?? null
  const selected = page && selectedId ? page.nodes[selectedId] ?? null : null

  // ── Metric bind (AR-49 M0 item 9) — one write, both gestures ──────────────
  //  Both the Metric Palette click/keyboard path and the canvas drag-drop funnel
  //  through here. The target measure field is DISCOVERED from the block's own
  //  PropSchema (metricBinding.firstMetricField), never hardcoded per type; the
  //  write is the SAME setAtPath + updateNode the Inspector uses, so the config is
  //  byte-identical to hand-authoring the metric-id (spec §3).
  const bindMetric = useCallback(
    (nodeId: string, metricId: string) => {
      if (!pageId || !page) return
      const node = page.nodes[nodeId]
      if (!node) return
      const field = firstMetricField(nodeSchemaSource.getSchema(node))
      if (!field) return // block declares no metric-ref field → not a bind target (no-op)
      updateNode(pageId, nodeId, { props: bindMetricToProps(node.props, field.field, metricId) })
      markPageDirty(pageId)
      selectNode(nodeId) // reflect the bound block so the Inspector shows the picked metric
    },
    [pageId, page, updateNode, markPageDirty, selectNode],
  )

  // Whether the CURRENTLY selected block can receive a click-bind (drives the
  // palette affordance + the announced hint). Drag onto any bindable block works
  // regardless of selection.
  const selectedBindable = selected ? isMetricBindable(nodeSchemaSource.getSchema(selected)) : false

  // Live engine config — projected from the store model (single source of truth).
  const nodeConfig = page ? toNodePageConfig(page) : null

  // ── Drop handler: palette type → slot of a parent node ──────────────────
  //
  //  The overlay reports the parent node id (the engine node that owns the
  //  slot) + the slot key. The page-root id === the CanvasPage id → a top-level
  //  insert; any other parentId nests under that node. Both go through the SAME
  //  insertNode store path that Cmd-K / slash / Outline use, building the node
  //  with the SAME makeNode helper — so an insert is byte-identical regardless
  //  of the surface that triggered it (the V6 invariant).
  //
  const handleDrop = useCallback(
    (parentId: string, _slotKey: string, nodeType: string) => {
      if (!pageId || !page) return
      const node = makeNode(nodeType, newNodeId())
      insertNode(pageId, node, parentId)
      markPageDirty(pageId)   // local edit → reflect in the lifecycle badge
      selectNode(node.id)
    },
    [pageId, page, insertNode, markPageDirty, selectNode],
  )

  // Write one prop on the selected node (the Inspector's onChange). `field` is
  // the schema field's dot-path (the exact path the Inspector READS via
  // getAtPath); setAtPath is its immutable dual, so a nested field is written to
  // the same location it is displayed from. Untouched branches keep their
  // reference (structural sharing) — Zustand change-detection and the
  // command-pattern undo/redo see only the touched path change. A single-segment
  // (top-level) field reduces to the prior shallow-merge, exactly preserved.
  const patchProp = useCallback(
    (field: string, value: unknown) => {
      if (!pageId || !selected) return
      updateNode(pageId, selected.id, { props: setAtPath(selected.props, field, value) })
      markPageDirty(pageId)
    },
    [pageId, selected, updateNode, markPageDirty],
  )

  // ── view.visibleWhen — the node-level "show when" gate (V4) ──────────────
  //  A null `next` CLEARS the gate (always visible): we rebuild `view` WITHOUT
  //  the key so an un-edited / cleared node never carries a `visibleWhen: undefined`
  //  (additive + byte-clean — the round-trip stays lossless). A non-null `next`
  //  writes through the SAME setAtPath path as every other node prop, so the edit
  //  composes with undo/redo and the WYSIWYG re-render.
  const setVisibleWhen = useCallback(
    (next: VisibilityExpr | undefined) => {
      if (!pageId || !selected) return
      if (next == null) {
        const view = { ...(selected.props.view as Record<string, unknown> | undefined) }
        delete view.visibleWhen
        const nextProps = { ...selected.props, view }
        // Drop an emptied `view` entirely so a node that never had one stays clean.
        if (Object.keys(view).length === 0) delete (nextProps as Record<string, unknown>).view
        updateNode(pageId, selected.id, { props: nextProps })
      } else {
        updateNode(pageId, selected.id, { props: setAtPath(selected.props, 'view.visibleWhen', next) })
      }
      markPageDirty(pageId)
    },
    [pageId, selected, updateNode, markPageDirty],
  )

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <DashboardIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>გვერდის კონსტრუქტორი</Typography>
          <Typography variant="body2" color="text.secondary">
            {page ? `რედაქტირება: ${page.title.ka}` : 'გვერდი არ არის არჩეული'}
          </Typography>
        </Box>
      </Box>

      {/* ── Draft → publish workflow (list/open/save/publish/history) ──────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}><PageWorkflowBar /></Box>
        {/* Cmd-K entry point — the button is the discoverable equivalent of the
            ⌘K shortcut (the palette is keyboard-first; this surfaces it). */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<SearchIcon />}
          onClick={() => cmdk.setOpen(true)}
          sx={{ flex: '0 0 auto' }}
        >
          ⌘K
        </Button>
      </Box>

      {/* Cmd-K / slash command palette — registry-driven insert + navigate.
          Mounted only once opened so the cmdk chunk loads on first invocation,
          not on PageStep paint. The palette renders its own portal/overlay, so
          a fill fallback would be invisible — the inline (non-fill) variant
          announces the load via aria-live without reserving canvas space. */}
      {cmdk.open && (
        <Suspense fallback={<SuspenseFallback label="Loading command palette" fill={false} />}>
          <CommandPalette open={cmdk.open} onOpenChange={cmdk.setOpen} />
        </Suspense>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: '200px 200px 1fr 280px', gap: 2, flex: 1, minHeight: 400 }}>
        {/* ── Palette (engine registry) ─────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 1.5, overflow: 'auto' }}>
          <Typography variant="overline" color="text.secondary">პალიტრა</Typography>
          <NodePalette onDragStateChange={setDragging} />
          <Divider sx={{ my: 1.5 }} />
          {/* Governed metric catalog (AR-49 M0) — browse + bind, beside the wizard. */}
          <MetricPalette
            locale={locale}
            canBind={selectedBindable}
            bindHint={selected ? 'არჩეული ბლოკი მეტრიკას არ იღებს' : 'აირჩიეთ მონაცემთა ბლოკი მეტრიკის მისაბმელად'}
            onBind={(metricId) => { if (selectedId) bindMetric(selectedId, metricId) }}
          />
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="overline" color="text.secondary">გარსი</Typography>
          <ChromePalette />
        </Paper>

        {/* ── Outline (Webflow Navigator) — structural tree over the store ─ */}
        <Paper variant="outlined" sx={{ p: 1, overflow: 'auto' }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 0.5 }}>სტრუქტურა</Typography>
          <OutlineTree />
        </Paper>

        {/* ── Live WYSIWYG canvas ───────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ overflow: 'hidden', minHeight: 360 }}>
          {nodeConfig
            ? (
              <Suspense fallback={<SuspenseFallback label="Loading canvas" />}>
                <CanvasView
                  page={nodeConfig}
                  selectedNodeId={selectedId ?? undefined}
                  dragging={dragging}
                  previewPerspectiveId={previewPerspectiveId}
                  onSelectNode={selectNode}
                  onDropNode={handleDrop}
                  onBindMetric={bindMetric}
                />
              </Suspense>
            )
            : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
                <Typography variant="body2">გვერდი არ არის არჩეული</Typography>
              </Box>
            )}
        </Paper>

        {/* ── Inspector + page-level Filters (FilterSchema authoring, V0) ─── */}
        <Paper variant="outlined" sx={{ p: 2, overflow: 'auto' }}>
          <Typography variant="overline" color="text.secondary">ინსპექტორი</Typography>
          {/* Chrome element selected → the SAME generic Inspector, chrome source. */}
          {chromeSel && <ChromeInspectorPanel />}
          {!chromeSel && !selected && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                       justifyContent: 'center', height: 200, color: 'text.disabled', gap: 1 }}>
              <ViewModuleIcon sx={{ fontSize: 40 }} />
              <Typography variant="body2">აირჩიეთ ელემენტი</Typography>
            </Box>
          )}
          {!chromeSel && selected && pageId && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Chip size="small" label={selected.type} color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
              {/* Schema-driven property panel (C1) — generic, no per-type UI. */}
              <Inspector node={selected} onChange={patchProp} />
              <Divider />
              {/* ── Node-level "show when" gate (V4) — any node can carry one ──── */}
              <VisibilitySection
                value={(selected.props.view as { visibleWhen?: VisibilityExpr } | undefined)?.visibleWhen}
                onChange={setVisibleWhen}
              />
              <Divider />
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => { removeNode(pageId, selected.id); markPageDirty(pageId); selectNode(null) }}
              >
                წაშლა
              </Button>
            </Box>
          )}

          {/* ── Page Inspector (PageConfigBase authoring, V3) ────────────── */}
          {/*  Page-scoped, not element-scoped: authors the page ROOT's         */}
          {/*  presentation / frame / perspectives / vars through the SAME generic */}
          {/*  Inspector (pageSchemaSource — presentation via presentationProp-  */}
          {/*  Schema). Round-trips losslessly through page.meta.               */}
          <Divider sx={{ my: 2 }} />
          <PageInspectorPanel />

          {/* ── Perspectives pane (PerspectiveAxis authoring, P-final) ───── */}
          {/*  Page-scoped: authors the page's perspective axes (named, ordered  */}
          {/*  query-views — Power BI bookmark-pane IA) through the SAME generic  */}
          {/*  Inspector + VisibilityBuilder. Replaces the raw `perspectives`     */}
          {/*  JSON field; round-trips losslessly through page.meta.perspectives. */}
          <Divider sx={{ my: 2 }} />
          <PerspectivesPane onPreviewChange={setPreviewPerspectiveId} />

          {/* ── Page-level filters (FilterSchema authoring, V0) ──────────── */}
          {/*  Page-scoped, not element-scoped: shown regardless of node       */}
          {/*  selection. Authors the page's filter bars + ParamDefs through    */}
          {/*  the SAME generic Inspector (ParamDefEditor + cube-profile bind). */}
          <Divider sx={{ my: 2 }} />
          <FiltersDrawer />
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="outlined" onClick={() => goToStep(1)}>← საიტი</Button>
      </Box>
    </Box>
  )
}
