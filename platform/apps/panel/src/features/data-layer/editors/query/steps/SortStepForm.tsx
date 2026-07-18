import { Box, Button, IconButton, MenuItem, Select } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { TransformStep } from '@statdash/engine'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import { FieldPicker } from './offer/FieldPicker'

// ── SortStepForm — op=sort: list of { field, dir } ─────────────────────────────
//
//  Normalizes both engine shapes into one editable list:
//    simple:   { op:'sort', by:'value', dir:'desc' }
//    compound: { op:'sort', by:[{ field, dir }, ...] }
//  On output, a single key emits the simple form; multiple keys emit the array
//  form — matching the patterns seen in real configs (gdp.sections.ts).
//

type SortStep = Extract<TransformStep, { op: 'sort' }>
type SortKey = { field: string; dir: 'asc' | 'desc' }

export interface SortStepFormProps {
  step:     SortStep
  onChange: (next: SortStep) => void
  /** The step's INPUT offer — the field is PICKED from the offered columns (P-OFFER);
   *  absent ⇒ free text. */
  input?:   StepInputOffer
}

function readKeys(step: SortStep): SortKey[] {
  // `by`/`dir` may be a `{ $ctx }` STATE ref (AR-36 state-bound sort) — not editable via this
  // simple field/dir form, so degrade to an empty single key rather than crash the editor.
  const dir: 'asc' | 'desc' = typeof step.dir === 'string' ? step.dir : 'asc'
  if (typeof step.by === 'string') {
    return [{ field: step.by, dir }]
  }
  if (!Array.isArray(step.by)) {
    return [{ field: '', dir }]
  }
  return step.by.map((k) => ({ field: k.field, dir: k.dir ?? 'asc' }))
}

function toStep(keys: SortKey[]): SortStep {
  if (keys.length === 1) return { op: 'sort', by: keys[0].field, dir: keys[0].dir }
  return { op: 'sort', by: keys.map((k) => ({ field: k.field, dir: k.dir })) }
}

export function SortStepForm({ step, onChange, input }: SortStepFormProps) {
  const keys = readKeys(step)

  const updateKey = (index: number, patch: Partial<SortKey>) =>
    onChange(toStep(keys.map((k, i) => (i === index ? { ...k, ...patch } : k))))

  const addKey = () => onChange(toStep([...keys, { field: '', dir: 'asc' }]))

  const removeKey = (index: number) => {
    const next = keys.filter((_k, i) => i !== index)
    onChange(toStep(next.length === 0 ? [{ field: '', dir: 'asc' }] : next))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {keys.map((key, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FieldPicker
            columns={input?.columns}
            value={key.field}
            onChange={(field) => updateKey(index, { field })}
            label="სვეტი"
            placeholder="აირჩიეთ სვეტი"
            sx={{ flex: 1 }}
          />
          <Select
            size="small"
            value={key.dir}
            onChange={(e) => updateKey(index, { dir: e.target.value as 'asc' | 'desc' })}
            sx={{ width: 120 }}
          >
            <MenuItem value="asc">asc ↑</MenuItem>
            <MenuItem value="desc">desc ↓</MenuItem>
          </Select>
          <IconButton size="small" aria-label="დახარისხების წაშლა" onClick={() => removeKey(index)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addKey}>
          ველის დამატება
        </Button>
      </Box>
    </Box>
  )
}
