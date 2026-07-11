import { Box, Typography } from '@mui/material'
import { NodePalette } from '../../canvas/NodePalette'
import { INSERT_SECTION_LABELS } from '../../canvas/paletteGroupLabels'
import type { CanvasController } from '../useCanvasController'
import type { Locale } from '../../types/constructor'

// ── Insert surface — the page-content block palette (relocated, not rebuilt) ───
//
//  Maps the wizard PageStep's palette column into the Studio left dock: the engine
//  NodePalette (registry-driven icon tiles). Drag state is lifted to the shared
//  controller so the always-mounted canvas reveals drop zones while a palette item
//  is dragged (spec §3 PageStep→Insert relocation). The section overline is localized
//  (INSERT_SECTION_LABELS) — no bare English structural label in a KA UI.
//
//  Chrome (header / sidebar / footer) is NOT here — it is SITE furniture authored in
//  the Pages&Site surface (its natural home), not inserted as page content. Insert is
//  strictly the page-content block palette (correct IA).
export function InsertSurface({ controller, locale }: { controller: CanvasController; locale: Locale }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.secondary">{INSERT_SECTION_LABELS.blocks[locale]}</Typography>
      <NodePalette
        locale={locale}
        selectedType={controller.selected?.type ?? null}
        onDragStateChange={controller.setDragging}
      />
    </Box>
  )
}
