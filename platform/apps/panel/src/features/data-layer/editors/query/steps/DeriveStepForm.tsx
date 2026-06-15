import { Box, TextField } from '@mui/material'
import type { TransformStep } from '@geostat/engine'

// ── DeriveStepForm — op=derive: as + expr ─────────────────────────────────────
//
//  expr is the string form (Vega-Lite calculate analogue), e.g.
//  "measure == 'GDP' ? 1 : 0". The engine parses it at apply time.
//

type DeriveStep = Extract<TransformStep, { op: 'derive' }>

export interface DeriveStepFormProps {
  step:     DeriveStep
  onChange: (next: DeriveStep) => void
}

export function DeriveStepForm({ step, onChange }: DeriveStepFormProps) {
  // `as` is preferred; fall back to legacy `name` for display only.
  const asValue = step.as ?? step.name ?? ''
  const exprValue = typeof step.expr === 'string' ? step.expr : ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        size="small"
        label="შედეგის სვეტი"
        value={asValue}
        onChange={(e) => onChange({ op: 'derive', as: e.target.value, expr: step.expr })}
      />
      <TextField
        size="small"
        label="გამოსახულება"
        multiline
        minRows={1}
        value={exprValue}
        onChange={(e) => onChange({ op: 'derive', as: asValue, expr: e.target.value })}
      />
    </Box>
  )
}
