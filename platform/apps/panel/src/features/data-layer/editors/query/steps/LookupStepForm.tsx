import { Box, TextField } from '@mui/material'
import type { TransformStep } from '@geostat/engine'
import { ChipInput } from '../ChipInput'

// ── LookupStepForm — op=lookup: key + from($d ref) + fields ────────────────────
//
//  Editor restricts `from` to the display-ref form { $d: 'dim' } — the common
//  case (label/color join). Inline-map and { $cl } forms are out of scope for
//  the visual builder; round-tripping them is preserved by reading defensively.
//

type LookupStep = Extract<TransformStep, { op: 'lookup' }>

export interface LookupStepFormProps {
  step:     LookupStep
  onChange: (next: LookupStep) => void
}

function readFromDim(from: LookupStep['from']): string {
  if (from && typeof from === 'object' && '$d' in from) return String((from as { $d: string }).$d ?? '')
  return ''
}

export function LookupStepForm({ step, onChange }: LookupStepFormProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        size="small"
        label="გასაღების სვეტი"
        value={step.key}
        onChange={(e) => onChange({ ...step, key: e.target.value })}
      />
      <TextField
        size="small"
        label="განზომილება ($d)"
        value={readFromDim(step.from)}
        onChange={(e) => onChange({ ...step, from: { $d: e.target.value } })}
      />
      <ChipInput
        label="სვეტები"
        value={step.fields}
        onChange={(fields) => onChange({ ...step, fields })}
      />
    </Box>
  )
}
