// ── ThresholdField — FieldControl: an ordered list of threshold steps ─────────
//
//  The authoring surface for a `Threshold` (ValueThresholdStep[]) — conditional formatting,
//  the numeric-range sibling of value mappings. A list of breakpoints, each edited by
//  ThresholdStepEditor through the EXISTING generic Inspector — no bespoke per-field
//  form (the ADR mandate). Mirrors ValueMappingField's list shape.
//
//  ORDER: resolution is by NUMERIC BOUND (resolveThreshold sorts; the highest reached
//  step wins), so the list order is a DISPLAY convenience, not a priority. The ▲/▼
//  buttons keep authoring tidy (keyboard-operable, aria-labelled — WCAG) but do not
//  change which step matches; a step with an empty `from` is the BASE (−∞) default.
//
import {
  Box, Button, IconButton, Paper, Typography,
} from '@mui/material'
import AddIcon              from '@mui/icons-material/Add'
import DeleteIcon           from '@mui/icons-material/Delete'
import ArrowUpwardIcon      from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon    from '@mui/icons-material/ArrowDownward'
import { useState }         from 'react'
import type { ValueThresholdStep } from '@statdash/engine'
import type { FieldControlProps } from '../../fieldControl.types'
import { ThresholdStepEditor } from './ThresholdStepEditor'

let uidCounter = 0
const nextUid = () => `th-${uidCounter++}`

const EMPTY_STEP: ValueThresholdStep = {}

export function ThresholdField({ value, onChange }: FieldControlProps<ValueThresholdStep[] | undefined>) {
  const steps = value ?? []

  // Stable keys per step — kept length-synced with `steps` (the React-sanctioned
  // "adjust state while rendering" pattern, same as ValueMappingField/RowListEditor).
  const [uids, setUids] = useState<string[]>(() => steps.map(() => nextUid()))
  if (uids.length !== steps.length) {
    setUids((prev) =>
      prev.length < steps.length
        ? [...prev, ...Array.from({ length: steps.length - prev.length }, nextUid)]
        : prev.slice(0, steps.length),
    )
  }

  const commit = (next: ValueThresholdStep[], nextUids: string[]) => {
    setUids(nextUids)
    onChange(next.length ? next : undefined)
  }

  const updateStep = (i: number, next: ValueThresholdStep) =>
    onChange(steps.map((s, idx) => (idx === i ? next : s)))

  const removeStep = (i: number) =>
    commit(steps.filter((_s, idx) => idx !== i), uids.filter((_u, idx) => idx !== i))

  const addStep = () =>
    commit([...steps, EMPTY_STEP], [...uids, nextUid()])

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const s = [...steps]; const u = [...uids]
    ;[s[i], s[j]] = [s[j], s[i]]
    ;[u[i], u[j]] = [u[j], u[i]]
    commit(s, u)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {steps.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          ბიჯები არ არის — დაამატეთ ქვემოთ (ცარიელი „დან“ = საბაზისო ბიჯი)
        </Typography>
      )}

      {steps.map((step, i) => (
        <Paper key={uids[i]} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              ბიჯი {i + 1}{step.from != null ? ` · ≥ ${step.from}` : ' · საბაზისო'}
            </Typography>
            <IconButton size="small" aria-label={`აწევა: ბიჯი ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={`ჩამოწევა: ბიჯი ${i + 1}`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={`ბიჯის წაშლა ${i + 1}`} onClick={() => removeStep(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <ThresholdStepEditor uid={uids[i]} step={step} onChange={(next) => updateStep(i, next)} />
        </Paper>
      ))}

      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addStep}>
          ბიჯის დამატება
        </Button>
      </Box>
    </Box>
  )
}
