import { useState }                             from 'react'
import type { NodeBase, NodeRenderer, ChildrenArg } from '../../engine'
import { useResolveLocale }                     from '../../context/SiteContext'

// Structural type — packages/react must not import from plugins/
type TabPageLike = NodeBase & { defaultTab?: number }

export const DefaultTabPageShell: NodeRenderer<TabPageLike> = (def, _ctx, children) =>
  <DefaultTabPageControl def={def} children={children} />

// eslint-disable-next-line react-refresh/only-export-components
function DefaultTabPageControl({
  def,
  children,
}: {
  def:      TabPageLike
  children: ChildrenArg
}) {
  const [activeTab, setActiveTab] = useState(def.defaultTab ?? 0)
  // view.label is an i18n carrier (LocaleString) — resolve to the active locale.
  const resolveLocale = useResolveLocale()

  if (children.defs.length === 0) return null
  if (children.defs.length === 1) return <>{children.rendered[0]}</>

  return (
    <div className="tab-page">
      <div className="tab-page__nav" role="tablist">
        {children.defs.map((child, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === activeTab}
            className={`tab-page__btn${i === activeTab ? ' tab-page__btn--active' : ''}`}
            onClick={() => setActiveTab(i)}
            type="button"
          >
            {resolveLocale((child as NodeBase).view?.label ?? `Tab ${i + 1}`)}
          </button>
        ))}
      </div>
      <div className="tab-page__content" role="tabpanel">
        {children.renderChild(activeTab)}
      </div>
    </div>
  )
}