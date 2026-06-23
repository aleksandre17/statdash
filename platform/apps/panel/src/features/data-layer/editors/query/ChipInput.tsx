import { Autocomplete, Chip, TextField } from '@mui/material'

// ── ChipInput — multi-value entry, suggestion-aware + free-solo ───────────────
//
//  Shared primitive: type a token, press Enter to add it as a deletable chip.
//  `options` supplies suggestions (C3: the active dataset's REAL measure codes
//  from the cube profile, so the author PICKS rather than types a raw code —
//  Law 2). freeSolo is KEPT so it degrades to pure free text when no profile is
//  available (graceful degradation) — the field never becomes unusable.
//
//  Reused by MeasureSelector (measure codes) and LookupStepForm (lookup fields).
//

export interface ChipInputProps {
  value:       string[]
  onChange:    (next: string[]) => void
  label:       string
  placeholder?: string
  /** Suggested values (codes). Empty ⇒ pure free-text entry (current behaviour). */
  options?:    string[]
}

export function ChipInput({ value, onChange, label, placeholder, options = [] }: ChipInputProps) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={options}
      value={value}
      onChange={(_e, next) => onChange((next as string[]).map((s) => s.trim()).filter(Boolean))}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => {
          const { key, ...chipProps } = getTagProps({ index })
          return <Chip key={key} size="small" label={tag} {...chipProps} />
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          size="small"
          label={label}
          placeholder={placeholder}
        />
      )}
    />
  )
}
