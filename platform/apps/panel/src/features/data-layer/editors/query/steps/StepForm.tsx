import { useState } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import type { TransformStep } from '@statdash/engine'
import { DeriveStepForm } from './DeriveStepForm'
import { LookupStepForm } from './LookupStepForm'
import { SortStepForm } from './SortStepForm'
import { FilterStepForm } from './FilterStepForm'

// ── StepForm — dispatcher: renders the right form per op ───────────────────────
//
//  Supported visually: derive, lookup, sort, filter.
//  Any other op (melt, rename, group, aggregate, rollup, join, …) falls back to
//  a raw-JSON textarea so the step is still editable and round-trips losslessly.
//

export interface StepFormProps {
  step:     TransformStep
  onChange: (next: TransformStep) => void
}

export function StepForm({ step, onChange }: StepFormProps) {
  switch (step.op) {
    case 'derive': return <DeriveStepForm step={step} onChange={onChange} />
    case 'lookup': return <LookupStepForm step={step} onChange={onChange} />
    case 'sort':   return <SortStepForm   step={step} onChange={onChange} />
    case 'filter': return <FilterStepForm step={step} onChange={onChange} />
    default:       return <RawStepForm    step={step} onChange={onChange} />
  }
}

// ── RawStepForm — JSON escape hatch for unsupported ops ───────────────────────
function RawStepForm({ step, onChange }: StepFormProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(step, null, 2))
  const [error, setError] = useState<string | null>(null)

  const handleChange = (text: string) => {
    setDraft(text)
    try {
      const parsed = JSON.parse(text) as TransformStep
      if (parsed.op !== step.op) {
        setError('op-ის შეცვლა აქ დაუშვებელია')
        return
      }
      setError(null)
      onChange(parsed)
    } catch {
      setError('არასწორი JSON')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        ვიზუალური ფორმა მიუწვდომელია — დაარედაქტირეთ JSON
      </Typography>
      <TextField
        size="small"
        multiline
        minRows={3}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        error={error !== null}
        helperText={error ?? undefined}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
      />
    </Box>
  )
}
