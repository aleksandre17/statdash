// ── RowListEditor — type=row-list: an add/remove/reorder list of RowSpecs [V2] ─
//
//  A `row-list` DataSpec is an explicit RowSpec[] (the year-mode shorthand: one row
//  per measure). This is the LIST surface: add / remove / drag-reorder the rows;
//  each row is authored by RowSpecEditor through the EXISTING generic Inspector
//  (schema-driven — no bespoke per-field form). Mirrors PipelineBuilder's D&D list
//  shape EXACTLY (a parallel stable-uid array kept length-synced with `value`, so
//  the pure config rows carry no id — Law 2), one rung over: a RowSpec instead of a
//  TransformStep.
//
import { useState } from 'react'
import {
  Box, Button, IconButton, Paper, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import type { DataSpec, RowSpec } from '@statdash/engine'
import { useDndSensors } from '../../../../shared/dnd/useDndSensors'
import { RowSpecEditor } from './RowSpecEditor'

type RowListSpec = Extract<DataSpec, { type: 'row-list' }>

export interface RowListEditorProps {
  value:    RowListSpec
  onChange: (next: RowListSpec) => void
}

let uidCounter = 0
const nextUid = () => `row-${uidCounter++}`

export function RowListEditor({ value, onChange }: RowListEditorProps) {
  const sensors = useDndSensors()
  const rows = value.rows

  // Stable drag ids — one per row, kept length-synced with `value.rows` via the
  // React-sanctioned "adjust state while rendering" pattern (same as PipelineBuilder).
  const [uids, setUids] = useState<string[]>(() => rows.map(() => nextUid()))
  if (uids.length !== rows.length) {
    setUids((prev) =>
      prev.length < rows.length
        ? [...prev, ...Array.from({ length: rows.length - prev.length }, nextUid)]
        : prev.slice(0, rows.length),
    )
  }

  const setRows = (next: RowSpec[]) => onChange({ ...value, rows: next })

  const updateRow = (index: number, next: RowSpec) =>
    setRows(rows.map((r, i) => (i === index ? next : r)))

  const removeRow = (index: number) => {
    setUids(uids.filter((_u, i) => i !== index))
    setRows(rows.filter((_r, i) => i !== index))
  }

  const addRow = () => {
    setUids([...uids, nextUid()])
    setRows([...rows, { code: '' }])
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = uids.indexOf(String(active.id))
    const newIndex = uids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setUids(arrayMove(uids, oldIndex, newIndex))
    setRows(arrayMove(rows, oldIndex, newIndex))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          სტრიქონები არ არის — დაამატეთ ქვემოთ
        </Typography>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={uids} strategy={verticalListSortingStrategy}>
          {rows.map((row, index) => (
            <RowCard
              key={uids[index]}
              uid={uids[index]}
              index={index}
              row={row}
              onChange={(next) => updateRow(index, next)}
              onRemove={() => removeRow(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addRow}>
          სტრიქონის დამატება
        </Button>
      </Box>
    </Box>
  )
}

// ── RowCard — one sortable Paper card wrapping the schema-driven RowSpecEditor ──
interface RowCardProps {
  uid:      string
  index:    number
  row:      RowSpec
  onChange: (next: RowSpec) => void
  onRemove: () => void
}

function RowCard({ uid, index, row, onChange, onRemove }: RowCardProps) {
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
          aria-label={`გადაადგილება: სტრიქონი ${index + 1}`}
          sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          სტრიქონი {index + 1}{row.code ? ` · ${row.code}` : ''}
        </Typography>
        <IconButton size="small" aria-label="სტრიქონის წაშლა" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <RowSpecEditor uid={uid} row={row} onChange={onChange} />
    </Paper>
  )
}
