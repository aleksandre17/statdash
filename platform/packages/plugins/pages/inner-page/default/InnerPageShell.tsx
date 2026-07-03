import './page-layout.css'
import type { NodeRenderer, RenderContext, ChildrenArg } from '@statdash/react/engine'
import type { InnerPageNode }                            from './InnerPageNode'
import { ChromeSlot, NodeStatusProvider, useNodeStatusScope } from '@statdash/react/engine'
import { AnchorNavProvider }                             from '@statdash/react/context/AnchorNavContext'

export const InnerPageShell: NodeRenderer<InnerPageNode> = (def, ctx, children) =>
  <InnerPageControl def={def} ctx={ctx} children={children} />

function InnerPageControl({ def, ctx, children }: {
  def:      InnerPageNode
  ctx:      RenderContext
  children: ChildrenArg
}) {
  const nav = ctx.navContext

  // ── AR-40 — the page is the data-integrity scope owner ─────────────────────
  //  The inner-page is the common ancestor of BOTH the page header and every
  //  section/panel below it, so it is the correct information-expert to own the
  //  page-wide preliminary fold. Child panels PUBLISH their status up here; the
  //  page header SUBSCRIBES to the aggregate (useNodeStatusAggregate) and renders
  //  the ONE consolidated indicator. The page never reads a child's rows — only a
  //  reported status — so the structure/data boundary stays intact.
  const { collector, aggregate } = useNodeStatusScope()

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
          {/* Scope wraps the whole page body: panels (in sections) report up, the
              page header (a sibling child) subscribes to the same fold. */}
          <NodeStatusProvider collector={collector} aggregate={aggregate}>
            <div className="layout-stack page-content__stack" data-dir="column">
              {children.rendered}
            </div>
          </NodeStatusProvider>
        </main>
      </div>
    </AnchorNavProvider>
  )
}