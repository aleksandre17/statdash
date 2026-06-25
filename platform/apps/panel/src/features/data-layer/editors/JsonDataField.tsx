// ── JsonDataField — bounded JSON sub-editor for literal-data leaves [V2] ───────
//
//  The DOCUMENTED, bounded escape hatch (same class as the Inspector's object/array
//  JsonControl, and the op-schemas/param-schemas collection fields): a single
//  literal-data field whose shape is a free JSON value — `transform.source` and
//  `pivot.rows` (inline rows the renderer feeds the pipeline) and `pivot.colors`
//  (a series→color map). YAGNI: a usable JSON textarea, not a fancy grid (the
//  prompt's explicit allowance). Invalid JSON is held locally and NOT propagated,
//  so a half-typed value never corrupts the spec (fail-soft round-trip).
//
import { useState } from 'react'
import { Box, TextField, Typography } from '@mui/material'

export interface JsonDataFieldProps<T> {
  label:    string
  hint?:    string
  value:    T
  onChange: (next: T) => void
}

export function JsonDataField<T>({ label, hint, value, onChange }: JsonDataFieldProps<T>) {
  const [draft, setDraft] = useState(() => stringify(value))
  const [error, setError] = useState<string | null>(null)
  // The canonical JSON of the value WE last emitted / synced from. Lets us tell an
  // OUTSIDE replacement (parent swapped the value — re-sync the textarea) apart
  // from the user mid-typing an invalid draft (must NOT clobber their keystrokes).
  const [syncedJson, setSyncedJson] = useState(() => canonical(value))

  // Re-sync the textarea ONLY when `value` changed from outside (its canonical JSON
  // differs from the one we last synced). React's sanctioned "adjust state while
  // rendering" pattern (https://react.dev/reference/react/useState#storing-
  // information-from-previous-renders) — no effect, no cascading render. A user's
  // invalid draft does NOT trigger this (we never emitted it, so syncedJson is
  // unchanged and still matches the live value's canonical form... unless the
  // value itself moved — exactly the case we DO want to re-sync).
  const incoming = canonical(value)
  if (incoming !== syncedJson) {
    setSyncedJson(incoming)
    setDraft(stringify(value))
    if (error) setError(null)
  }

  const handleChange = (text: string) => {
    setDraft(text)
    try {
      const parsed = JSON.parse(text) as T
      setError(null)
      setSyncedJson(canonical(parsed)) // our own emit — not an outside change
      onChange(parsed)
    } catch {
      setError('არასწორი JSON')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {hint && <Typography variant="caption" color="text.disabled">{hint}</Typography>}
      <TextField
        size="small" multiline minRows={4}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        error={error !== null}
        helperText={error ?? undefined}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
      />
    </Box>
  )
}

/** Pretty JSON for the textarea (the editable draft). */
function stringify(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

/** Compact JSON for change-detection (formatting-insensitive identity). */
function canonical(value: unknown): string {
  return JSON.stringify(value ?? null)
}
