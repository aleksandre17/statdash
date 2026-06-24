import type { NodeRenderer } from '@statdash/react/engine'
import type { DividerNode }  from './DividerNode'

export const DividerShell: NodeRenderer<DividerNode> =
  (def, _ctx, _children) => (
    <hr
      className="layout-divider"
      data-divider-style={def.variant ?? 'solid'}
      aria-hidden="true"
    />
  )