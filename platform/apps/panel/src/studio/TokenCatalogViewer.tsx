import { useMemo } from 'react'
import { Box, TextField, Typography, IconButton, InputAdornment } from '@mui/material'
import ReplayIcon from '@mui/icons-material/Replay'
import { TOKENS_CATALOG, type TokenDescriptor } from '@statdash/styles'
import type { Locale } from '../types/constructor'

// ── TokenCatalogViewer — the ONE self-describing token grouping/editor ────────
//
//  Drives the whole Style surface from the self-describing TOKENS_CATALOG: it is
//  the single place that GROUPS the catalog and renders a control per token. This
//  consolidates the grouping that StyleSurface (and, before the wizard died,
//  SiteStep's Theme tab) hand-rolled twice — one reusable component now (DRY, the
//  M1.3a observation (a) fix).
//
//  Law 8 (open for extension): the control is chosen from the token's declared
//  `group`, so a NEW token appears with the right editor automatically — no code
//  change. Law 9 (a11y): every field is a labelled input (the bilingual catalog
//  label), the description is its helper text, and the reset control has an
//  accessible name.
//
//  It is a controlled component: `value` is the override map (SiteDef.themeOverrides),
//  `defaults` the base preset (Strata) shown as the fall-back placeholder, and
//  `onChange`/`onReset` write through the caller (→ the store). It holds NO state
//  and knows nothing about persistence — pure, testable, reusable.

export interface TokenCatalogViewerProps {
  locale:    Locale
  /** Current override map — the SSOT being edited (SiteDef.themeOverrides). */
  value:     Record<string, string>
  /** Base preset beneath the overrides (Strata) — shown as the placeholder. */
  defaults?: Record<string, string>
  /** Only render these token groups (brand editor scope). Omit = all groups. */
  groups?:   readonly string[]
  onChange:  (tokenKey: string, value: string) => void
  onReset:   (tokenKey: string) => void
}

// Bilingual group headings for the brand-editor groups (technical taxonomy slugs
// otherwise). Unknown groups fall back to the slug — no crash on catalog growth.
const GROUP_LABELS: Record<string, { ka: string; en: string }> = {
  color:         { ka: 'ფერები',        en: 'Colours' },
  'font-family': { ka: 'შრიფტები',       en: 'Font families' },
  'font-size':   { ka: 'შრიფტის ზომა',   en: 'Font sizes' },
  'font-weight': { ka: 'შრიფტის სისქე',  en: 'Font weights' },
  radii:         { ka: 'მომრგვალება',    en: 'Radii' },
}

/** A concrete #rrggbb value for the native swatch, or a neutral affordance colour
 *  when the effective value is a var()/rgb()/non-hex. Neutral grey is a picker
 *  affordance default — NOT brand chrome (so it is not an FF-CHROME-TOKEN-DRIVEN
 *  concern; the guard scans the shell frame, not this editor control). */
function swatchHex(effective: string | undefined): string {
  return effective && /^#[0-9a-fA-F]{6}$/.test(effective) ? effective : '#8896a5'
}

function TokenField({
  tokenKey, descriptor, locale, override, fallback, onChange, onReset,
}: {
  tokenKey:   string
  descriptor: TokenDescriptor
  locale:     Locale
  override:   string | undefined
  fallback:   string
  onChange:   (tokenKey: string, value: string) => void
  onReset:    (tokenKey: string) => void
}) {
  const label      = descriptor.label[locale]
  const isColor    = descriptor.group === 'color'
  const hasOverride = override !== undefined && override !== ''
  const effective  = hasOverride ? override : fallback
  const resetLabel = locale === 'en' ? `Reset ${label}` : `${label} — ნაგულისხმევზე დაბრუნება`

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      {isColor && (
        <Box
          component="input"
          type="color"
          aria-label={locale === 'en' ? `${label} colour` : `${label} — ფერი`}
          value={swatchHex(effective)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(tokenKey, e.target.value)}
          sx={{
            mt: 0.5, width: 34, height: 34, p: 0, flexShrink: 0,
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
            background: 'none', cursor: 'pointer',
          }}
        />
      )}
      <TextField
        size="small"
        fullWidth
        label={label}
        value={override ?? ''}
        placeholder={fallback}
        onChange={(e) => onChange(tokenKey, e.target.value)}
        helperText={descriptor.description[locale]}
        InputProps={{
          sx: { fontFamily: 'var(--font-family-mono)', fontSize: 12 },
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label={resetLabel}
                title={resetLabel}
                disabled={!hasOverride}
                onClick={() => onReset(tokenKey)}
                edge="end"
              >
                <ReplayIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  )
}

export function TokenCatalogViewer({
  locale, value, defaults, groups, onChange, onReset,
}: TokenCatalogViewerProps) {
  // THE grouping (was hand-rolled twice): filter to the requested groups, then
  // bucket by the token's self-declared `group`. Memoised on the group filter.
  const grouped = useMemo(() => {
    const allow = groups ? new Set(groups) : null
    const acc: Record<string, string[]> = {}
    for (const [key, desc] of Object.entries(TOKENS_CATALOG)) {
      if (allow && !allow.has(desc.group)) continue
      ;(acc[desc.group] ??= []).push(key)
    }
    return acc
  }, [groups])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(grouped).map(([group, keys]) => (
        <Box key={group} component="section" aria-label={(GROUP_LABELS[group] ?? { en: group })[locale] ?? group}>
          <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            {GROUP_LABELS[group]?.[locale] ?? group}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {keys.map((key) => {
              const descriptor = TOKENS_CATALOG[key]
              const fallback = defaults?.[key]
                ?? (descriptor.value !== undefined ? String(descriptor.value) : (descriptor.cssVar ?? ''))
              return (
                <TokenField
                  key={key}
                  tokenKey={key}
                  descriptor={descriptor}
                  locale={locale}
                  override={value[key]}
                  fallback={fallback}
                  onChange={onChange}
                  onReset={onReset}
                />
              )
            })}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
