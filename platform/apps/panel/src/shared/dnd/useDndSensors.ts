import { PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

// Minimum drag distance to distinguish click from drag (12px avoids accidental drags).
const ACTIVATION_CONSTRAINT = { distance: 12 } as const

/**
 * Shared sensor set for every wizard step's DndContext.
 * Pointer + keyboard sensors — meets WCAG 2.1 AA (keyboard-accessible D&D).
 * Each step owns its own DndContext (self-contained drag logic) but reuses these
 * sensors so keyboard reordering works identically everywhere.
 */
export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION_CONSTRAINT }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}
