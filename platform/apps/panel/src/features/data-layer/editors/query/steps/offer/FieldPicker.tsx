// ── FieldPicker — the P-OFFER column/field control (offered, never typed) ─────────
//
//  The Authoring Canon's P-OFFER primitive (owner 2026-07-18): a field is PICKED from
//  the step's offered input columns (governed labels), not guessed as free text. One
//  reusable control for every step's field pick — Filter's column, Sort's field,
//  Lookup's key — so the offer gesture is authored ONCE (Law 8, platform-level).
//
//  • offers present → a labeled Select over the input columns (governed labels). A
//    current value that is NOT in the offered set is KEPT as an extra option (honest —
//    a stored column the current input no longer carries is never silently dropped).
//  • offers absent  → a free-text TextField (the honest fallback — never a dead
//    control when the input rows aren't available yet, SPEC §3 / Law 11).
//
import { MenuItem, TextField } from '@mui/material'
import type { ColumnOffer } from '../../../../pipeline-preview/stepInput'

export interface FieldPickerProps {
  /** The offered input columns, or `undefined` for the free-text fallback. */
  columns?: readonly ColumnOffer[]
  value:    string
  onChange: (field: string) => void
  label:    string
  /** Placeholder for the free-text fallback / the empty Select option. */
  placeholder?: string
  sx?: object
}

export function FieldPicker({ columns, value, onChange, label, placeholder, sx }: FieldPickerProps) {
  if (!columns) {
    return (
      <TextField
        size="small"
        label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        sx={sx}
      />
    )
  }

  // Keep the current value visible even if the input no longer offers it (honest).
  const offered = columns.some((c) => c.field === value)
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={sx}
      slotProps={{ select: { displayEmpty: true } }}
    >
      <MenuItem value="">
        <em>{placeholder ?? '—'}</em>
      </MenuItem>
      {columns.map((c) => (
        <MenuItem key={c.field} value={c.field}>{c.label}</MenuItem>
      ))}
      {value !== '' && !offered && (
        <MenuItem value={value}>{value}</MenuItem>
      )}
    </TextField>
  )
}
