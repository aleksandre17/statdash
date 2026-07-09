import { useState } from 'react'
import { Box, Tabs, Tab, Typography, Paper, Button, Chip } from '@mui/material'
import LanguageIcon from '@mui/icons-material/Language'
import PaletteIcon from '@mui/icons-material/Palette'
import NavigationIcon from '@mui/icons-material/Navigation'
import { useToast } from '../../../store/notify'
import { useConstructorStore } from '../../../store/constructor.store'
import { SiteIdentityEditor, NavEditor } from '../../site'
import { PLATFORM_CAPABILITIES } from '../../../platform-capabilities'

// ── SiteStep — the wizard's site step (AR-49) ─────────────────────────────────
//
//  The Identity + Navigation tabs now render the shared SiteIdentityEditor /
//  NavEditor (extracted so the Studio Pages&Site surface mounts the SAME controls
//  — no fork, Law 6/7). Behavior is byte-identical: the wizard's "+ add page" stays
//  its `notify('coming soon')` stub (injected via onAddPage), and the read-only
//  Theme viewer stays here (the Studio's Style surface owns its own; M1.4 makes it
//  writable). The step header + waterfall gate remain — deleted with the wizard.
export function SiteStep() {
  const goToStep     = useConstructorStore((s) => s.goToStep)
  const markStepDone = useConstructorStore((s) => s.markStepDone)
  const notify       = useToast()

  const [tab, setTab] = useState(0)

  // Group token keys by their catalog group for the Theme tab.
  const tokenGroups = Object.entries(PLATFORM_CAPABILITIES.tokens).reduce<
    Record<string, { key: string; preview: string }[]>
  >((acc, [key, desc]) => {
    const preview = desc.cssVar ?? (desc.value !== undefined ? String(desc.value) : '—')
    ;(acc[desc.group] ??= []).push({ key, preview })
    return acc
  }, {})

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <LanguageIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>საიტის შრე</Typography>
          <Typography variant="body2" color="text.secondary">
            განსაზღვრეთ საიტის იდენტობა, ნავიგაცია და თემა
          </Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v: number) => setTab(v)}>
        <Tab icon={<LanguageIcon />}   iconPosition="start" label="იდენტობა" />
        <Tab icon={<NavigationIcon />} iconPosition="start" label="ნავიგაცია" />
        <Tab icon={<PaletteIcon />}    iconPosition="start" label="თემა" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* ── Identity ──────────────────────────────────────────────────────── */}
        {tab === 0 && (
          <Box sx={{ maxWidth: 520, pt: 1 }}>
            <SiteIdentityEditor />
          </Box>
        )}

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        {tab === 1 && (
          <Box sx={{ maxWidth: 560, pt: 1 }}>
            <NavEditor onAddPage={() => notify('გვერდის დამატება — მალე', { type: 'info' })} />
          </Box>
        )}

        {/* ── Theme ─────────────────────────────────────────────────────────── */}
        {tab === 2 && (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              თემის რედაქტორი — მხოლოდ ნახვა (Phase 2.3). ტოკენები platform catalog-იდან.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2, mt: 1 }}>
              {Object.entries(tokenGroups).map(([group, tokens]) => (
                <Paper key={group} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>{group}</Typography>
                    <Chip size="small" label={tokens.length} />
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tokens.map(({ key, preview }) => (
                      <Chip
                        key={key}
                        size="small"
                        variant="outlined"
                        label={`${key.split('.').pop()}: ${preview}`}
                        sx={{ fontFamily: 'monospace', fontSize: 11 }}
                      />
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={() => goToStep(0)}>← მონაცემები</Button>
        <Button variant="contained" onClick={() => { markStepDone(1); goToStep(2) }}>
          გაგრძელება → გვერდები
        </Button>
      </Box>
    </Box>
  )
}
