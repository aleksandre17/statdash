import type { ReactNode, CSSProperties } from 'react'
import type { NodeRenderer }  from '@geostat/react/engine'
import type { RowNode }       from './RowNode'

export const RowShell: NodeRenderer<RowNode> = (def, _ctx, children) => {
  const visibleItems = children.rendered.filter(Boolean) as ReactNode[]
  if (visibleItems.length === 0) return null

  const cols = def.view?.cols
  const gridCols =
    cols == null ? `repeat(${visibleItems.length}, 1fr)` :
    typeof cols === 'number' ? `repeat(${cols}, 1fr)` : cols

  if (visibleItems.length === 1 && cols == null) return visibleItems[0]

  return (
    <div className="panel-row" style={{ '--panel-cols': gridCols } as CSSProperties}>
      {visibleItems}
    </div>
  )
}