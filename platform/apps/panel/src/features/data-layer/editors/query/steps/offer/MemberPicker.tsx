// ── MemberPicker — the Excel/Power-Query AutoFilter value list (P-OFFER · SPEC §3) ─
//
//  A column's VALUE is picked from its ACTUAL distinct members (governed-labeled), the
//  Excel AutoFilter gesture adopted whole (Law 4): a searchable checkbox list. The
//  checked set maps to the engine's `where` semantics UNCHANGED — one checked → the
//  scalar, many → the IN-array (`FilterValue = DimVal | DimVal[]`). The engine filter
//  grammar is equality/IN only (checked here against matchesFilter/FilterValue) — a
//  numeric comparator row (>, <, between) is a LEDGERED follow-up, not invented here.
//
//  WCAG (Law 9): a labeled group of labeled checkboxes + a labeled search box; keyboard-
//  operable (native checkboxes). Bilingual ka/en.
//
import { useMemo, useState } from 'react'
import {
  Box, Checkbox, FormControlLabel, TextField, Typography,
} from '@mui/material'
import type { DimVal } from '@statdash/engine'
import type { ValueOffer } from '../../../../pipeline-preview/stepInput'

export interface MemberPickerProps {
  offers:   readonly ValueOffer[]
  /** The currently-checked member codes (string-compared). */
  selected: readonly DimVal[]
  onChange: (next: DimVal[]) => void
  locale:   string
  /** SINGLE-select mode (a radio-like list): checking a member REPLACES the selection —
   *  the "exclude ONE member" gesture the engine `$ne` (a single DimVal) can represent
   *  (card 0087 «ყველა, გარდა…»). Default (`false`) = the multi-check AutoFilter list. */
  single?:  boolean
  /** Optional WCAG group label override (the "except" list reads "exclude a value"). */
  ariaLabel?: string
}

export function MemberPicker({ offers, selected, onChange, locale, single = false, ariaLabel }: MemberPickerProps) {
  const en = locale === 'en'
  const [search, setSearch] = useState('')

  const selectedKeys = useMemo(() => new Set(selected.map(String)), [selected])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q === '') return offers
    return offers.filter((o) =>
      String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q))
  }, [offers, search])

  if (offers.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {en ? 'No offered values yet' : 'შემოთავაზებული მნიშვნელობები არ არის'}
      </Typography>
    )
  }

  const toggle = (value: DimVal, checked: boolean) => {
    const key = String(value)
    if (single) {
      // Radio-like: a check REPLACES the selection; unchecking the sole member clears it.
      onChange(checked ? [value] : [])
      return
    }
    const next = checked
      ? [...selected.filter((v) => String(v) !== key), value]
      : selected.filter((v) => String(v) !== key)
    onChange(next)
  }

  return (
    <Box
      role="group"
      aria-label={ariaLabel ?? (en ? 'Filter values' : 'ფილტრის მნიშვნელობები')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180, flex: 1 }}
    >
      <TextField
        size="small"
        label={en ? 'Search' : 'ძებნა'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Box
        sx={{
          display: 'flex', flexDirection: 'column',
          maxHeight: 200, overflowY: 'auto',
          border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5,
        }}
      >
        {visible.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ py: 0.5 }}>
            {en ? 'No matches' : 'დამთხვევა არ არის'}
          </Typography>
        )}
        {visible.map((o) => {
          const checked = selectedKeys.has(String(o.value))
          return (
            <FormControlLabel
              key={String(o.value)}
              control={
                <Checkbox
                  size="small"
                  checked={checked}
                  onChange={(e) => toggle(o.value, e.target.checked)}
                />
              }
              label={<Typography variant="body2">{o.label}</Typography>}
              sx={{ m: 0 }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
