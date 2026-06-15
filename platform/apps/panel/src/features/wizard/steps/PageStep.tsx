import { useState } from 'react'
import { Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText,
         IconButton, Chip, Divider, TextField, Button } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FilterListIcon from '@mui/icons-material/FilterList'
import BarChartIcon from '@mui/icons-material/BarChart'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import DeleteIcon from '@mui/icons-material/Delete'
import { useNotify } from 'react-admin'
import {
  DndContext, DragOverlay, type DragEndEvent, type DragStartEvent,
  closestCenter, useDraggable, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useConstructorStore, useActivePage, useSelectedNode } from '../../../store/constructor.store'
import { useDndSensors } from '../../../shared/dnd/useDndSensors'
import type { CanvasNodeKind, CanvasNode } from '../../../types/constructor'
import { PLATFORM_CAPABILITIES } from '../../../platform-capabilities'

// ── Palette catalog ───────────────────────────────────────────────────────────
const PALETTE_NODES: { kind: CanvasNodeKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'page-header',    label: 'გვერდის სათაური',  icon: <DashboardIcon /> },
  { kind: 'filter-bar',     label: 'ფილტრის პანელი',   icon: <FilterListIcon /> },
  { kind: 'kpi-strip',      label: 'KPI სტრიპი',       icon: <ViewModuleIcon /> },
  { kind: 'section',        label: 'სექცია',            icon: <BarChartIcon /> },
  { kind: 'hero',           label: 'ჰერო',              icon: <DashboardIcon /> },
  { kind: 'links',          label: 'ბმულები',           icon: <DashboardIcon /> },
  { kind: 'stats-carousel', label: 'სტატ. კარუსელი',   icon: <ViewModuleIcon /> },
]

// Task 5: cross-reference the static palette with PLATFORM_CAPABILITIES META so the
// Georgian label wins when the engine catalog provides one. Defensive: the catalog
// namespace shape is engine-owned and may not carry a `.META.label`, so we read it
// optionally and fall back to the static English label.
const PALETTE_KIND_TO_META: Partial<Record<CanvasNodeKind, string>> = {
  'page-header':    'pageHeader',
  'filter-bar':     'filterBar',
  'kpi-strip':      'kpiStrip',
  'section':        'section',
  'hero':           'hero',
  'links':          'links',
  'stats-carousel': 'statsCarousel',
}

function metaLabel(kind: CanvasNodeKind, fallback: string): string {
  const metaKey = PALETTE_KIND_TO_META[kind]
  if (!metaKey) return fallback
  // nodes catalog deferred — plugins/catalog imports react-apexcharts/leaflet which
  // are not installed in panel. Falls back to the Georgian label from PALETTE_NODES.
  const nodes = (PLATFORM_CAPABILITIES as Record<string, unknown>)['nodes'] as Record<string, unknown> | undefined
  if (!nodes) return fallback
  const entry = nodes[metaKey] as { META?: { label?: { ka?: string; en?: string } }; label?: { ka?: string; en?: string } } | undefined
  const label = entry?.META?.label ?? entry?.label
  return label?.ka ?? label?.en ?? fallback
}

const KIND_ICON: Record<string, React.ReactNode> = {
  'page-header':    <DashboardIcon fontSize="small" />,
  'filter-bar':     <FilterListIcon fontSize="small" />,
  'kpi-strip':      <ViewModuleIcon fontSize="small" />,
  'section':        <BarChartIcon fontSize="small" />,
  'hero':           <DashboardIcon fontSize="small" />,
  'links':          <DashboardIcon fontSize="small" />,
  'stats-carousel': <ViewModuleIcon fontSize="small" />,
}

// ── Palette item (draggable source) ───────────────────────────────────────────
function PaletteItem({ kind, label, icon }: { kind: CanvasNodeKind; label: string; icon: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${kind}`,
    data: { kind, source: 'palette' },
  })

  return (
    <ListItem
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Add ${label}`}
      sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 0.75,
        cursor: 'grab', touchAction: 'none',
        opacity: isDragging ? 0.4 : 1,
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
      <ListItemText primary={metaLabel(kind, label)} primaryTypographyProps={{ variant: 'body2' }} />
    </ListItem>
  )
}

// ── Canvas section (sortable) ─────────────────────────────────────────────────
interface SortableCanvasNodeProps {
  node:     CanvasNode
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}

function SortableCanvasNode({ node, selected, onSelect, onRemove }: SortableCanvasNodeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  const title = typeof node.config.title === 'string' ? node.config.title : undefined

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      onClick={onSelect}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, p: 1.5, mb: 1,
        cursor: 'pointer',
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
        aria-label={`Reorder ${node.kind}`}
        sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ display: 'flex', color: 'text.secondary' }}>{KIND_ICON[node.kind]}</Box>
      <Chip size="small" label={node.kind} variant="outlined" />
      <Typography variant="body2" sx={{ flex: 1 }}>{title ?? <em>(untitled)</em>}</Typography>
      <IconButton size="small" aria-label={`Remove ${node.kind}`} onClick={(e) => { e.stopPropagation(); onRemove() }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}

// ── Canvas drop zone ──────────────────────────────────────────────────────────
function CanvasDropZone({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })
  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: 1, p: 2, borderRadius: 2, minHeight: 360,
        border: '2px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        bgcolor: isOver ? 'action.hover' : 'transparent',
        transition: 'background-color 120ms, border-color 120ms',
      }}
    >
      {empty
        ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
            <Typography variant="body2">გადაათრიეთ კომპონენტები გვერდის ასაწყობად</Typography>
          </Box>
        )
        : children}
    </Box>
  )
}

export function PageStep() {
  const page         = useActivePage()
  const selectedId   = useSelectedNode()
  const selectNode   = useConstructorStore((s) => s.selectNode)
  const addNode      = useConstructorStore((s) => s.addNode)
  const updateNode   = useConstructorStore((s) => s.updateNode)
  const removeNode   = useConstructorStore((s) => s.removeNode)
  const reorderNodes = useConstructorStore((s) => s.reorderPageNodes)
  const goToStep     = useConstructorStore((s) => s.goToStep)
  const markStepDone = useConstructorStore((s) => s.markStepDone)
  const notify       = useNotify()
  const sensors      = useDndSensors()

  const [dragKind, setDragKind] = useState<CanvasNodeKind | null>(null)

  const pageId   = page?.id ?? null
  const nodeIds  = page?.nodeIds ?? []
  const selected = page && selectedId ? page.nodes[selectedId] ?? null : null

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { source?: string; kind?: CanvasNodeKind } | undefined
    setDragKind(data?.source === 'palette' && data.kind ? data.kind : null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setDragKind(null)
    const { active, over } = e
    if (!over || !pageId) return
    const data = active.data.current as { source?: string; kind?: CanvasNodeKind } | undefined

    if (data?.source === 'palette' && data.kind) {
      const id = `node-${Math.random().toString(36).slice(2, 9)}`
      const newNode: CanvasNode = { id, kind: data.kind, config: {}, children: [] }
      addNode(pageId, newNode)
      selectNode(id)
      return
    }

    // Canvas section reorder
    if (active.id !== over.id) {
      const oldIndex = nodeIds.indexOf(String(active.id))
      const newIndex = nodeIds.indexOf(String(over.id))
      if (oldIndex >= 0 && newIndex >= 0) {
        reorderNodes(pageId, arrayMove(nodeIds, oldIndex, newIndex))
      }
    }
  }

  const patchConfig = (key: string, value: string) => {
    if (!pageId || !selected) return
    updateNode(pageId, selected.id, { config: { ...selected.config, [key]: value } })
  }

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <DashboardIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>გვერდის კონსტრუქტორი</Typography>
          <Typography variant="body2" color="text.secondary">
            {page ? `რედაქტირება: ${page.title.ka}` : 'გვერდი არ არის არჩეული'}
          </Typography>
        </Box>
      </Box>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 2, flex: 1, minHeight: 400 }}>
          {/* ── Palette ─────────────────────────────────────────────────────── */}
          <Paper variant="outlined" sx={{ p: 1.5, overflow: 'auto' }}>
            <Typography variant="overline" color="text.secondary">პალიტრა</Typography>
            <List disablePadding>
              {PALETTE_NODES.map((p) => (
                <PaletteItem key={p.kind} kind={p.kind} label={p.label} icon={p.icon} />
              ))}
            </List>
          </Paper>

          {/* ── Canvas ──────────────────────────────────────────────────────── */}
          <CanvasDropZone empty={nodeIds.length === 0}>
            <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
              {page && nodeIds.map((id) => {
                const node = page.nodes[id]
                if (!node) return null
                return (
                  <SortableCanvasNode
                    key={id}
                    node={node}
                    selected={selectedId === id}
                    onSelect={() => selectNode(id)}
                    onRemove={() => { if (pageId) removeNode(pageId, id) }}
                  />
                )
              })}
            </SortableContext>
          </CanvasDropZone>

          {/* ── Inspector ───────────────────────────────────────────────────── */}
          <Paper variant="outlined" sx={{ p: 2, overflow: 'auto' }}>
            <Typography variant="overline" color="text.secondary">ინსპექტორი</Typography>
            {!selected && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                         justifyContent: 'center', height: 200, color: 'text.disabled', gap: 1 }}>
                <ViewModuleIcon sx={{ fontSize: 40 }} />
                <Typography variant="body2">აირჩიეთ ელემენტი</Typography>
              </Box>
            )}
            {selected && pageId && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <Chip size="small" label={selected.kind} color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
                <TextField
                  label="სათაური"
                  size="small"
                  value={typeof selected.config.title === 'string' ? selected.config.title : ''}
                  onChange={(e) => patchConfig('title', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="ფერი"
                  size="small"
                  value={typeof selected.config.color === 'string' ? selected.config.color : ''}
                  onChange={(e) => patchConfig('color', e.target.value)}
                  placeholder="#2563eb"
                  fullWidth
                />
                <Divider />
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => { removeNode(pageId, selected.id); selectNode(null) }}
                >
                  წაშლა
                </Button>
              </Box>
            )}
          </Paper>
        </Box>

        <DragOverlay>
          {dragKind ? <Chip color="primary" label={metaLabel(dragKind, dragKind)} /> : null}
        </DragOverlay>
      </DndContext>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={() => goToStep(1)}>← საიტი</Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => { markStepDone(2); notify('ექსპორტი — Phase 2.5-ში', { type: 'info' }) }}
        >
          შენახვა და გადახედვა
        </Button>
      </Box>
    </Box>
  )
}
