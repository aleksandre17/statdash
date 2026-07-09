import { Box, Typography, Divider } from '@mui/material'
import { NodePalette } from '../../canvas/NodePalette'
import { ChromePalette } from '../../inspector'
import type { CanvasController } from '../useCanvasController'

// ── Insert surface — the block + chrome palette (relocated, not rebuilt) ───────
//
//  Maps the wizard PageStep's palette column into the Studio left dock: the engine
//  NodePalette (registry-driven, draggable) + the ChromePalette. Drag state is
//  lifted to the shared controller so the always-mounted canvas reveals drop zones
//  while a palette item is dragged (spec §3 PageStep→Insert relocation).
export function InsertSurface({ controller }: { controller: CanvasController }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.secondary">ბლოკები</Typography>
      <NodePalette onDragStateChange={controller.setDragging} />
      <Divider sx={{ my: 1 }} />
      <Typography variant="overline" color="text.secondary">გარსი</Typography>
      <ChromePalette />
    </Box>
  )
}
