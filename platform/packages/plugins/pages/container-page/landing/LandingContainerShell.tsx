import './landing.css'
import type { NodeRenderer }      from '@statdash/react/engine'
import type { ContainerPageNode } from '../default/ContainerPageNode'

export const LandingContainerShell: NodeRenderer<ContainerPageNode> = (_def, _ctx, children) =>
  <div className="landing-root">{children.rendered}</div>