import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { TransformStep } from '@statdash/engine'

// ── FilterStepForm — op=filter: where conditions ──────────────────────────────
//
//  The engine `filter` step is `{ op:'filter', where: Record<field, FilterValue> }`
//  (keep rows where every condition holds — AND). There is no `expr` field on
//  this op, so the editor edits `where` directly: one field=value row per
//  condition. Values are parsed as numbers when numeric, else kept as strings;
//  comma-separated input becomes an IN array.
//

type FilterStep = Extract<TransformStep, { op: 'filter' }>

export interface FilterStepFormProps {
  step:     FilterStep
  onChange: (next: FilterStep) => void
}

interface Cond { field: string; raw: string }

function readConds(step: FilterStep): Cond[] {
  return Object.entries(step.where).map(([field, v]) => ({ field, raw: stringifyValue(v) }))
}

function stringifyValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return v === undefined || v === null ? '' : String(v)
}

function parseValue(raw: string): FilterStep['where'][string] {
  const trimmed = raw.trim()
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((s) => coerce(s.trim())) as FilterStep['where'][string]
  }
  return coerce(trimmed) as FilterStep['where'][string]
}

function coerce(s: string): string | number {
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s)
  return s
}

function toStep(conds: Cond[]): FilterStep {
  const where: FilterStep['where'] = {}
  for (const c of conds) {
    if (c.field.trim() === '') continue
    where[c.field] = parseValue(c.raw)
  }
  return { op: 'filter', where }
}

export function FilterStepForm({ step, onChange }: FilterStepFormProps) {
  const conds = readConds(step)

  const updateCond = (index: number, patch: Partial<Cond>) =>
    onChange(toStep(conds.map((c, i) => (i === index ? { ...c, ...patch } : c))))

  const addCond = () => onChange(toStep([...conds, { field: '', raw: '' }]))
  const removeCond = (index: number) => onChange(toStep(conds.filter((_c, i) => i !== index)))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {conds.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          პირობები არ არის (ყველა სტრიქონი გაივლის)
        </Typography>
      )}
      {conds.map((cond, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            label="სვეტი"
            value={cond.field}
            onChange={(e) => updateCond(index, { field: e.target.value })}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            label="მნიშვნელობა (მძიმით = IN)"
            value={cond.raw}
            onChange={(e) => updateCond(index, { raw: e.target.value })}
            sx={{ flex: 1 }}
          />
          <IconButton size="small" aria-label="პირობის წაშლა" onClick={() => removeCond(index)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addCond}>
          პირობის დამატება
        </Button>
      </Box>
    </Box>
  )
}
