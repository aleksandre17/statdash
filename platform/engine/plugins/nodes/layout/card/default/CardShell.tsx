import type { NodeRenderer } from '@geostat/react/engine'
import type { CardNode }     from './CardNode'

export const CardShell: NodeRenderer<CardNode> =
  (_def, _ctx, children) => (
    <div className="layout-card">
      {children.rendered}
    </div>
  )