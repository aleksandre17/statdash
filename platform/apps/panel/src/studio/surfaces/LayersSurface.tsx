import { Box, Typography } from '@mui/material'
import { OutlineTree } from '../../outline'

// ── Layers surface — the structural outline (Webflow Navigator) ───────────────
//
//  Relocates PageStep's outline column into the Studio left dock. OutlineTree reads
//  the store directly (role=tree over the flat node map) — mounted verbatim.
export function LayersSurface() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.secondary">სტრუქტურა</Typography>
      <OutlineTree />
    </Box>
  )
}
