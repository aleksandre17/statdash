import { Box, Typography } from '@mui/material'
import { OutlineTree } from '../../outline'
import type { Locale } from '../../types/constructor'

// ── Layers surface — the structural outline (Webflow Navigator) ───────────────
//
//  Relocates PageStep's outline column into the Studio left dock. OutlineTree reads
//  the store directly (role=tree over the flat node map) — mounted verbatim. `locale`
//  is threaded so its empty-states render in the shell's active language.
export function LayersSurface({ locale }: { locale: Locale }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.secondary">სტრუქტურა</Typography>
      <OutlineTree locale={locale} />
    </Box>
  )
}
