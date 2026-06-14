import './tabs.css'
import { useState }                              from 'react'
import { useResolveLocale }                      from '@geostat/react'
import type { ChildrenArg, NodeRenderer, NodeDef, NodeBase } from '@geostat/react/engine'
import type { TabPageNode }                                  from './TabPageNode'
import type { LocaleString }                    from '@geostat/engine'

export const TabPageShell: NodeRenderer<TabPageNode> = (def, _ctx, children) =>
  <TabControl def={def} children={children} />

function TabControl({ def, children }: { def: TabPageNode; children: ChildrenArg }) {
  const t          = useResolveLocale()
  const [activeTab, setActiveTab] = useState(def.defaultTab ?? 0)

  return (
    <div className="tab-page">
      <div className="tab-bar" role="tablist">
        {children.defs.map((d: NodeDef, i: number) => {
          const viewLabel = (d as NodeBase).view?.label
          return (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeTab}
              className={`tab-btn${i === activeTab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(i)}
              type="button"
            >
              {viewLabel ? t(viewLabel as LocaleString) : String(i + 1)}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" className="tab-panel">
        {children.renderChild(activeTab)}
      </div>
    </div>
  )
}