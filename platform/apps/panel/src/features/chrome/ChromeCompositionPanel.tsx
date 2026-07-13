// ── ChromeCompositionPanel — the site-frame's WHOLE-element inspector (Gap 1 · D-CH1) ─
//
//  Post-S6 chrome is a `sourced` Part of the synthetic site-frame; selecting a rendered
//  region authors its variant/placement/config (the chrome facet). But the COMPOSITION —
//  the SET of regions, incl. ones currently switched OFF (so not clickable on canvas) —
//  had no home. This is it: the site-frame's whole-element surface, reachable via a chrome
//  region's "Back". It lists EVERY registered chrome slot with its current variant, so an
//  author can enable/disable (switch to the `hidden` variant), swap variant, or open a
//  region for deep per-region editing. Registry-driven (`chromeRegistry.list()`), never a
//  hardcoded slot list — a new chrome slot appears here by being REGISTERED (OCP).
//
//  Reuses the SAME store actions (`setChromeVariant`) + the controller's `selectChrome`
//  (no fork, Law 6/7); writes the ONE site SSOT (`site.chrome`).
//
import { Box, Typography, Select, MenuItem, Button, Stack } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import { chromeRegistry } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/react/engine'
import { useSite, useConstructorStore } from '../../store/constructor.store'
import type { CanvasController } from '../../studio/useCanvasController'
import type { Locale } from '../../types/constructor'

/** Resolve a LocaleString to the active locale (string passes through). */
function loc(value: LocaleString | undefined, locale: Locale): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : (value[locale] ?? value.en ?? Object.values(value)[0] ?? '')
}

export function ChromeCompositionPanel(
  { locale, controller }: { locale: Locale; controller: CanvasController },
) {
  const site = useSite()
  const setChromeVariant = useConstructorStore((s) => s.setChromeVariant)
  const en = locale === 'en'

  const slots = chromeRegistry.list()

  return (
    <Box data-testid="chrome-composition" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle2" fontWeight={600}>
        {en ? 'Site chrome' : 'საიტის ჩარჩო'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {en
          ? 'The set of chrome regions. Switch a region off (Hidden), swap its variant, or open it to author placement + content.'
          : 'ჩარჩოს რეგიონების ნაკრები. გამორთეთ (Hidden), შეცვალეთ ვარიანტი, ან გახსენით რეგიონი განლაგებისა და შიგთავსის ასაწყობად.'}
      </Typography>

      <Stack spacing={1}>
        {slots.map((slot) => {
          const variants = chromeRegistry.listVariants(slot)
          const current  = (site.chrome[slot]?.variant as string | undefined) ?? 'default'
          const slotLabel = loc(chromeRegistry.getMeta(slot, current)?.label, locale) || slot
          return (
            <Box
              key={slot}
              data-testid={`chrome-row-${slot}`}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
                    p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <Typography variant="body2" sx={{ flex: '1 1 auto', minWidth: 100, fontWeight: 500 }}>
                {slotLabel}
                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                  {slot}
                </Typography>
              </Typography>
              <Select
                size="small"
                value={variants.includes(current) ? current : (variants[0] ?? current)}
                onChange={(e) => setChromeVariant(slot, e.target.value)}
                inputProps={{ 'aria-label': `${slotLabel} ${en ? 'variant' : 'ვარიანტი'}` }}
                sx={{ minWidth: 130 }}
              >
                {variants.map((v) => (
                  <MenuItem key={v} value={v}>
                    {loc(chromeRegistry.getMeta(slot, v)?.label, locale) || v}
                  </MenuItem>
                ))}
              </Select>
              <Button
                size="small"
                startIcon={<TuneIcon fontSize="small" />}
                onClick={() => controller.selectChrome(slot)}
                sx={{ textTransform: 'none' }}
              >
                {en ? 'Open' : 'გახსნა'}
              </Button>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
