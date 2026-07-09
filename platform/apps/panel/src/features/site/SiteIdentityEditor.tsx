import { Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useConstructorStore, useSite } from '../../store/constructor.store'
import type { Locale } from '../../types/constructor'

// ── SiteIdentityEditor — site name / default locale / logo (AR-49 M1.3) ────────
//
//  EXTRACTED from the wizard's SiteStep Identity tab so the SAME controls serve
//  both the wizard and the Studio Pages&Site surface (no fork — Law 6/7). Writes
//  the real site slice via the SAME action (updateSite) — byte-identical.
export function SiteIdentityEditor() {
  const site       = useSite()
  const updateSite = useConstructorStore((s) => s.updateSite)

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">იდენტობა</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <TextField
          size="small" label="საიტის სახელი" fullWidth
          value={site.name}
          onChange={(e) => updateSite({ name: e.target.value })}
        />
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            ნაგულისხმევი ენა
          </Typography>
          <ToggleButtonGroup
            exclusive size="small"
            value={site.defaultLocale}
            onChange={(_, v: Locale | null) => { if (v) updateSite({ defaultLocale: v }) }}
            aria-label="Default locale"
          >
            <ToggleButton value="ka" aria-label="Georgian">ka</ToggleButton>
            <ToggleButton value="en" aria-label="English">en</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <TextField
          size="small" label="ლოგოს URL" fullWidth placeholder="https://…"
          value={site.logo ?? ''}
          onChange={(e) => updateSite({ logo: e.target.value })}
        />
      </Box>
    </Box>
  )
}
