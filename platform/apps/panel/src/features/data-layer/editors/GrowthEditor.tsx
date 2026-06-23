import { Box, ToggleButton, ToggleButtonGroup, TextField, Typography } from '@mui/material'
import type { DataSpec } from '@statdash/engine'
import { YearsField } from './YearsField'
import { ChipInput } from './query/ChipInput'

// ── GrowthEditor — type=growth: code[] + years ────────────────────────────────
//
//  code is `string | string[]`. Single mode = one TextField; multi mode = chip
//  input. Toggling preserves the current code(s) across modes where sensible.
//

type GrowthSpec = Extract<DataSpec, { type: 'growth' }>

export interface GrowthEditorProps {
  value:    GrowthSpec
  onChange: (next: GrowthSpec) => void
}

export function GrowthEditor({ value, onChange }: GrowthEditorProps) {
  const isMulti = Array.isArray(value.code)
  const codes = Array.isArray(value.code) ? value.code : value.code ? [value.code] : []

  const setMode = (next: 'single' | 'multi' | null) => {
    if (next === null) return
    if (next === 'multi') onChange({ ...value, code: codes })
    else onChange({ ...value, code: codes[0] ?? '' })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ToggleButtonGroup
        exclusive size="small"
        value={isMulti ? 'multi' : 'single'}
        onChange={(_e, v) => setMode(v)}
      >
        <ToggleButton value="single">ერთი</ToggleButton>
        <ToggleButton value="multi">მრავალი</ToggleButton>
      </ToggleButtonGroup>

      {isMulti ? (
        <ChipInput
          label="კოდები"
          placeholder="GDP"
          value={codes}
          onChange={(code) => onChange({ ...value, code })}
        />
      ) : (
        <TextField
          size="small"
          label="კოდი"
          value={codes[0] ?? ''}
          onChange={(e) => onChange({ ...value, code: e.target.value })}
        />
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          წლები (years)
        </Typography>
        <YearsField value={value.years} onChange={(years) => onChange({ ...value, years })} />
      </Box>
    </Box>
  )
}
