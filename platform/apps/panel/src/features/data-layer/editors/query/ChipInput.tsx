import { Autocomplete, Chip, TextField } from '@mui/material'

// ── ChipInput — free-solo multi-value text entry ──────────────────────────────
//
//  Shared primitive: type a token, press Enter to add it as a deletable chip.
//  No autocomplete suggestions — the DataSource catalogue (real codes) is not
//  available in the prototype, so this is pure free text.
//
//  Reused by MeasureSelector (measure codes) and LookupStepForm (lookup fields).
//

export interface ChipInputProps {
  value:       string[]
  onChange:    (next: string[]) => void
  label:       string
  placeholder?: string
}

export function ChipInput({ value, onChange, label, placeholder }: ChipInputProps) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
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
