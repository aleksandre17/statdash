import type { NodeRenderer }       from '@statdash/react/engine'
import type { ContainerPageNode }  from './ContainerPageNode'

export const ContainerPageShell: NodeRenderer<ContainerPageNode> = (_def, _ctx, children) =>
  <div className="container-page">{children.rendered}</div>