import { Box, Typography, IconButton, Paper, Button, Chip } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useSite } from '../../store/constructor.store'
import { useDndSensors } from '../../shared/dnd/useDndSensors'
import type { NavItem } from '../../types/constructor'

// ── Sortable navigation row ───────────────────────────────────────────────────
interface SortableNavRowProps {
  item:     NavItem
  onDelete: () => void
}

function SortableNavRow({ item, onDelete }: SortableNavRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, mb: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Box
        component="span"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.label.en}`}
        sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', touchAction: 'none' }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>{item.label.ka}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>{item.label.en}</Typography>
      </Box>
      <Chip size="small" variant="outlined" label={item.pageId} />
      <IconButton size="small" aria-label={`Delete ${item.label.en}`} onClick={onDelete}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}

export interface NavEditorProps {
  /** Invoked by the "+ add page" affordance. The wizard passes a stub notify; the
   *  Studio passes the real page-create (open the PageBrowser). Host-supplied so
   *  the shared editor stays agnostic of how a page is created. */
  onAddPage: () => void
}

// ── NavEditor — navigation list + dnd reorder + delete + add-page (AR-49 M1.3) ──
//
//  EXTRACTED from the wizard's SiteStep Navigation tab so the reorder/delete logic
//  (the non-trivial dnd-kit part) is shared by the wizard and the Studio Pages&Site
//  surface — no fork (Law 6/7). Writes the real site slice via the SAME actions
//  (reorderNav / removeNavItem) — byte-identical. The add-page action is injected
//  (onAddPage) so the wizard keeps its stub while the Studio wires the real create.
export function NavEditor({ onAddPage }: NavEditorProps) {
  const site          = useSite()
  const reorderNav    = useConstructorStore((s) => s.reorderNav)
  const removeNavItem = useConstructorStore((s) => s.removeNavItem)
  const sensors       = useDndSensors()

  const handleNavDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = site.nav.map((n) => n.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    reorderNav(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">ნავიგაცია</Typography>
      <Box sx={{ mt: 1 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
          <SortableContext items={site.nav.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {site.nav.map((item) => (
              <SortableNavRow key={item.id} item={item} onDelete={() => removeNavItem(item.id)} />
            ))}
          </SortableContext>
        </DndContext>
        {site.nav.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
            ნავიგაციის ელემენტები ჯერ არ არის.
          </Typography>
        )}
        <Button sx={{ mt: 1 }} size="small" variant="outlined" onClick={onAddPage}>
          + გვერდის დამატება
        </Button>
      </Box>
    </Box>
  )
}
