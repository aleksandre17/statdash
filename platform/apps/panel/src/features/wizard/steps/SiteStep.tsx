import { useState } from 'react'
import { Box, Tabs, Tab, TextField, ToggleButton, ToggleButtonGroup, Typography,
         IconButton, Paper, Button, Chip } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import LanguageIcon from '@mui/icons-material/Language'
import PaletteIcon from '@mui/icons-material/Palette'
import NavigationIcon from '@mui/icons-material/Navigation'
import { useNotify } from 'react-admin'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import { useConstructorStore, useSite } from '../../../store/constructor.store'
import { useDndSensors } from '../../../shared/dnd/useDndSensors'
import type { Locale, NavItem } from '../../../types/constructor'
import { PLATFORM_CAPABILITIES } from '../../../platform-capabilities'

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
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" fontWeight={600}>{item.label.ka}</Typography>
        <Typography variant="caption" color="text.secondary">{item.label.en}</Typography>
      </Box>
      <Chip size="small" variant="outlined" label={item.pageId} />
      <IconButton size="small" aria-label={`Delete ${item.label.en}`} onClick={onDelete}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}

export function SiteStep() {
  const site         = useSite()
  const updateSite   = useConstructorStore((s) => s.updateSite)
  const reorderNav   = useConstructorStore((s) => s.reorderNav)
  const removeNavItem = useConstructorStore((s) => s.removeNavItem)
  const markStepDone = useConstructorStore((s) => s.markStepDone)
  const goToStep     = useConstructorStore((s) => s.goToStep)
  const notify       = useNotify()
  const sensors      = useDndSensors()

  const [tab, setTab] = useState(0)

  const handleNavDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = site.nav.map((n) => n.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    reorderNav(arrayMove(ids, oldIndex, newIndex))
  }

  // Group token keys by their catalog group for the Theme tab.
  const tokenGroups = Object.entries(PLATFORM_CAPABILITIES.tokens).reduce<
    Record<string, { key: string; preview: string }[]>
  >((acc, [key, desc]) => {
    const preview = desc.cssVar ?? (desc.value !== undefined ? String(desc.value) : '—')
    ;(acc[desc.group] ??= []).push({ key, preview })
    return acc
  }, {})

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <LanguageIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>საიტის შრე</Typography>
          <Typography variant="body2" color="text.secondary">
            განსაზღვრეთ საიტის იდენტობა, ნავიგაცია და თემა
          </Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v: number) => setTab(v)}>
        <Tab icon={<LanguageIcon />}   iconPosition="start" label="იდენტობა" />
        <Tab icon={<NavigationIcon />} iconPosition="start" label="ნავიგაცია" />
        <Tab icon={<PaletteIcon />}    iconPosition="start" label="თემა" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* ── Identity ──────────────────────────────────────────────────────── */}
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 520, pt: 1 }}>
            <TextField
              label="საიტის სახელი"
              value={site.name}
              onChange={(e) => updateSite({ name: e.target.value })}
              fullWidth
            />
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                ნაგულისხმევი ენა
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={site.defaultLocale}
                onChange={(_, v: Locale | null) => { if (v) updateSite({ defaultLocale: v }) }}
                aria-label="Default locale"
              >
                <ToggleButton value="ka" aria-label="Georgian">ka</ToggleButton>
                <ToggleButton value="en" aria-label="English">en</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField
              label="ლოგოს URL"
              value={site.logo ?? ''}
              onChange={(e) => updateSite({ logo: e.target.value })}
              placeholder="https://…"
              fullWidth
            />
          </Box>
        )}

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        {tab === 1 && (
          <Box sx={{ maxWidth: 560, pt: 1 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
              <SortableContext items={site.nav.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                {site.nav.map((item) => (
                  <SortableNavRow key={item.id} item={item} onDelete={() => removeNavItem(item.id)} />
                ))}
              </SortableContext>
            </DndContext>
            {site.nav.length === 0 && (
              <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
                ნავიგაციის ელემენტები ჯერ არ არის.
              </Typography>
            )}
            <Button
              sx={{ mt: 1 }}
              variant="outlined"
              onClick={() => notify('გვერდის დამატება — მალე', { type: 'info' })}
            >
              + გვერდის დამატება
            </Button>
          </Box>
        )}

        {/* ── Theme ─────────────────────────────────────────────────────────── */}
        {tab === 2 && (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              თემის რედაქტორი — მხოლოდ ნახვა (Phase 2.3). ტოკენები platform catalog-იდან.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2, mt: 1 }}>
              {Object.entries(tokenGroups).map(([group, tokens]) => (
                <Paper key={group} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>{group}</Typography>
                    <Chip size="small" label={tokens.length} />
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tokens.map(({ key, preview }) => (
                      <Chip
                        key={key}
                        size="small"
                        variant="outlined"
                        label={`${key.split('.').pop()}: ${preview}`}
                        sx={{ fontFamily: 'monospace', fontSize: 11 }}
                      />
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={() => goToStep(0)}>← მონაცემები</Button>
        <Button variant="contained" onClick={() => { markStepDone(1); goToStep(2) }}>
          გაგრძელება → გვერდები
        </Button>
      </Box>
    </Box>
  )
}
