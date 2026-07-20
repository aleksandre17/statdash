import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Button, Chip, Paper, Divider } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import DataObjectIcon from '@mui/icons-material/DataObject'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useDataSources, useDataSpecs } from '../../store/constructor.store'
import { useDndSensors } from '../../shared/dnd/useDndSensors'
import type { DataSpec } from '@statdash/engine'
import { withStewardCube, fromWorkbenchModel } from './workbench/workbenchModel'
import { CUBE_SEED_PARAM, CUBE_MEASURES_PARAM, CUBE_STORE_PARAM, WORKBENCH_SEED_PARAMS } from '../../studio/useStudioRoute'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import { SuspenseFallback } from '../../shared/SuspenseFallback'

// Lazy: the three-pane workbench (+ PipelineBuilder/dnd-kit, live grid, generated-query
// pane) loads only when a spec is opened for shaping — never in the eager modeler chunk.
// It is the SOLE spec editor in this host (ADR-051 DU3): a query/pipeline shapes on the
// three panes; any other kind edits in its co-located SpecBody fallback lane. The SAME
// surface the inspector DATA-facet escalation mounts (0086 — ONE editor, no sibling).
const DataWorkbench = lazy(() =>
  import('./workbench/DataWorkbench').then((m) => ({ default: m.DataWorkbench })),
)
import { ShowMe } from './showme/ShowMe'
import { SourceAuthoringPanel } from '../datasources/SourceAuthoringPanel'
import { ExcelUpload } from '../datasources/ExcelUpload'
import { deleteDataSource, createDataSpec, refreshDataSources, updateDataSpec, flushDataSpecSaves } from '../../store/api-actions'
import { useDataSpecSave } from '../../store/dataSpecSave.store'
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

  // ── ONE editor = the workbench (0086 · 0099 · ADR-051 DU3) ─────────────────────
  //  EVERY selected spec — a native `pipeline` (what the Sources «დაათვალიერე workbench-ში»
  //  cross-gesture seeds), a legacy `query` (via its desugared view), OR any other kind
  //  (row-list/timeseries/growth/…) — is edited through the ONE `DataWorkbench` surface.
  //  The workbench internally routes: a query/pipeline shapes on the three-pane GRID (never
  //  the raw-JSON `JsonFallback` — the 0089 finding #2 defect); any other kind edits IN its
  //  co-located SpecBody FALLBACK LANE. This is byte-for-byte the SAME surface the inspector
  //  DATA-facet escalation opens (no fork), so a non-pipeline spec opened here edits through
  //  the SAME lane as the inspector door — genuinely one surface, no host-dependent second
  //  editor. The kind `<Select>` type-switcher (ADR-046 already deleted the 8-way spec-type
  //  Select) does NOT reappear; type-conversion is the workbench's "bind a governed metric"
  //  path, not a raw Select (FF-ONE-SPEC-EDITOR).
  const selectedSpecId = selectedSpec?.id

  // ── Durable edit persistence (data-loss fix) ───────────────────────────────────
  //  Every workbench onChange (BOTH the three-pane pipeline shaping AND the fallback-
  //  lane non-pipeline edit funnel through the ONE onChange below) persists through the
  //  api-action `updateDataSpec`: immediate optimistic store write (snappy controlled
  //  value) + a debounced, coalesced PUT. Leaving a spec (back-to-list / selecting
  //  another / unmount) FLUSHES any pending PUT so a debounced edit is never dropped by
  //  navigation. The save phase is surfaced honestly in the head (Law 11).
  const save = useDataSpecSave(selectedSpecId)
  useEffect(() => {
    if (!selectedSpecId) return
    // Cleanup fires on id change AND on unmount → flush the spec being left.
    return () => { void flushDataSpecSaves() }
  }, [selectedSpecId])

  // The workbench takes over the panel full-width (the CRAFT room its three panes need —
  // the same reason the inspector escalates it to a full-screen focus-view). Bring it into
  // view on arrival (the handoff lands the steward here from another scroll position).
  const workbenchHeadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selectedSpecId) return
    const el = workbenchHeadRef.current
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
  }, [selectedSpecId])

  if (selectedSpec) {
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
            {selectedSpec.name}
          </Typography>
          <Chip
            size="small"
            label={String((selectedSpec.spec as { type?: string }).type ?? 'spec')}
            color="secondary"
            variant="outlined"
          />
          {/* Honest save state (Law 11) — never a fake "saved". The error chip retries
              the durable PUT with the current spec; success/saving are informational. */}
          {save?.phase === 'saving' && (
            <Chip size="small" variant="outlined" data-testid="spec-save-status"
              label={en ? 'Saving…' : 'ინახება…'} />
          )}
          {save?.phase === 'saved' && (
            <Chip size="small" color="success" variant="outlined" data-testid="spec-save-status"
              label={en ? 'Saved' : 'შენახულია'} />
          )}
          {save?.phase === 'error' && (
            <Chip size="small" color="error" clickable data-testid="spec-save-status"
              onClick={() => updateDataSpec(selectedSpec.id, { spec: selectedSpec.spec })}
              label={en ? `Not saved — retry` : 'ვერ შეინახა — თავიდან'} />
          )}
        </Box>

        <Suspense fallback={<SuspenseFallback label={en ? 'Loading workbench' : 'იტვირთება ვორქბენჩი'} />}>
          <DataWorkbench
            value={selectedSpec.spec}
            onChange={(spec) => updateDataSpec(selectedSpec.id, { spec })}
          />
        </Suspense>
        {/* ADR-051 DU3 — the parallel "Raw editor (advanced)" accordion + the kind <Select>
            are GONE: the workbench (with its co-located SpecBody fallback lane) is the SOLE
            spec-editing surface here. A non-pipeline kind edits INSIDE the workbench's
            fallback lane — the SAME lane the inspector door opens — never a second sibling
            editor and never a raw type-switcher (FF-ONE-SPEC-EDITOR). */}
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
          {/* A selected spec is NOT edited here — it takes over the panel full-width through
              the ONE DataWorkbench surface (the early return above, ADR-051 DU3). The grid
              view only hosts source authoring / upload; there is no second spec editor. */}
        </Paper>
      </Box>
    </Box>
  )
}
