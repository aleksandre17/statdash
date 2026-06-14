import { createContext, useContext } from 'react'
import type { NodeStyles }          from '@geostat/styles'

// Distributes NodeStyles from a WrapNode down to all descendant shells.
// defineShell reads this and merges it as the base under the child's own view.styles.
// Child styles always win (override), wrap styles are the floor.

const WrapStyleCtx = createContext<NodeStyles | null>(null)

export const WrapStyleContext = WrapStyleCtx

export function useWrapStyle(): NodeStyles | null {
  return useContext(WrapStyleCtx)
}