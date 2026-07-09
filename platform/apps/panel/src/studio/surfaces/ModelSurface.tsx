import { Box, Typography } from '@mui/material'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import type { Locale } from '../../types/constructor'

// ── ModelSurface — the Steward's Model-mode left dock (AR-49 M2.0 scaffold) ────
//
//  M2.0 unlocks the Model rail slot for the Steward lens; the surface it opens is
//  intentionally a PLACEHOLDER here. The "define" half — the relocated raw modeler
//  (M2.1) and in-tool metric authoring / the Metric Editor (M2.2) — lands in later
//  M2 sub-milestones, per SPEC-authoring-reconception-M2 §9. Kept minimal + additive
//  so M2.0 ships the ORGANIZING AXIS (the role lens) with zero regression; Model is
//  a left surface over the SAME always-mounted canvas, never a route.
export function ModelSurface({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, color: 'text.secondary' }}>
      <HubOutlinedIcon />
      <Typography variant="body2" fontWeight={700}>
        {en ? 'Model mode' : 'მოდელის რეჟიმი'}
      </Typography>
      <Typography variant="caption">
        {en
          ? 'Define the governed semantic layer here — metric authoring arrives in M2.1.'
          : 'აქ განისაზღვრება მართული სემანტიკური შრე — მეტრიკის ავტორინგი მალე, M2.1-ში.'}
      </Typography>
    </Box>
  )
}
