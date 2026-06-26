// ── DsdVersionPanel — DSD-change governance: plain-language diff + version-mint ──
//
//  When a canonical upload returns 400 DSD_INCOMPATIBLE (a richer/different DSD than
//  the registered dataset), the canonical SDMX resolution is to ingest the structural
//  change as a NEW VERSION — not to silently overwrite, and not a dead-end error. This
//  is that governance surface, split out of ExcelUpload (one concern per file): it
//  (1) renders the structural diff in PLAIN LANGUAGE (added / removed dimensions),
//  (2) explains the change is governed by a new version (not silent), and (3) offers
//  the version-label + confirm that re-POSTs the cached bytes with `?datasetVersion=`.
//  YAGNI — a diff + a label + a confirm, NOT a multi-step version manager.
//
//  A11y (WCAG 2.1 AA — Law 9): the panel is a labelled region (role=group +
//  aria-labelledby/describedby); the version label is a real labelled TextField,
//  keyboard-operable and FOCUSED on open so the curator lands on the action (2.4.3 /
//  3.2.1); Enter in the input confirms (2.1.1 keyboard equivalent of the button); the
//  diff is conveyed by text (the chips' +/− glyph + the label), never color alone. The
//  parent's aria-live region announces the diff + the outcome — see dsdChangeSummary.
//
import { useId, useRef, useEffect } from 'react'
import { Box, Typography, Button, Chip, Stack, Divider, TextField } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import type { DsdChange } from './ingestErrorMessage'

/** Join a dimension list as a readable, comma-separated string (for prose + a11y). */
function joinDims(dims: string[]): string {
  return dims.join(', ')
}

/**
 * A one-line, plain-language summary of the structural change — the text the parent's
 * aria-live region announces. Leads with what the workbook ADDS (the common case: a
 * richer DSD), then any REMOVED dimensions. Exported so the parent reuses the exact
 * wording for the screen-reader announcement (SSOT — one phrasing of the diff).
 */
export function dsdChangeSummary(change: DsdChange): string {
  const parts: string[] = []
  if (change.added.length > 0) {
    parts.push(`ემატება განზომილება(ებ)ი: ${joinDims(change.added)}`)
  }
  if (change.removed.length > 0) {
    parts.push(`იშლება განზომილება(ებ)ი: ${joinDims(change.removed)}`)
  }
  if (parts.length === 0) {
    // No add/remove delta surfaced (e.g. a reorder/measure change) — name it generically.
    parts.push('სტრუქტურა განსხვავდება რეგისტრირებული ნაკრებისგან')
  }
  return `${change.datasetCode}: ${parts.join('; ')} — საჭიროა ახალი ვერსია.`
}

export interface DsdVersionPanelProps {
  change:               DsdChange
  versionLabel:         string
  onVersionLabelChange: (v: string) => void
  /** Re-POST the cached bytes with `?datasetVersion=<versionLabel>` (the version mint). */
  onConfirm:            () => void
  /** True while the version-labelled re-POST is in flight (disables the confirm). */
  busy:                 boolean
}

export function DsdVersionPanel({
  change, versionLabel, onVersionLabelChange, onConfirm, busy,
}: DsdVersionPanelProps) {
  const headingId = useId()
  const descId    = useId()
  const inputRef  = useRef<HTMLInputElement>(null)

  // Focus the version label when the panel opens — the curator lands on the action,
  // not stranded at the top of the page (WCAG 2.4.3 focus order / 3.2 predictability).
  useEffect(() => { inputRef.current?.focus() }, [])

  const labelValid = versionLabel.trim() !== ''

  return (
    <Box
      role="group"
      aria-labelledby={headingId}
      aria-describedby={descId}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 1.5, p: 2,
        border: '1px solid', borderColor: 'warning.main', borderRadius: 1,
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountTreeIcon color="warning" aria-hidden />
        <Typography id={headingId} variant="subtitle1" fontWeight={600}>
          სტრუქტურული ცვლილება — საჭიროა ახალი ვერსია
        </Typography>
      </Box>

      <Typography id={descId} variant="body2" color="text.secondary">
        ეს სამუშაო წიგნი ცვლის{' '}
        <Box component="code" sx={{ fontFamily: 'monospace' }}>{change.datasetCode}</Box>{' '}
        ნაკრების სტრუქტურას. SDMX მართვის წესით სტრუქტურული ცვლილება ცალკე ვერსიად ინახება —
        არ ანაცვლებს არსებულს ჩუმად. დაადასტურეთ ახალ ვერსიად ჩასატვირთად.
      </Typography>

      {/* The plain-language structural diff (added / removed dimensions). */}
      <Stack spacing={0.5}>
        {change.added.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">ემატება:</Typography>
            {change.added.map((d) => (
              <Chip key={d} size="small" color="success" variant="outlined" label={`+ ${d}`} />
            ))}
          </Box>
        )}
        {change.removed.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">იშლება:</Typography>
            {change.removed.map((d) => (
              <Chip key={d} size="small" color="error" variant="outlined" label={`− ${d}`} />
            ))}
          </Box>
        )}
        {change.added.length === 0 && change.removed.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            სტრუქტურა განსხვავდება რეგისტრირებული ნაკრებისგან.
          </Typography>
        )}
        {change.reason && (
          <Typography variant="caption" color="text.secondary">{change.reason}</Typography>
        )}
      </Stack>

      <Divider />

      {/* The version-mint action: a label (defaulted) + confirm. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          inputRef={inputRef}
          size="small"
          label="ვერსიის ნიშნული"
          value={versionLabel}
          onChange={(e) => onVersionLabelChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter confirms — the keyboard equivalent of the button (WCAG 2.1.1).
            if (e.key === 'Enter' && labelValid && !busy) { e.preventDefault(); onConfirm() }
          }}
          error={!labelValid}
          helperText={labelValid ? 'მაგ. თარიღი ან v2' : 'შეიყვანეთ ვერსიის ნიშნული'}
          disabled={busy}
          sx={{ minWidth: 200 }}
        />
        <Button
          variant="contained"
          color="warning"
          disabled={busy || !labelValid}
          startIcon={<AccountTreeIcon />}
          onClick={onConfirm}
          sx={{ mt: 0.5 }}
        >
          ახალ ვერსიად ჩატვირთვა
        </Button>
      </Box>
    </Box>
  )
}
