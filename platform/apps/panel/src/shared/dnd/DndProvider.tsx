import { DndContext, type DndContextProps, closestCenter } from '@dnd-kit/core'
import { useDndSensors } from './useDndSensors'

interface DndProviderProps {
  children: React.ReactNode
  onDragEnd?: DndContextProps['onDragEnd']
}

/**
 * Optional platform-wide DndContext for single-context screens.
 * Sensors come from the shared useDndSensors hook (pointer + keyboard, WCAG 2.1 AA).
 *
 * Note: the Constructor wizard does NOT use this — each step owns its own
 * DndContext so its drag logic stays self-contained. Kept for any future
 * single-surface drag screen that wants one wrapper.
 */
export function DndProvider({ children, onDragEnd }: DndProviderProps) {
  const sensors = useDndSensors()

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  )
}
