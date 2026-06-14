import type { NodeBase, NodeRenderer } from '../../engine'

export const DefaultInnerPageShell: NodeRenderer<NodeBase> = (_def, _ctx, children) => (
  <main className="page-content">{children.rendered}</main>
)