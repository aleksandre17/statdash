// ── PageInspectorPanel — author the PAGE ROOT's config [V3] ───────────────────
//
//  The page root carries PageConfigBase config (presentation · frame · perspectives ·
//  vars) that was, until now, entirely UN-AUTHORABLE in the Constructor (a real
//  coverage gap the study flagged: page-level config un-authorable). This panel
//  closes it — WITHOUT a parallel form engine:
//
//    • the page's config is modelled as a CanvasNode (`{ type:'inner-page',
//      props: page.meta }`) and rendered through the EXISTING generic <Inspector>;
//    • the schema comes from `pageSchemaSource` — `presentation` is the union of
//      every registered presentation projector's schema() (presentationPropSchema),
//      re-prefixed to `presentation.*`, so a new projector is authorable for free;
//    • edits write through `setAtPath` into `page.meta`, which the page round-trip
//      ALREADY carries losslessly (canvasPageAdapter structural pass-through, P-3) —
//      validateConfig unaffected, existing configs byte-identical.
//
//  Page-SCOPED (like FiltersDrawer): shown regardless of node selection — the page
//  root is always the implicit "selected" element of this surface.
//
import { Box, Typography, Stack } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import { useConstructorStore, useEffectiveActivePage } from '../../store/constructor.store'
import { Inspector } from '../../inspector'
import { setAtPath } from '../../inspector/showWhen'
import { pageSchemaSource } from './pageSchemaSource'
import type { CanvasNode, PageMeta } from '../../types/constructor'

export function PageInspectorPanel() {
  const page          = useEffectiveActivePage()
  const updatePage    = useConstructorStore((s) => s.updatePage)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)

  // Page-scoped: the host (RightDock) only mounts this when a page is active AND owns
  // the single "no page" empty-state — so here we simply self-suppress (no duplicate
  // empty-state literal; FF-ONE-EMPTYSTATE).
  if (!page) return null

  const pageId = page.id
  const meta   = (page.meta ?? {}) as Record<string, unknown>

  // Model the page's config as a CanvasNode so the SAME generic Inspector renders
  // it. `type` is the (fixed) page-root kind; `props` is the page meta. childIds
  // are irrelevant here (the Inspector reads only props + schema).
  const pageNode: CanvasNode = {
    id:       pageId,
    type:     'inner-page',
    props:    meta,
    childIds: [],
  }

  // Write one page-config field (dot-path) through setAtPath into page.meta — the
  // exact dual of the Inspector's getAtPath read, so a nested field
  // (`presentation.color`) writes where it is displayed from. The round-trip
  // already carries `meta` losslessly; we drop an emptied meta back to undefined
  // so a page that ends up with no config stays meta-less (no spurious object).
  const patch = (field: string, value: unknown) => {
    const nextMeta = setAtPath(meta, field, value) as PageMeta
    const isEmpty  = Object.keys(nextMeta as Record<string, unknown>).length === 0
    updatePage(pageId, { meta: isEmpty ? undefined : nextMeta })
    markPageDirty(pageId)
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="page-inspector">
      <Stack direction="row" spacing={1} alignItems="center">
        <TuneIcon fontSize="small" />
        <Typography variant="overline" color="text.secondary">გვერდის პარამეტრები</Typography>
      </Stack>
      <Inspector node={pageNode} onChange={patch} schemaSource={pageSchemaSource} />
    </Box>
  )
}
