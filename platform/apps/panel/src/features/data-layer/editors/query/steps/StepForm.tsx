import { useState } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import type { TransformStep } from '@statdash/engine'
import { getTransformStepSchema } from '@statdash/engine'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import { DeriveStepForm } from './DeriveStepForm'
import { LookupStepForm } from './LookupStepForm'
import { SortStepForm } from './SortStepForm'
import { FilterStepForm } from './FilterStepForm'
import { TransformStepEditor } from './TransformStepEditor'

// ── StepForm — dispatcher: renders the right editor per op ─────────────────────
//
//  Resolution order (OCP, the ADR's "schema-driven, not a bespoke form per op"):
//    1. derive/lookup/sort/filter — keep their hand-tuned bespoke forms (richer
//       list/expression UX), UNCHANGED and byte-identical (their unit tests pin
//       them). These predate the schema-registry and stay the best surface.
//    2. ANY other op carrying an authoring PropSchema → the GENERIC schema-driven
//       TransformStepEditor (the same Inspector that authors node properties).
//       Registering a new op + schema makes it authorable with zero panel code.
//    3. No schema (today only `joinByField`, which carries resolved rows) →
//       a raw-JSON textarea: still editable, round-trips losslessly. This is the
//       shrinking COVERAGE_TODO surface tracked by Fitness #1.
//

export interface StepFormProps {
  step:     TransformStep
  onChange: (next: TransformStep) => void
  /** The step's INPUT offer (columns + distinct member values), when the workbench can
   *  supply it. Enables the P-OFFER pick-don't-type controls (Filter's column+value,
   *  Sort's field, Lookup's key); absent ⇒ the honest free-text fallback. */
  input?:   StepInputOffer
}

export function StepForm({ step, onChange, input }: StepFormProps) {
  switch (step.op) {
    case 'derive': return <DeriveStepForm step={step} onChange={onChange} />
    case 'lookup': return <LookupStepForm step={step} onChange={onChange} input={input} />
    case 'sort':   return <SortStepForm   step={step} onChange={onChange} input={input} />
    case 'filter': return <FilterStepForm step={step} onChange={onChange} input={input} />
    default:
      return getTransformStepSchema(step.op)
        ? <TransformStepEditor step={step} onChange={onChange} />
        : <RawStepForm step={step} onChange={onChange} />
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
