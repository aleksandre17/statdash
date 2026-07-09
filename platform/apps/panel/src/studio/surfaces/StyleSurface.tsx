import { Box, Typography, Alert } from '@mui/material'
import { useConstructorStore, useSite } from '../../store/constructor.store'
import { TokenCatalogViewer } from '../TokenCatalogViewer'
import { STRATA_PRESET, BRAND_TOKEN_GROUPS } from '../strata-preset'
import type { Locale } from '../../types/constructor'

// ── Style surface — the WRITABLE brand-token editor (AR-49 M1.4) ──────────────
//
//  The read-only catalog chip viewer became a real editor: it writes
//  `SiteDef.themeOverrides` (a `tokenKey → CSS value` map) through the EXISTING
//  store action `updateSite` — byte-identical to hand-authoring the override map,
//  no new save path (persisted via the same api-actions site write). Because
//  StudioShell applies `themeOverrides` (over the Strata base) as inline custom
//  properties on the shell root, every edit repaints the chrome AND the live
//  canvas on the next render — the platform's own "rebrand = data" proof (Law 2:
//  a theme edit produces only DATA, never a code path).
//
//  Driven entirely by the self-describing TOKENS_CATALOG via TokenCatalogViewer
//  (the reusable grouping component): bilingual labels, per-type controls, and
//  reset-to-default per token. Scoped to the brand groups (colour / typography /
//  radius) — the exhaustive per-token editor is the Refine lens (M3).
export function StyleSurface({ locale }: { locale: Locale }) {
  const site       = useSite()
  const updateSite = useConstructorStore((s) => s.updateSite)
  const overrides  = site.themeOverrides

  const setToken = (key: string, value: string) =>
    updateSite({ themeOverrides: { ...overrides, [key]: value } })

  const resetToken = (key: string) => {
    if (!(key in overrides)) return
    const next = { ...overrides }
    delete next[key]
    updateSite({ themeOverrides: next })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="overline" color="text.secondary">
        {locale === 'en' ? 'Brand tokens' : 'ბრენდის ტოკენები'}
      </Typography>
      <Alert severity="info" variant="outlined">
        {locale === 'en'
          ? 'Edit a token to re-skin the tool and canvas live. Blank = the Strata default; reset restores it.'
          : 'შეცვალე ტოკენი — ხელსაწყო და ტილო ცოცხლად გადაფერდება. ცარიელი = Strata-ს ნაგულისხმევი; დაბრუნება აღადგენს.'}
      </Alert>
      <TokenCatalogViewer
        locale={locale}
        value={overrides}
        defaults={STRATA_PRESET}
        groups={BRAND_TOKEN_GROUPS}
        onChange={setToken}
        onReset={resetToken}
      />
    </Box>
  )
}
