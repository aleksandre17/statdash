import { Box, Typography, Divider } from '@mui/material'
import { NodePalette } from '../../canvas/NodePalette'
import { INSERT_SECTION_LABELS } from '../../canvas/paletteGroupLabels'
import { ChromePalette } from '../../inspector'
import type { CanvasController } from '../useCanvasController'
import type { Locale } from '../../types/constructor'

// ── Insert surface — the block + chrome palette (relocated, not rebuilt) ───────
//
//  Maps the wizard PageStep's palette column into the Studio left dock: the engine
//  NodePalette (registry-driven icon tiles) + the ChromePalette. Drag state is
//  lifted to the shared controller so the always-mounted canvas reveals drop zones
//  while a palette item is dragged (spec §3 PageStep→Insert relocation). The section
//  overlines are localized (INSERT_SECTION_LABELS) — no bare English structural
//  label in a KA UI (audit finding #7).
export function InsertSurface({ controller, locale }: { controller: CanvasController; locale: Locale }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.secondary">{INSERT_SECTION_LABELS.blocks[locale]}</Typography>
      <NodePalette
        locale={locale}
        selectedType={controller.selected?.type ?? null}
        onDragStateChange={controller.setDragging}
      />
      <Divider sx={{ my: 1 }} />
      <Typography variant="overline" color="text.secondary">{INSERT_SECTION_LABELS.chrome[locale]}</Typography>
      <ChromePalette />
    </Box>
  )
}
