import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Button, Chip, Paper, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import DataObjectIcon from '@mui/icons-material/DataObject'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useDataSources, useDataSpecs } from '../../store/constructor.store'
import { useDndSensors } from '../../shared/dnd/useDndSensors'
import type { DataSpec } from '@statdash/engine'
import { DataSpecEditor } from './DataSpecEditor'
import { withStewardCube, fromWorkbenchModel, isWorkbenchShaped } from './workbench/workbenchModel'
import { CUBE_SEED_PARAM, CUBE_MEASURES_PARAM, CUBE_STORE_PARAM, WORKBENCH_SEED_PARAMS } from '../../studio/useStudioRoute'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import { SuspenseFallback } from '../../shared/SuspenseFallback'

// Lazy: the three-pane workbench (+ PipelineBuilder/dnd-kit, live grid, generated-query
// pane) loads only when a workbench-shaped spec (query/pipeline) is opened for shaping —
// never in the eager modeler chunk. The SAME surface the inspector DATA-facet escalation
// mounts (0086 — ONE editor); the raw-JSON DataSpecEditor stays a steward last resort.
const DataWorkbench = lazy(() =>
  import('./workbench/DataWorkbench').then((m) => ({ default: m.DataWorkbench })),
)
import { ShowMe } from './showme/ShowMe'
import { SourceAuthoringPanel } from '../datasources/SourceAuthoringPanel'
import { ExcelUpload } from '../datasources/ExcelUpload'
import { deleteDataSource, createDataSpec, refreshDataSources } from '../../store/api-actions'
import type { ConnectionStatus } from '../../types/constructor'
import './data-modeling-panel.css'

// ── DataModelingPanel — the reusable source/spec authoring body (AR-49 M1.3) ────
//
//  EXTRACTED verbatim (M1.3, no fork — Law 6 DRY, Law 7 Strangler) so a single
//  component carries the full data-modeling capability across hosts. Its host has
//  RELOCATED with the define-vs-curate role split (AR-49 M2.1): it no longer sits on
//  the author's Data surface (which is now the governed Metric Palette only —
//  FF-AUTHOR-NO-QUERY) but in Model mode (ModelSurface), the Steward's "define"
//  workspace behind the role lens. The store writes are unchanged — the SAME
//  hooks/actions (reorder*, updateDataSpec, createDataSpec, deleteDataSource,
//  refreshDataSources). Layout is container-query responsive (data-modeling-panel.css):
//  two-column when wide, stacked in the narrow dock.

// ── Selection model ───────────────────────────────────────────────────────────
// Right/lower pane is driven by a discriminated selection: which list + which id.
//  - 'source'     edit an existing source (authoring panel, prefilled)
//  - 'source-new' add a new source       (authoring panel, blank)
//  - 'upload'     drop a canonical .xlsx  (Excel ingest → validate → approve)
//  - 'spec'       edit a DataSpec
type Selection =
  | { kind: 'source'; id: string }
  | { kind: 'source-new' }
  | { kind: 'upload' }
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

export function DataModelingPanel() {
  const sources = useDataSources()
  const specs   = useDataSpecs()
  const reorderSources = useConstructorStore((s) => s.reorderDataSources)
  const reorderSpecs   = useConstructorStore((s) => s.reorderDataSpecs)
  const updateDataSpec = useConstructorStore((s) => s.updateDataSpec)
  const sensors        = useDndSensors()
  const en = (useActiveLocales()[0] ?? 'ka') === 'en'

  const [selection, setSelection] = useState<Selection>(null)

  // ── In-workspace cube seed (ADR-051 DU2 — the courier is dead) ─────────────────
  //  The Sources floor's «დაათვალიერე workbench-ში» now rides the URL (`studioDataWorkbench
  //  Path` → `?cube=…&cubeMeasures=…&cubeStore=…`), not a one-shot store. On arrival, seed a
  //  fresh spec with the steward raw-cube head (0084's withStewardCube) and select it for
  //  shaping — the SAME createDataSpec path Show-Me uses. The seed params are cleared BEFORE
  //  the async create (read-then-clear, replace), so a re-render never re-seeds — the exact
  //  one-shot the courier's `take()` gave, now honestly on the workspace URL (DU1 plumbing).
  const [params, setParams] = useSearchParams()
  const seedCode     = params.get(CUBE_SEED_PARAM)
  const seedMeasures = params.get(CUBE_MEASURES_PARAM)
  const seedStore    = params.get(CUBE_STORE_PARAM)
  useEffect(() => {
    if (!seedCode) return
    // One-shot: drop the seed params first, so the effect never fires twice for one intent
    // (the floor param and everything else is preserved — only the cube* keys clear).
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const key of WORKBENCH_SEED_PARAMS) next.delete(key)
      return next
    }, { replace: true })
    const measures = seedMeasures ? seedMeasures.split(',').filter(Boolean) : []
    const seeded = withStewardCube(
      { head: { op: 'source', query: { measure: '' } }, tail: [], encoding: { label: 'time', value: 'value' } },
      measures, seedStore ?? undefined,
    )
    void createDataSpec({ name: `${seedCode} — ნედლი დათვალიერება`, spec: fromWorkbenchModel(seeded) })
      .then((created) => setSelection({ kind: 'spec', id: created.id }))
  }, [seedCode, seedMeasures, seedStore, setParams])

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

  // Show-Me: a suggested chart → a persisted, populated DataSpec, then selected
  // for editing. Reuses createDataSpec (the same path the data layer already
  // uses to add a spec) — Show-Me only supplies the populated spec + a name.
  const handleSuggestionInsert = (spec: DataSpec, panelType: string) => {
    void createDataSpec({ name: `${panelType} (შემოთავაზებული)`, spec })
      .then((created) => setSelection({ kind: 'spec', id: created.id }))
  }

  const selectedSource = selection?.kind === 'source' ? sources.find((d) => d.id === selection.id) ?? null : null
  const selectedSpec   = selection?.kind === 'spec'   ? specs.find((d) => d.id === selection.id) ?? null   : null
  // The authoring panel shows for both an existing source and a brand-new one.
  const showAuthoring  = selection?.kind === 'source' || selection?.kind === 'source-new'

  // ── ONE editor = the workbench (0086 · 0099) ───────────────────────────────────
  //  A workbench-SHAPED spec (a native `pipeline` — what the Sources «დაათვალიერე
  //  workbench-ში» cross-gesture seeds — OR a legacy `query`, via its desugared view) is
  //  SHAPED on the three-pane WORKBENCH GRID, never the raw-JSON `JsonFallback` (the 0089
  //  finding #2 defect). This is the SAME surface the inspector DATA-facet escalation opens
  //  (no fork): the browse rows + steps + generated-query pane the gesture PROMISES. The raw
  //  editor survives as a steward last-resort disclosure below (plane law). Non-workbench
  //  spec kinds (row-list/timeseries/…) keep the `DataSpecEditor` two-column form.
  const workbenchSpec = selectedSpec && isWorkbenchShaped(selectedSpec.spec) ? selectedSpec : null
  const workbenchSpecId = workbenchSpec?.id

  // The workbench takes over the panel full-width (the CRAFT room its three panes need —
  // the same reason the inspector escalates it to a full-screen focus-view). Bring it into
  // view on arrival (the handoff lands the steward here from another scroll position).
  const workbenchHeadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!workbenchSpecId) return
    const el = workbenchHeadRef.current
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
  }, [workbenchSpecId])

  if (workbenchSpec) {
    return (
      <Box className="data-modeling-panel data-modeling-panel--workbench">
        <Box ref={workbenchHeadRef} className="data-modeling-panel__workbench-head" data-testid="modeling-workbench">
          <Button
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={() => setSelection(null)}
            data-testid="workbench-back-to-list"
          >
            {en ? 'Back to list' : 'სიაში დაბრუნება'}
          </Button>
          <Typography variant="h6" fontWeight={600} sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            {workbenchSpec.name}
          </Typography>
          <Chip
            size="small"
            label={String((workbenchSpec.spec as { type?: string }).type ?? 'spec')}
            color="secondary"
            variant="outlined"
          />
        </Box>

        <Suspense fallback={<SuspenseFallback label={en ? 'Loading workbench' : 'იტვირთება ვორქბენჩი'} />}>
          <DataWorkbench
            value={workbenchSpec.spec}
            onChange={(spec) => updateDataSpec(workbenchSpec.id, { spec })}
          />
        </Suspense>

        {/* Steward last resort — the raw DataSpec editor (plane law: raw-JSON is a
            disclosure, never the default landing). Collapsed by default. */}
        <Accordion disableGutters variant="outlined" data-testid="workbench-raw-advanced">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" fontWeight={600}>
              {en ? 'Raw editor (advanced)' : 'ნედლი რედაქტორი (დამატებითი)'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <DataSpecEditor
              value={workbenchSpec.spec}
              onChange={(spec) => updateDataSpec(workbenchSpec.id, { spec })}
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    )
  }

  return (
    <Box className="data-modeling-panel">
      <Box className="data-modeling-panel__grid">
        {/* ── Browser ───────────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="overline" color="text.secondary">მონაცემების წყაროები</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                  size="small" startIcon={<UploadFileIcon />}
                  onClick={() => setSelection({ kind: 'upload' })}
                >
                  Excel
                </Button>
                <Button
                  size="small" startIcon={<AddIcon />}
                  onClick={() => setSelection({ kind: 'source-new' })}
                >
                  დამატება
                </Button>
              </Box>
            </Box>
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
            <Box sx={{ mb: 1 }}>
              <ShowMe onInsert={handleSuggestionInsert} />
            </Box>
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

        {/* ── Editor ────────────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 3, overflow: 'auto' }}>
          {!selection && (
            <Box sx={{ minHeight: 200, display: 'flex', flexDirection: 'column',
                       alignItems: 'center', justifyContent: 'center', color: 'text.disabled', gap: 1 }}>
              <DataObjectIcon sx={{ fontSize: 48 }} />
              <Typography variant="body2">აირჩიეთ წყარო ან სპეც-ი — ან დაამატეთ ახალი</Typography>
            </Box>
          )}

          {showAuthoring && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedSource && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip size="small" label={selectedSource.type.toUpperCase()} color="primary" variant="outlined" />
                  <Chip size="small" label={selectedSource.status} color={STATUS_COLOR[selectedSource.status]} />
                  <Box sx={{ flex: 1 }} />
                  <Button
                    size="small" color="error" startIcon={<DeleteOutlineIcon />}
                    onClick={() => { void deleteDataSource(selectedSource.id); setSelection(null) }}
                  >
                    წაშლა
                  </Button>
                </Box>
              )}
              <SourceAuthoringPanel
                key={selectedSource?.id ?? 'new'}
                existing={selectedSource}
                onSaved={(id) => setSelection({ kind: 'source', id })}
              />
            </Box>
          )}

          {selection?.kind === 'upload' && (
            <ExcelUpload onIngested={() => { void refreshDataSources() }} />
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
    </Box>
  )
}
