import { useState } from 'react'
import { Box, Typography, Button, Chip, Paper, Divider } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import DataObjectIcon from '@mui/icons-material/DataObject'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useDataSources, useDataSpecs } from '../../../store/constructor.store'
import { useDndSensors } from '../../../shared/dnd/useDndSensors'
import { DataSpecEditor } from '../../data-layer'
import type { ConnectionStatus } from '../../../types/constructor'

// ── Selection model ───────────────────────────────────────────────────────────
// Right panel is driven by a discriminated selection: which list + which id.
type Selection =
  | { kind: 'source'; id: string }
  | { kind: 'spec';   id: string }
  | null

const STATUS_COLOR: Record<ConnectionStatus, 'success' | 'error' | 'default' | 'warning'> = {
  connected: 'success',
  error:     'error',
  idle:      'default',
  pending:   'warning',
}

// ── Sortable row (shared by both lists) ───────────────────────────────────────
interface SortableRowProps {
  id:       string
  primary:  string
  icon:     React.ReactNode
  selected: boolean
  endAdornment?: React.ReactNode
  onSelect: () => void
}

function SortableRow({ id, primary, icon, selected, endAdornment, onSelect }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      onClick={onSelect}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, mb: 0.75,
        cursor: 'pointer', userSelect: 'none',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? 'action.selected' : 'background.paper',
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Box
        component="span"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${primary}`}
        sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>
      <Typography variant="body2" sx={{ flex: 1, fontWeight: selected ? 600 : 400 }}>
        {primary}
      </Typography>
      {endAdornment}
    </Paper>
  )
}

export function DataStep() {
  const sources = useDataSources()
  const specs   = useDataSpecs()
  const reorderSources = useConstructorStore((s) => s.reorderDataSources)
  const reorderSpecs   = useConstructorStore((s) => s.reorderDataSpecs)
  const updateDataSpec = useConstructorStore((s) => s.updateDataSpec)
  const markStepDone   = useConstructorStore((s) => s.markStepDone)
  const goToStep       = useConstructorStore((s) => s.goToStep)
  const sensors        = useDndSensors()

  const [selection, setSelection] = useState<Selection>(null)

  const handleSourceDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sources.findIndex((d) => d.id === active.id)
    const newIndex = sources.findIndex((d) => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorderSources(arrayMove(sources, oldIndex, newIndex).map((d) => d.id))
  }

  const handleSpecDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = specs.findIndex((d) => d.id === active.id)
    const newIndex = specs.findIndex((d) => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorderSpecs(arrayMove(specs, oldIndex, newIndex).map((d) => d.id))
  }

  const selectedSource = selection?.kind === 'source' ? sources.find((d) => d.id === selection.id) ?? null : null
  const selectedSpec   = selection?.kind === 'spec'   ? specs.find((d) => d.id === selection.id) ?? null   : null

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <StorageIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>მონაცემთა შრე</Typography>
          <Typography variant="body2" color="text.secondary">
            კონფიგურირებეთ მონაცემების წყაროები და განსაზღვრეთ DataSpec-ები
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 2, flex: 1, minHeight: 420 }}>
        {/* ── LEFT: Browser ─────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          <Box>
            <Typography variant="overline" color="text.secondary">მონაცემების წყაროები</Typography>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSourceDragEnd}>
              <SortableContext items={sources.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                {sources.map((ds) => (
                  <SortableRow
                    key={ds.id}
                    id={ds.id}
                    primary={ds.name}
                    icon={<StorageIcon fontSize="small" />}
                    selected={selection?.kind === 'source' && selection.id === ds.id}
                    endAdornment={<Chip size="small" label={ds.status} color={STATUS_COLOR[ds.status]} />}
                    onSelect={() => setSelection({ kind: 'source', id: ds.id })}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">მონაცემების სპეც-ები</Typography>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSpecDragEnd}>
              <SortableContext items={specs.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                {specs.map((spec) => (
                  <SortableRow
                    key={spec.id}
                    id={spec.id}
                    primary={spec.name}
                    icon={<DataObjectIcon fontSize="small" />}
                    selected={selection?.kind === 'spec' && selection.id === spec.id}
                    onSelect={() => setSelection({ kind: 'spec', id: spec.id })}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </Box>
        </Paper>

        {/* ── RIGHT: Editor ─────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 3, overflow: 'auto' }}>
          {!selection && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                       alignItems: 'center', justifyContent: 'center', color: 'text.disabled', gap: 1 }}>
              <DataObjectIcon sx={{ fontSize: 48 }} />
              <Typography variant="body2">აირჩიეთ წყარო ან სპეც-ი სანახავად</Typography>
            </Box>
          )}

          {selectedSource && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight={600}>{selectedSource.name}</Typography>
                {selectedSource.status === 'connected' && <CheckCircleIcon color="success" fontSize="small" />}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip size="small" label={selectedSource.type.toUpperCase()} color="primary" variant="outlined" />
                <Chip size="small" label={selectedSource.status} color={STATUS_COLOR[selectedSource.status]} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">URL მისამართი</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {selectedSource.url ?? '—'}
                </Typography>
              </Box>

              <Divider />
              <Typography variant="overline" color="text.secondary">გადახედვა</Typography>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <Box component="thead">
                  <Box component="tr" sx={{ '& th': { textAlign: 'left', borderBottom: '1px solid', borderColor: 'divider', py: 0.5 } }}>
                    <Box component="th">Property</Box>
                    <Box component="th">Value</Box>
                  </Box>
                </Box>
                <Box component="tbody" sx={{ '& td': { borderBottom: '1px solid', borderColor: 'divider', py: 0.5 } }}>
                  <Box component="tr"><Box component="td">id</Box><Box component="td">{selectedSource.id}</Box></Box>
                  <Box component="tr"><Box component="td">type</Box><Box component="td">{selectedSource.type}</Box></Box>
                  <Box component="tr"><Box component="td">status</Box><Box component="td">{selectedSource.status}</Box></Box>
                </Box>
              </Box>
            </Box>
          )}

          {selectedSpec && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" fontWeight={600}>{selectedSpec.name}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedSpec.description ?? '—'}</Typography>
              <Box>
                <Chip
                  size="small"
                  label={String((selectedSpec.spec as { type?: string }).type ?? 'spec')}
                  color="secondary"
                  variant="outlined"
                />
              </Box>
              <Divider />
              <DataSpecEditor
                value={selectedSpec.spec}
                onChange={(spec) => updateDataSpec(selectedSpec.id, { spec })}
              />
            </Box>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => { markStepDone(0); goToStep(1) }}>
          გაგრძელება → საიტი
        </Button>
      </Box>
    </Box>
  )
}
