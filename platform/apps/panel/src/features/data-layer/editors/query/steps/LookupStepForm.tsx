import { Box, TextField } from '@mui/material'
import type { TransformStep } from '@statdash/engine'
import { ChipInput } from '../ChipInput'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import { FieldPicker } from './offer/FieldPicker'

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
  /** The step's INPUT offer — the join KEY is PICKED from the offered columns (P-OFFER);
   *  absent ⇒ free text. */
  input?:   StepInputOffer
}

function readFromDim(from: LookupStep['from']): string {
  if (from && typeof from === 'object' && '$d' in from) return String((from as { $d: string }).$d ?? '')
  return ''
}

export function LookupStepForm({ step, onChange, input }: LookupStepFormProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FieldPicker
        columns={input?.columns}
        value={step.key}
        onChange={(key) => onChange({ ...step, key })}
        label="გასაღების სვეტი"
        placeholder="აირჩიეთ სვეტი"
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
