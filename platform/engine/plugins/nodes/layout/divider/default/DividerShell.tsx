import type { NodeRenderer } from '@geostat/react/engine'
import type { DividerNode }  from './DividerNode'

export const DividerShell: NodeRenderer<DividerNode> =
  (def, _ctx, _children) => (
    <hr
      className={`layout-divider layout-divider--${def.variant ?? 'solid'}`}
      aria-hidden="true"
    />
  )