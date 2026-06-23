import { useState, useCallback } from 'react'
import { Box, Typography, Paper, Chip, Divider, Button } from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import DeleteIcon from '@mui/icons-material/Delete'
import { nodeRegistry } from '@statdash/react/engine'
import { useConstructorStore, useActivePage, useSelectedNode, useChromeSelection } from '../../../store/constructor.store'
import type { CanvasNode } from '../../../types/constructor'
import { CanvasView }    from '../../../canvas/CanvasView'
import { NodePalette }   from '../../../canvas/NodePalette'
import { toNodePageConfig } from '../../../canvas/canvasPageAdapter'
import { Inspector, ChromeInspectorPanel, ChromePalette } from '../../../inspector'
import { PageWorkflowBar } from '../../page-workflow'
import '../../../canvas/page-step.css'

// Generate a short, collision-resistant node id (matches existing convention).
const newNodeId = () => `node-${Math.random().toString(36).slice(2, 9)}`

export function PageStep() {
  const page          = useActivePage()
  const selectedId    = useSelectedNode()
  const chromeSel     = useChromeSelection()
  const selectNode    = useConstructorStore((s) => s.selectNode)
  const addNode      = useConstructorStore((s) => s.addNode)
  const updateNode   = useConstructorStore((s) => s.updateNode)
  const removeNode   = useConstructorStore((s) => s.removeNode)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)
  const goToStep     = useConstructorStore((s) => s.goToStep)

  const [dragging, setDragging] = useState(false)

  const pageId   = page?.id ?? null
  const selected = page && selectedId ? page.nodes[selectedId] ?? null : null

  // Live engine config — projected from the store model (single source of truth).
  const nodeConfig = page ? toNodePageConfig(page) : null

  // ── Drop handler: palette type → slot of a parent node ──────────────────
  //
  //  The overlay reports the parent node id (the engine node that owns the
  //  slot) + the slot key. The page-root id === the CanvasPage id → a drop on
  //  the page's content slot is a top-level addNode. A drop on any other node
  //  appends to that node's children (store children[] are id references).
  //
  const handleDrop = useCallback(
    (parentId: string, _slotKey: string, nodeType: string) => {
      if (!pageId || !page) return
      const id = newNodeId()
      // Seed props from the slice's registry defaults (open registry; no closed
      // enum). A newly-registered type is storable the moment it's draggable.
      const props = { ...(nodeRegistry.getDefaults(nodeType) ?? {}) }
      const node: CanvasNode = { id, type: nodeType, props, childIds: [] }

      if (parentId === pageId) {
        addNode(pageId, node)
      } else {
        const parent = page.nodes[parentId]
        if (!parent) return
        // Register the node in the flat map, then link it under the parent.
        addNode(pageId, node)
        updateNode(pageId, parentId, { childIds: [...parent.childIds, id] })
      }
      markPageDirty(pageId)   // local edit → reflect in the lifecycle badge
      selectNode(id)
    },
    [pageId, page, addNode, updateNode, markPageDirty, selectNode],
  )

  // Write one prop on the selected node (the Inspector's onChange). Supports
  // dot-path fields by shallow-merging at the top level (PropSchema fields are
  // top-level in the slices we ship; nested paths are a later enhancement).
  const patchProp = useCallback(
    (field: string, value: unknown) => {
      if (!pageId || !selected) return
      updateNode(pageId, selected.id, { props: { ...selected.props, [field]: value } })
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
      <PageWorkflowBar />

      <Box sx={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 2, flex: 1, minHeight: 400 }}>
        {/* ── Palette (engine registry) ─────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 1.5, overflow: 'auto' }}>
          <Typography variant="overline" color="text.secondary">პალიტრა</Typography>
          <NodePalette onDragStateChange={setDragging} />
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="overline" color="text.secondary">გარსი</Typography>
          <ChromePalette />
        </Paper>

        {/* ── Live WYSIWYG canvas ───────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ overflow: 'hidden', minHeight: 360 }}>
          {nodeConfig
            ? (
              <CanvasView
                page={nodeConfig}
                selectedNodeId={selectedId ?? undefined}
                dragging={dragging}
                onSelectNode={selectNode}
                onDropNode={handleDrop}
              />
            )
            : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
                <Typography variant="body2">გვერდი არ არის არჩეული</Typography>
              </Box>
            )}
        </Paper>

        {/* ── Inspector ─────────────────────────────────────────────────── */}
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
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="outlined" onClick={() => goToStep(1)}>← საიტი</Button>
      </Box>
    </Box>
  )
}
