// ── FieldPalette — the draggable field chip list (V5 field-wells) ─────────────
//
//  The Looker/Tableau "field list": every measure + dimension of the active
//  dataset as a CHIP the author drags into a binding well. Each chip is BOTH a
//  dnd-kit draggable AND a button (the keyboard/click equivalent of the drag,
//  WCAG 2.1 AA — a drag must never be the only way to bind). "Picking" a chip
//  (click / Enter / Space) arms it; clicking a well then binds it. The pointer
//  drag and this pick→click path funnel through the SAME pure binding write
//  (binding.ts), so they produce identical config.
//
//  Chips degrade gracefully: when no dataset is bound or its profile is
//  unavailable, the palette renders its empty state and the typed editors remain
//  the (advanced) authoring fallback — the binding surface is never required.
//
import { Box, Chip, Typography } from '@mui/material'
import FunctionsIcon from '@mui/icons-material/Functions'        // measure (Σ)
import CategoryIcon from '@mui/icons-material/Category'          // dimension
import { useDraggable } from '@dnd-kit/core'
import type { FieldChip } from './fieldChips'
import type { ChipDragData } from './dragData'

export interface FieldPaletteProps {
  chips: FieldChip[]
  /** The currently armed chip (pick→click path), or null. */
  pickedCode: string | null
  /** Toggle a chip's armed state (the keyboard/click equivalent of grabbing). */
  onPick: (chip: FieldChip) => void
}

export function FieldPalette({ chips, pickedCode, onPick }: FieldPaletteProps) {
  if (chips.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        ველები არ არის — დააკავშირეთ მონაცემთა წყარო (ან გამოიყენეთ ქვემოთ ჩაშენებული რედაქტორი)
      </Typography>
    )
  }

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        ველები — გადაათრიეთ ან აირჩიეთ
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {chips.map((chip) => (
          <DraggableChip
            key={`${chip.kind}:${chip.code}`}
            chip={chip}
            picked={pickedCode === chip.code}
            onPick={() => onPick(chip)}
          />
        ))}
      </Box>
    </Box>
  )
}

// ── DraggableChip — one chip: dnd-kit draggable + keyboard/click pick ──────────
function DraggableChip({
  chip, picked, onPick,
}: { chip: FieldChip; picked: boolean; onPick: () => void }) {
  const data: ChipDragData = { kind: 'field-chip', chip }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${chip.kind}:${chip.code}`,
    data,
  })

  const Icon = chip.kind === 'measure' ? FunctionsIcon : CategoryIcon

  // The chip is a button (clickable + focusable). dnd-kit's listeners add the
  // pointer/keyboard DRAG; onClick adds the explicit pick→click bind path. Both
  // converge on the same binding write, so the keyboard path is a true
  // equivalent of the drag (WCAG 2.1 AA).
  return (
    <Chip
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      icon={<Icon fontSize="small" />}
      label={chip.label}
      size="small"
      color={picked ? 'primary' : chip.kind === 'measure' ? 'success' : 'default'}
      variant={picked ? 'filled' : 'outlined'}
      onClick={onPick}
      aria-pressed={picked}
      aria-label={`${chip.label} — ${chip.kind === 'measure' ? 'მაჩვენებელი' : 'განზომილება'}${picked ? ' (არჩეული)' : ''}`}
      sx={{ cursor: 'grab', touchAction: 'none', opacity: isDragging ? 0.5 : 1 }}
    />
  )
}
