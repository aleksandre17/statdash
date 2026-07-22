import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Button, Chip, Paper } from '@mui/material'
import DataObjectIcon from '@mui/icons-material/DataObject'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useDataSpecs } from '../../store/constructor.store'
import { useDndSensors } from '../../shared/dnd/useDndSensors'
import type { DataSpec } from '@statdash/engine'
import { withStewardCube, fromWorkbenchModel } from '../../features/data-layer/workbench/workbenchModel'
import { CUBE_SEED_PARAM, CUBE_MEASURES_PARAM, CUBE_STORE_PARAM, WORKBENCH_SEED_PARAMS } from '../useStudioRoute'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import { DataWorkbench } from '../../features/data-layer/workbench/DataWorkbench'
import { ShowMe } from '../../features/data-layer/showme/ShowMe'
import { createDataSpec, updateDataSpec } from '../../store/api-actions'
import { useDataSpecDraft } from '../../store/dataSpecDraft.store'
import { AuthoringLifecycleBand } from '../../features/data-layer/lifecycle/AuthoringLifecycleBand'
import type { Locale } from '../../types/constructor'
import '../../features/data-layer/data-modeling-panel.css'

// ── SpecsBody — the Specs floor of the ONE Data workspace (DU6-IA-1) ─────────────
//
//  The accepted §1.1 ladder's THIRD floor, built honest. Extracted VERBATIM from the
//  retired `DataModelingPanel`'s spec half (Strangler, one wave — no engine, no
//  store-shape, no workbench-internal change; the E2 caution honored — this wave moves
//  the mount, it never reaches inside `DataWorkbench`). The named DataSpec is a
//  first-class object with an E0 lifecycle, so it earns its own floor rather than
//  squatting under the Model floor's raw modeler.
//
//  What lives here (the spec half of the old modeler):
//    · the spec list (dense, DnD-reorderable rows) + Tableau «Show Me» suggestions;
//    · the full-width `DataWorkbench` takeover when a spec is selected (the craft room
//      its three panes need — the SAME surface the inspector DATA-facet escalates to,
//      no fork, ADR-051 DU3 / FF-ONE-SPEC-EDITOR);
//    · the URL cube-seed consumer (ADR-051 DU2) — a Sources «დაათვალიერე workbench-ში»
//      now targets `?dataFloor=specs&cube=…`; this floor reads that seed on arrival and
//      seeds a fresh steward pipeline for shaping (the ex-courier payload, on the URL).
//
//  ── E0 row grammar — chip-only (DU6-IA-1 §3d) ─────────────────────────────────
//  A spec row carries name · shape chip · an amber DRAFT chip ONLY when an unpublished
//  draft exists (`FF-METRIC-ROW-QUIET`'s sibling for specs). The row-level Publish /
//  Discard buttons of the old dense `AuthoringLifecycleBand` are gone from rows —
//  acting on a draft happens in the workbench head band (ONE action home, quiet rows).
//
//  ── Accessibility (WCAG 2.1 AA · Law 9) ───────────────────────────────────────
//  A labelled region; focus lands here on mount (the floor the user switched INTO);
//  bilingual chrome; every reorder handle is keyboard-operable (dnd-kit sensors).

/** The amber draft chip — the ONLY lifecycle affordance on a row (E0, chip-only). */
function SpecDraftChip({ specId, locale }: { specId: string; locale: Locale }) {
  const draft = useDataSpecDraft(specId)
  const en = locale === 'en'
  if (!draft || draft.changeCount <= 0) return null
  return (
    <Chip
      size="small" color="warning" variant="filled"
      data-testid={`spec-row-draft-${specId}`}
      label={en ? 'Draft' : 'მონახაზი'}
      sx={{ height: 20 }}
    />
  )
}

// ── Sortable spec row ───────────────────────────────────────────────────────────
function SpecRow({
  spec, selected, locale, onSelect,
}: {
  spec: { id: string; name: string; spec: DataSpec }
  selected: boolean
  locale: Locale
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: spec.id })
  const shape = String((spec.spec as { type?: string }).type ?? 'spec')

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
        aria-label={`Reorder ${spec.name}`}
        sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ display: 'flex', color: 'text.secondary' }}><DataObjectIcon fontSize="small" /></Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: selected ? 600 : 400, overflowWrap: 'anywhere' }}>
        {spec.name}
      </Typography>
      <Chip size="small" variant="outlined" label={shape} sx={{ height: 20 }} />
      <SpecDraftChip specId={spec.id} locale={locale} />
    </Paper>
  )
}

export function SpecsBody({ locale }: { locale: Locale }) {
  const specs        = useDataSpecs()
  const reorderSpecs = useConstructorStore((s) => s.reorderDataSpecs)
  const sensors      = useDndSensors()
  const activeLocale = (useActiveLocales()[0] ?? locale) as Locale
  const en = locale === 'en'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedSpec = selectedId ? specs.find((s) => s.id === selectedId) ?? null : null

  const regionRef = useRef<HTMLDivElement>(null)
  useEffect(() => { regionRef.current?.focus() }, [])

  // ── In-workspace cube seed (ADR-051 DU2 — the courier is dead) ─────────────────
  //  The Sources floor's «დაათვალიერე workbench-ში» rides the URL (`studioDataWorkbench
  //  Path` → `?dataFloor=specs&cube=…&cubeMeasures=…&cubeStore=…`), not a one-shot store.
  //  On arrival, seed a fresh spec with the steward raw-cube head (0084's withStewardCube)
  //  and select it for shaping — the SAME createDataSpec path Show-Me uses. The seed params
  //  clear BEFORE the async create (read-then-clear, replace), so a re-render never re-seeds.
  const [params, setParams] = useSearchParams()
  const seedCode     = params.get(CUBE_SEED_PARAM)
  const seedMeasures = params.get(CUBE_MEASURES_PARAM)
  const seedStore    = params.get(CUBE_STORE_PARAM)
  useEffect(() => {
    if (!seedCode) return
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
      .then((created) => setSelectedId(created.id))
  }, [seedCode, seedMeasures, seedStore, setParams])

  const handleSpecDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = specs.findIndex((d) => d.id === active.id)
    const newIndex = specs.findIndex((d) => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorderSpecs(arrayMove(specs, oldIndex, newIndex).map((d) => d.id))
  }

  // Show-Me: a suggested chart → a persisted, populated DataSpec, then selected for editing.
  const handleSuggestionInsert = (spec: DataSpec, panelType: string) => {
    void createDataSpec({ name: `${panelType} (შემოთავაზებული)`, spec })
      .then((created) => setSelectedId(created.id))
  }

  // Bring the workbench head into view on arrival (the seed lands from another scroll pos).
  const workbenchHeadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selectedSpec) return
    const el = workbenchHeadRef.current
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
  }, [selectedSpec])

  // ── The workbench takeover — a selected spec edits full-width (ADR-051 DU3) ─────
  if (selectedSpec) {
    return (
      <Box
        ref={regionRef}
        tabIndex={-1}
        role="region"
        aria-label={en ? 'Specs' : 'სპეც-ები'}
        data-testid="specs-body"
        className="data-modeling-panel data-modeling-panel--workbench"
        sx={{ outline: 'none' }}
      >
        <Box ref={workbenchHeadRef} className="data-modeling-panel__workbench-head" data-testid="modeling-workbench">
          <Button
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={() => setSelectedId(null)}
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
          {/* The Authoring Lifecycle band (C3) — the FULL zoom: the amber draft chip plus
              explicit Publish/Discard and the revision History door. ONE action home for a
              draft (E0) — the rows stay quiet. Honest states only (Law 11). */}
          <AuthoringLifecycleBand docId={selectedSpec.id} locale={activeLocale} />
        </Box>

        <DataWorkbench
          value={selectedSpec.spec}
          onChange={(spec) => updateDataSpec(selectedSpec.id, { spec })}
        />
      </Box>
    )
  }

  // ── The spec list — the floor's browse state ───────────────────────────────────
  return (
    <Box
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={en ? 'Specs' : 'სპეც-ები'}
      data-testid="specs-body"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, outline: 'none', maxWidth: 720 }}
    >
      <Typography variant="body2" color="text.secondary">
        {en
          ? 'Named data specifications — the queries and pipelines that shape a source into a chart-ready shape. Pick one to shape it, or start from a suggestion.'
          : 'დასახელებული მონაცემთა სპეციფიკაციები — მოთხოვნები და პაიპლაინები, რომლებიც წყაროს გრაფიკისთვის მზა ფორმამდე ამუშავებს. აირჩიე შესაცვლელად, ან დაიწყე შემოთავაზებიდან.'}
      </Typography>

      <Box>
        <Typography variant="overline" color="text.secondary">
          {en ? 'Data specs' : 'მონაცემების სპეც-ები'}
        </Typography>
        <Box sx={{ mb: 1 }}>
          <ShowMe onInsert={handleSuggestionInsert} />
        </Box>
        {specs.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                     color: 'text.disabled', gap: 1, py: 4 }}>
            <DataObjectIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2">
              {en ? 'No specs yet — start from a suggestion above, or browse a cube in the workbench from Sources.'
                  : 'ჯერ სპეც-ები არ არის — დაიწყე შემოთავაზებიდან, ან დაათვალიერე კუბი workbench-ში წყაროებიდან.'}
            </Typography>
          </Box>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSpecDragEnd}>
            <SortableContext items={specs.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              {specs.map((spec) => (
                <SpecRow
                  key={spec.id}
                  spec={spec}
                  selected={false}
                  locale={locale}
                  onSelect={() => setSelectedId(spec.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </Box>
    </Box>
  )
}
