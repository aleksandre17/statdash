import { defineShell, WrapStyleContext } from '@statdash/react/engine'
import type { WrapNode }                 from './WrapNode'

// Transparent layout node — no DOM output of its own.
// Provides WrapStyleContext so every descendant shell picks up def.styles
// as a base that child view.styles merge on top of (child always wins).

export const WrapShell = defineShell<WrapNode>({
  render({ def, children }) {
    return (
      <WrapStyleContext.Provider value={def.styles ?? null}>
        <>{children.rendered}</>
      </WrapStyleContext.Provider>
    )
  },
})