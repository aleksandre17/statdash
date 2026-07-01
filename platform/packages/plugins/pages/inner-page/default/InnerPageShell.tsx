import './page-layout.css'
import type { NodeRenderer, RenderContext, ChildrenArg } from '@statdash/react/engine'
import type { InnerPageNode }                            from './InnerPageNode'
import { ChromeSlot }                                    from '@statdash/react/engine'
import { AnchorNavProvider }                             from '@statdash/react/context/AnchorNavContext'

export const InnerPageShell: NodeRenderer<InnerPageNode> = (def, ctx, children) =>
  <InnerPageControl def={def} ctx={ctx} children={children} />

function InnerPageControl({ def, ctx, children }: {
  def:      InnerPageNode
  ctx:      RenderContext
  children: ChildrenArg
}) {
  const nav = ctx.navContext
  return (
    <AnchorNavProvider sections={nav?.sections ?? []} perspectiveKey={nav?.perspectiveKey ?? 'mode'}>
      <div className="inner-page" data-layout={def.pageLayout ?? 'sidebar'}>
        <ChromeSlot slot="InnerSidebar" />
        {/* The page BODY composes through the `stack` layout-node primitive — the
            SAME container StackShell emits (data-dir=column, --layout-gap) — not a
            bespoke flex div. `.page-content` is now only the viewport CHROME box
            (measure cap, side gutter, margin); section/child arrangement is the
            stack. One handwriting at page, section, and panel
            (DESIGN-responsive-composition §3.3 / FF-NO-BESPOKE-SECTION-DIV). */}
        <main className="page-content">
          <div className="layout-stack page-content__stack" data-dir="column">
            {children.rendered}
          </div>
        </main>
      </div>
    </AnchorNavProvider>
  )
}