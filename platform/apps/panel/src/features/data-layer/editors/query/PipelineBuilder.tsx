import { useState } from 'react'
import {
  Box, Button, Chip, IconButton, MenuItem, Paper, Select, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import type { TransformStep } from '@statdash/engine'
import { listTransformOps } from '@statdash/engine'
import { useDndSensors } from '../../../../shared/dnd/useDndSensors'
import { StepForm } from './steps/StepForm'
import { defaultStep } from './steps/defaultStep'

// ── PipelineBuilder — D&D sortable list of TransformSteps ─────────────────────
//
//  TransformStep has no id (it is pure config), so the builder maintains a
//  parallel array of stable drag uids — one per step, kept in length-sync with
//  `value`. Reordering applies arrayMove to both in lockstep. The uids never
//  touch the emitted config (Law 2: config stays declarative).
//
//  The op picker is built from the engine SSOT (listTransformOps) — every
//  registered op is offerable, so a newly-registered op (with its schema)
//  appears with zero panel code. `joinByField` is excluded: it carries
//  already-resolved EngineRow[], not a declaratively-authorable shape.
//

const NON_AUTHORABLE_OPS = new Set(['joinByField'])

const OP_OPTIONS: { value: string; label: string }[] = listTransformOps()
  .filter((op) => !NON_AUTHORABLE_OPS.has(op))
  .map((op) => ({ value: op, label: op }))

let uidCounter = 0
const nextUid = () => `step-${uidCounter++}`

export interface PipelineBuilderProps {
  value:    TransformStep[]
  onChange: (steps: TransformStep[]) => void
}

export function PipelineBuilder({ value, onChange }: PipelineBuilderProps) {
  const sensors = useDndSensors()

  // Stable drag ids — one per step, kept length-synced with `value`. Held in
  // state (not a render-mutated ref) so identity survives concurrent renders.
  // When `value` changes length from OUTSIDE (parent replaces the prop), we
  // reconcile during render via React's sanctioned "adjust state while
  // rendering" pattern (https://react.dev/reference/react/useState#storing-
  // information-from-previous-renders) — a setState on THIS component during
  // render, which React applies before committing without an extra paint.
  const [uids, setUids] = useState<string[]>(() => value.map(() => nextUid()))
  if (uids.length !== value.length) {
    setUids((prev) =>
      prev.length < value.length
        ? [...prev, ...Array.from({ length: value.length - prev.length }, nextUid)]
        : prev.slice(0, value.length),
    )
  }

  const updateStep = (index: number, next: TransformStep) =>
    onChange(value.map((s, i) => (i === index ? next : s)))

  const removeStep = (index: number) => {
    setUids(uids.filter((_u, i) => i !== index))
    onChange(value.filter((_s, i) => i !== index))
  }

  const addStep = (op: string) => {
    setUids([...uids, nextUid()])
    onChange([...value, defaultStep(op)])
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = uids.indexOf(String(active.id))
    const newIndex = uids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setUids(arrayMove(uids, oldIndex, newIndex))
    onChange(arrayMove(value, oldIndex, newIndex))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {value.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          ნაბიჯები არ არის — დაამატეთ ქვემოთ
        </Typography>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={uids} strategy={verticalListSortingStrategy}>
          {value.map((step, index) => (
            <StepCard
              key={uids[index]}
              uid={uids[index]}
              step={step}
              onChange={(next) => updateStep(index, next)}
              onRemove={() => removeStep(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <AddStepControl onAdd={addStep} />
    </Box>
  )
}

// ── StepCard — one sortable Paper card ────────────────────────────────────────
interface StepCardProps {
  uid:      string
  step:     TransformStep
  onChange: (next: TransformStep) => void
  onRemove: () => void
}

function StepCard({ uid, step, onChange, onRemove }: StepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uid })

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        p: 1.5, display: 'flex', flexDirection: 'column', gap: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="span"
          {...attributes}
          {...listeners}
          aria-label={`გადაადგილება: ${step.op}`}
          sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <Chip size="small" label={step.op} color="primary" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" aria-label="ნაბიჯის წაშლა" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <StepForm step={step} onChange={onChange} />
    </Paper>
  )
}

// ── AddStepControl — op picker + add button ───────────────────────────────────
function AddStepControl({ onAdd }: { onAdd: (op: string) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Select
        size="small"
        displayEmpty
        value=""
        onChange={(e) => { if (e.target.value) onAdd(String(e.target.value)) }}
        sx={{ width: 160 }}
        renderValue={(v) => (v ? String(v) : 'ოპერაცია...')}
      >
        {OP_OPTIONS.map((o) => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>
      <Button size="small" startIcon={<AddIcon />} onClick={() => onAdd('derive')}>
        ნაბიჯის დამატება
      </Button>
    </Box>
  )
}
