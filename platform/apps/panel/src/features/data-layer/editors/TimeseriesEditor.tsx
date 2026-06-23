import { Box, TextField, Typography } from '@mui/material'
import type { DataSpec } from '@statdash/engine'
import { YearsField } from './YearsField'

// ── TimeseriesEditor — type=timeseries: code + years ──────────────────────────

type TimeseriesSpec = Extract<DataSpec, { type: 'timeseries' }>

export interface TimeseriesEditorProps {
  value:    TimeseriesSpec
  onChange: (next: TimeseriesSpec) => void
}

export function TimeseriesEditor({ value, onChange }: TimeseriesEditorProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        size="small"
        label="კოდი"
        value={value.code}
        onChange={(e) => onChange({ ...value, code: e.target.value })}
      />
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          წლები (years)
        </Typography>
        <YearsField value={value.years} onChange={(years) => onChange({ ...value, years })} />
      </Box>
    </Box>
  )
}
