import { Box, Typography, TextField, ToggleButton, ToggleButtonGroup, Paper, IconButton, Chip, Button, Alert } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { useConstructorStore, useSite } from '../../store/constructor.store'
import { useToast } from '../../store/notify'
import type { Locale } from '../../types/constructor'

// ── Pages & Site surface — identity + navigation (thin relocation) ─────────────
//
//  Relocates SiteStep's Identity + Navigation controls into the Studio left dock,
//  reusing the SAME store actions (updateSite / removeNavItem). It is DELIBERATELY
//  a thin scaffold: enough to prove the surface mounts and writes the real site
//  slice, without forking SiteStep (frozen until M1.3).
//
//  M1.2 SCAFFOLD NOTES (flagged for M1.3):
//   • dnd-kit nav REORDER relocates in M1.3 (SiteStep still owns the DndContext).
//   • "+ add page" is the wizard's `notify('coming soon')` stub today; M1.3 wires
//     it to the real createFromTemplate/PageBrowser path (spec §3 behavior FLAG).
//   • the writable theme editor is the Style surface's M1.4 work.
export function PagesSiteSurface() {
  const site          = useSite()
  const updateSite    = useConstructorStore((s) => s.updateSite)
  const removeNavItem = useConstructorStore((s) => s.removeNavItem)
  const notify        = useToast()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

      <Box>
        <Typography variant="overline" color="text.secondary">ნავიგაცია</Typography>
        <Box sx={{ mt: 1 }}>
          {site.nav.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, mb: 0.75 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{item.label.ka}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{item.label.en}</Typography>
              </Box>
              <Chip size="small" variant="outlined" label={item.pageId} />
              <IconButton size="small" aria-label={`Delete ${item.label.en}`} onClick={() => removeNavItem(item.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
          {site.nav.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
              ნავიგაციის ელემენტები ჯერ არ არის.
            </Typography>
          )}
          <Button
            sx={{ mt: 1 }} size="small" variant="outlined"
            onClick={() => notify('გვერდის დამატება — M1.3', { type: 'info' })}
          >
            + გვერდის დამატება
          </Button>
        </Box>
      </Box>

      <Alert severity="info" variant="outlined">
        ნავიგაციის გადალაგება და გვერდის რეალური შექმნა გადმოვა M1.3-ში.
      </Alert>
    </Box>
  )
}
