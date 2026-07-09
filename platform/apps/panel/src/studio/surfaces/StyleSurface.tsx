import { Box, Typography, Paper, Chip, Alert } from '@mui/material'
import { PLATFORM_CAPABILITIES } from '../../platform-capabilities'

// ── Style surface — token catalog viewer (read-only in M1.2) ──────────────────
//
//  Relocates SiteStep's Theme tab into the Studio left dock: the DTCG token
//  catalog grouped for browsing. It is READ-ONLY here by design.
//
//  M1.4 turns this into the WRITABLE brand-token editor (StyleField → SiteDef.
//  themeOverrides, live-previewed on the canvas — the platform's own rebrand-as-
//  data proof). The writable seam is deliberately deferred, not scaffolded here.
export function StyleSurface() {
  const tokenGroups = Object.entries(PLATFORM_CAPABILITIES.tokens).reduce<
    Record<string, { key: string; preview: string }[]>
  >((acc, [key, desc]) => {
    const preview = desc.cssVar ?? (desc.value !== undefined ? String(desc.value) : '—')
    ;(acc[desc.group] ??= []).push({ key, preview })
    return acc
  }, {})

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="overline" color="text.secondary">თემის ტოკენები</Typography>
      {Object.entries(tokenGroups).map(([group, tokens]) => (
        <Paper key={group} variant="outlined" sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>{group}</Typography>
            <Chip size="small" label={tokens.length} />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {tokens.map(({ key, preview }) => (
              <Chip
                key={key} size="small" variant="outlined"
                label={`${key.split('.').pop()}: ${preview}`}
                sx={{ fontFamily: 'monospace', fontSize: 11 }}
              />
            ))}
          </Box>
        </Paper>
      ))}
      <Alert severity="info" variant="outlined">
        რედაქტირებადი ბრენდ-რედაქტორი (themeOverrides, ცოცხალი გადახედვა) — M1.4.
      </Alert>
    </Box>
  )
}
