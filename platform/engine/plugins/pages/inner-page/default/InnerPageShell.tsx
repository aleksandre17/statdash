import './page-layout.css'
import type { NodeRenderer, RenderContext, ChildrenArg } from '@geostat/react/engine'
import type { InnerPageNode }                            from './InnerPageNode'
import { ChromeSlot }                                    from '@geostat/react/engine'
import { SectionNavProvider }                            from '@geostat/react/context/SectionNavContext'

export const InnerPageShell: NodeRenderer<InnerPageNode> = (def, ctx, children) =>
  <InnerPageControl def={def} ctx={ctx} children={children} />

function InnerPageControl({ def, ctx, children }: {
  def:      InnerPageNode
  ctx:      RenderContext
  children: ChildrenArg
}) {
  const nav = ctx.navContext
  return (
    <SectionNavProvider sections={nav?.sections ?? []} timeModeKey={nav?.timeModeKey ?? 'mode'}>
      <div className="inner-page" data-layout={def.pageLayout ?? 'sidebar'}>
        <ChromeSlot slot="InnerSidebar" />
        <main className="page-content">{children.rendered}</main>
      </div>
    </SectionNavProvider>
  )
}