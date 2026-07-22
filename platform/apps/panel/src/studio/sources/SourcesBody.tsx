import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Chip, Paper, Divider } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { CanonicalUpload } from '../model/CanonicalUpload'
import { CubeInventory } from './CubeInventory'
import { useRole, useSetRole } from '../useRole'
import { studioDataWorkbenchPath } from '../useStudioRoute'
import { useConstructorStore, useDataSources } from '../../store/constructor.store'
import { useDndSensors } from '../../shared/dnd/useDndSensors'
import { storeKeyForDataset } from '../../discovery/cubeProfile.store'
import { SourceAuthoringPanel } from '../../features/datasources/SourceAuthoringPanel'
import { deleteDataSource } from '../../store/api-actions'
import type { ConnectionStatus, Locale } from '../../types/constructor'

// ── SourcesBody — «წყაროები», the INDEPENDENT Data Home, FIRST in the nav (0091) ─
//
//  Owner (2026-07-18): the floors are SEPARATE TOP-LEVEL DESTINATIONS. «წყაროები» leads
//  because «თუ არ გაქვს მონაცემი, რას აკეთებ სხვას» — sources are the spine's origin
//  (Law 11 C1). This is the first-time steward's «რა მაქვს» answered at a glance: the raw
//  cubes I have, their vocabularies, and the ONE door to onboard more.
//
//  Screen-level SRP — one page, one responsibility — IS the decoupling the owner demanded.
//  Self-contained sections, each from its own SSOT:
//    · the ONE upload door (CanonicalUpload — the sole onboarding mount in the studio);
//    · the cube inventory + browsable classifiers (CubeInventory → cubeApi/cubeProfile);
//    · the registered-source manager (steward-only — DU6-IA-1: the raw-source CRUD that used
//      to squat under the Model floor's modeler comes HOME here, gated by the steward lens).
//  «ჯერ შეიმეცნოს, მერე მანიპულირება»: comprehension precedes manipulation.
//
//  ── DU6-IA-1 — source-CRUD comes home (steward-gated) ─────────────────────────
//  The retired `DataModelingPanel`'s source half (the registered-source list +
//  `SourceAuthoringPanel` add/edit + delete + reorder) re-homes here. It stays behind the
//  STEWARD lens: defining a raw base source is the governance wall that keeps published
//  numbers trustworthy (FF-AUTHOR-NO-QUERY — the author never defines a raw source), so an
//  author browsing Sources sees the cubes (comprehension) but not the source-definition CRUD.
//
//  ── In-workspace cube browse (ADR-051 DU2 — the courier is dead) ───────────────
//  A cube's «დაათვალიერე workbench-ში» is an IN-WORKSPACE selection: switch to the Specs
//  floor of THIS same Data workspace (`?dataFloor=specs`) with the picked cube riding the URL
//  (`studioDataWorkbenchPath`); the Specs floor seeds the workbench on arrival. No one-shot
//  store, no `setSurface` teleport. The steward LENS is selected — shaping a raw cube is a
//  steward activity — so landing in the steward shaping view is the least-astonishing outcome.
//
//  WCAG (Law 9): a labelled region; focus lands here on mount; bilingual chrome throughout.

const STATUS_COLOR: Record<ConnectionStatus, 'success' | 'error' | 'default' | 'warning'> = {
  connected: 'success',
  error:     'error',
  idle:      'default',
  pending:   'warning',
}

type SourceSelection = { kind: 'source'; id: string } | { kind: 'source-new' } | null

// ── Sortable source row ─────────────────────────────────────────────────────────
function SourceRow({
  source, selected, onSelect,
}: {
  source: { id: string; name: string; status: ConnectionStatus }
  selected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: source.id })
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
        aria-label={`Reorder ${source.name}`}
        sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ display: 'flex', color: 'text.secondary' }}><StorageIcon fontSize="small" /></Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: selected ? 600 : 400, overflowWrap: 'anywhere' }}>
        {source.name}
      </Typography>
      <Chip size="small" label={source.status} color={STATUS_COLOR[source.status]} />
    </Paper>
  )
}

// ── SourceManager — the registered-source CRUD (steward-only, DU6-IA-1) ──────────
function SourceManager({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const sources = useDataSources()
  const reorderSources = useConstructorStore((s) => s.reorderDataSources)
  const sensors = useDndSensors()
  const [selection, setSelection] = useState<SourceSelection>(null)

  const selectedSource = selection?.kind === 'source' ? sources.find((d) => d.id === selection.id) ?? null : null
  const showAuthoring  = selection?.kind === 'source' || selection?.kind === 'source-new'

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sources.findIndex((d) => d.id === active.id)
    const newIndex = sources.findIndex((d) => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorderSources(arrayMove(sources, oldIndex, newIndex).map((d) => d.id))
  }

  return (
    <Box
      component="section"
      aria-label={en ? 'Source connections' : 'წყაროს პარამეტრები'}
      data-testid="sources-manager"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="overline" color="text.secondary">
          {en ? 'Source connections' : 'წყაროს პარამეტრები'}
        </Typography>
        <Button
          size="small" startIcon={<AddIcon />}
          data-testid="source-add"
          onClick={() => setSelection({ kind: 'source-new' })}
        >
          {en ? 'Add' : 'დამატება'}
        </Button>
      </Box>

      {sources.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sources.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {sources.map((ds) => (
              <SourceRow
                key={ds.id}
                source={ds}
                selected={selection?.kind === 'source' && selection.id === ds.id}
                onSelect={() => setSelection({ kind: 'source', id: ds.id })}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {showAuthoring && (
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {selectedSource && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip size="small" label={selectedSource.type.toUpperCase()} color="primary" variant="outlined" />
              <Chip size="small" label={selectedSource.status} color={STATUS_COLOR[selectedSource.status]} />
              <Box sx={{ flex: 1 }} />
              <Button
                size="small" color="error" startIcon={<DeleteOutlineIcon />}
                data-testid="source-delete"
                onClick={() => { void deleteDataSource(selectedSource.id); setSelection(null) }}
              >
                {en ? 'Delete' : 'წაშლა'}
              </Button>
            </Box>
          )}
          <SourceAuthoringPanel
            key={selectedSource?.id ?? 'new'}
            existing={selectedSource}
            onSaved={(id) => setSelection({ kind: 'source', id })}
          />
        </Paper>
      )}
    </Box>
  )
}

export function SourcesBody({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const navigate = useNavigate()
  const role     = useRole()
  const setRole  = useSetRole()
  const sources  = useDataSources()

  const regionRef = useRef<HTMLDivElement>(null)
  useEffect(() => { regionRef.current?.focus() }, [])

  const onBrowseInWorkbench = (datasetCode: string, measures: string[]) => {
    // 0089 · ADR-046 Addendum 3: FREEZE the picked cube's store home into the seed, resolved
    // here (at the origin gesture) from the session sources — so the seeded steward head reads
    // the PICKED cube's OWN store, not the page's. Undefined when the cube is not a session source.
    const dataSource = storeKeyForDataset(sources, datasetCode)
    setRole('steward')  // shaping a raw cube is a steward activity (FF-AUTHOR-NO-QUERY)
    // In-workspace floor switch (same `/studio/data` surface) seeded with the cube — the
    // Specs floor's workbench reads the seed off the URL. No courier store, no teleport.
    navigate(studioDataWorkbenchPath({ datasetCode, measures, dataSource }))
  }

  return (
    <Box
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={en ? 'Sources' : 'წყაროები'}
      data-testid="sources-body"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, outline: 'none', maxWidth: 920 }}
    >
      <Typography variant="body2" color="text.secondary">
        {en
          ? 'Everything starts with data. Onboard a source, then browse your cubes and their classifiers — see what you have before you shape it.'
          : 'ყველაფერი მონაცემით იწყება. ატვირთე წყარო, შემდეგ დაათვალიერე კუბები და მათი კლასიფიკატორები — ჯერ ნახე რა გაქვს, მერე შეასწორე.'}
      </Typography>

      {/* THE ONE upload door — the sole CanonicalUpload mount in the studio. */}
      <Box
        component="section"
        aria-label={en ? 'Onboard data' : 'მონაცემების ატვირთვა'}
        data-testid="sources-upload"
        sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}
      >
        <CanonicalUpload locale={locale} />
      </Box>

      <CubeInventory locale={locale} onBrowseInWorkbench={onBrowseInWorkbench} />

      {/* The registered-source CRUD — steward-only (the raw-source governance wall). */}
      {role === 'steward' && (<>
        <Divider flexItem />
        <SourceManager locale={locale} />
      </>)}
    </Box>
  )
}
