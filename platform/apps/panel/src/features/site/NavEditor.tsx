import { useState } from 'react'
import {
  Box, Typography, IconButton, Paper, Button, Chip, Collapse, TextField, MenuItem,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useSite, usePages } from '../../store/constructor.store'
import { useDndSensors } from '../../shared/dnd/useDndSensors'
import type { NavItem, CanvasPage, Locale } from '../../types/constructor'

// Resolve a page's display title in the active locale, degrading to ka then slug.
function pageTitle(page: CanvasPage, locale: Locale): string {
  return page.title[locale] || page.title.ka || page.slug
}

// ── Sortable navigation row — header + expandable per-entry editor ─────────────
interface SortableNavRowProps {
  item:      NavItem
  pages:     CanvasPage[]
  locale:    Locale
  expanded:  boolean
  onToggle:  () => void
  onEdit:    (patch: Partial<NavItem>) => void
  onDelete:  () => void
}

function SortableNavRow({ item, pages, locale, expanded, onToggle, onEdit, onDelete }: SortableNavRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        px: 1.5, py: 1, mb: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
        <IconButton
          size="small"
          aria-label={`Edit ${item.label.en}`}
          aria-expanded={expanded}
          color={expanded ? 'primary' : 'default'}
          onClick={onToggle}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={`Delete ${item.label.en}`} onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Per-entry editor — progressive disclosure: shown only for the active row
          (contextual-relevance canon). Edits label (ka/en) + target page; order is
          authored by drag-reorder above. Every field writes through updateNavItem. */}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
          <TextField
            size="small" label="სახელი (ka)" fullWidth
            value={item.label.ka}
            onChange={(e) => onEdit({ label: { ...item.label, ka: e.target.value } })}
          />
          <TextField
            size="small" label="Label (en)" fullWidth
            value={item.label.en}
            onChange={(e) => onEdit({ label: { ...item.label, en: e.target.value } })}
          />
          <TextField
            select size="small" label="სამიზნე გვერდი" fullWidth
            value={pages.some((p) => p.id === item.pageId) ? item.pageId : ''}
            onChange={(e) => onEdit({ pageId: e.target.value })}
          >
            {pages.length === 0 && (
              <MenuItem value="" disabled>გვერდები არ არის</MenuItem>
            )}
            {pages.map((p) => (
              <MenuItem key={p.id} value={p.id}>{pageTitle(p, locale)}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Collapse>
    </Paper>
  )
}

export interface NavEditorProps {
  /** Invoked by the "+ add page" affordance. The wizard passes a stub notify; the
   *  Studio passes the real page-create (open the PageBrowser). Host-supplied so
   *  the shared editor stays agnostic of how a page is created. */
  onAddPage: () => void
}

// ── NavEditor — navigation list + reorder + per-entry edit + delete + add (AR-49) ─
//
//  The left-bar navigation is now DEEP-authorable: each entry's label (ka/en) and
//  target page are editable inline (updateNavItem), order via dnd-kit reorder
//  (reorderNav), plus delete/add. Writes the real site slice via the SAME store
//  actions — byte-identical. The add-page action is injected (onAddPage) so the
//  shared editor stays agnostic of how a page is created.
export function NavEditor({ onAddPage }: NavEditorProps) {
  const site          = useSite()
  const pages         = usePages()
  const reorderNav    = useConstructorStore((s) => s.reorderNav)
  const updateNavItem = useConstructorStore((s) => s.updateNavItem)
  const removeNavItem = useConstructorStore((s) => s.removeNavItem)
  const sensors       = useDndSensors()
  const locale        = site.defaultLocale

  // ONE entry open at a time (contextual-relevance: show only the active editor).
  const [editingId, setEditingId] = useState<string | null>(null)

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
              <SortableNavRow
                key={item.id}
                item={item}
                pages={pages}
                locale={locale}
                expanded={editingId === item.id}
                onToggle={() => setEditingId((cur) => (cur === item.id ? null : item.id))}
                onEdit={(patch) => updateNavItem(item.id, patch)}
                onDelete={() => removeNavItem(item.id)}
              />
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
