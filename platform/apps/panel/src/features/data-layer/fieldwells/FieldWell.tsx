// ── FieldWell — one drop target for a field chip (V5 field-wells) ─────────────
//
//  A binding shelf (Looker/Tableau "well"): a chip dropped here binds its field
//  to the well's config target. The well is a dnd-kit DROPPABLE and, when a chip
//  is armed via the palette's pick path, a clickable BUTTON (the keyboard/click
//  equivalent of the drop). It shows the currently-bound field as a removable
//  chip — clear what's bound (POLA), with a keyboard-operable clear.
//
import { Box, Chip, Typography } from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import { useDroppable } from '@dnd-kit/core'
import type { WellId } from './binding'
import type { WellDropData } from './dragData'

export interface FieldWellProps {
  well:     WellId
  label:    string
  required?: boolean
  /** The field code currently bound to this well (shown as a chip), or null. */
  bound:    string | null
  /**
   * True when an armed chip from the palette is a valid drop here (the
   * pick→click path). Enables the click-to-bind affordance + highlights the
   * well. False when no chip is armed or the armed chip's kind is rejected.
   */
  armedValid: boolean
  /** Click-to-bind: bind the currently armed chip (keyboard/click equivalent). */
  onBindArmed: () => void
  /** Remove the bound field from this well. */
  onClear:  () => void
}

export function FieldWell({
  well, label, required, bound, armedValid, onBindArmed, onClear,
}: FieldWellProps) {
  const data: WellDropData = { kind: 'field-well', well }
  const { isOver, setNodeRef } = useDroppable({ id: `well:${well}`, data })

  const highlight = isOver || armedValid

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1, alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
        {required && <Box component="span" sx={{ color: 'error.main' }}> *</Box>}
      </Typography>

      <Box
        ref={setNodeRef}
        // The well is a button only when an armed chip can bind here — so the
        // keyboard/click path is a true equivalent of dropping (WCAG 2.1 AA).
        role={armedValid ? 'button' : undefined}
        tabIndex={armedValid ? 0 : undefined}
        aria-label={armedValid ? `მიამაგრე არჩეული ველი: ${label}` : undefined}
        onClick={armedValid ? onBindArmed : undefined}
        onKeyDown={
          armedValid
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBindArmed() } }
            : undefined
        }
        sx={{
          minHeight: 36, px: 1, py: 0.5, borderRadius: 1,
          display: 'flex', alignItems: 'center', gap: 1,
          border: '1px dashed',
          borderColor: highlight ? 'primary.main' : 'divider',
          bgcolor: highlight ? 'action.hover' : 'background.default',
          cursor: armedValid ? 'pointer' : 'default',
          transition: 'border-color 120ms, background-color 120ms',
        }}
      >
        {bound ? (
          <Chip
            size="small"
            label={bound}
            onDelete={onClear}
            // The delete (×) is keyboard-focusable via MUI; an explicit aria-label
            // names the clear action for screen readers.
            aria-label={`${label}: ${bound} — წაშლა`}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
            <AddCircleOutlineIcon fontSize="small" />
            <Typography variant="caption">
              {armedValid ? 'დააჭირეთ მისამაგრებლად' : 'გადმოათრიეთ ველი'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
