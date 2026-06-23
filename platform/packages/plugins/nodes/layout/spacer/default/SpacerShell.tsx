import type { NodeRenderer } from '@statdash/react/engine'
import type { SpacerNode }   from './SpacerNode'

export const SpacerShell: NodeRenderer<SpacerNode> =
  (def, _ctx, _children) => (
    <div
      className="layout-spacer"
      style={{ height: def.size ?? 'var(--spacing-xl)' }}
      aria-hidden="true"
    />
  )