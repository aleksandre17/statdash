import { Box, Typography, Chip, Divider, Button } from '@mui/material'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import DeleteIcon from '@mui/icons-material/Delete'
import { Inspector, ChromeInspectorPanel } from '../inspector'
import { VisibilitySection } from '../features/visibility'
import { PageInspectorPanel } from '../features/page-config'
import { PerspectivesPane } from '../features/perspectives'
import { FiltersDrawer } from '../features/filters'
import type { VisibilityExpr } from '@statdash/engine'
import type { CanvasController } from './useCanvasController'

// ── RightDock — the selection-contextual Inspector (tldraw contract) ───────────
//
//  Relocates PageStep's Inspector column into the Studio right dock, mounting the
//  SAME generic Inspector + page-scoped panes and wiring them through the shared
//  canvas controller (byte-identical writes; nothing forked). Node-scoped panels
//  materialize on selection; page-scoped panes (page config / perspectives /
//  filters) are always shown (they author the page root, not a node).
export function RightDock({ controller }: { controller: CanvasController }) {
  const { selected, pageId, chromeSel, patchProp, setVisibleWhen, deleteSelected, setPreviewPerspectiveId } = controller

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Typography variant="overline" color="text.secondary">ინსპექტორი</Typography>

      {/* Chrome element selected → the SAME generic Inspector, chrome source. */}
      {chromeSel && <ChromeInspectorPanel />}

      {!chromeSel && !selected && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                   justifyContent: 'center', height: 160, color: 'text.disabled', gap: 1 }}>
          <ViewModuleIcon sx={{ fontSize: 40 }} />
          <Typography variant="body2">აირჩიეთ ელემენტი</Typography>
        </Box>
      )}

      {!chromeSel && selected && pageId && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Chip size="small" label={selected.type} color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
          <Inspector node={selected} onChange={patchProp} />
          <Divider />
          <VisibilitySection
            value={(selected.props.view as { visibleWhen?: VisibilityExpr } | undefined)?.visibleWhen}
            onChange={setVisibleWhen}
          />
          <Divider />
          <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={deleteSelected}>
            წაშლა
          </Button>
        </Box>
      )}

      {/* Page-scoped panes — author the page root regardless of node selection. */}
      <Divider sx={{ my: 1.5 }} />
      <PageInspectorPanel />
      <Divider sx={{ my: 1.5 }} />
      <PerspectivesPane onPreviewChange={setPreviewPerspectiveId} />
      <Divider sx={{ my: 1.5 }} />
      <FiltersDrawer />
    </Box>
  )
}
