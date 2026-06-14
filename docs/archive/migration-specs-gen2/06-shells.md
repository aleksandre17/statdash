# Migration — Shell Patterns + registerSlice

> Canonical shell implementations. Component wrapper pattern mandatory (hooks in inner component).

---

## registerSlice Hub

```ts
// engine/react/src/engine/registerSlice.ts
export function registerSlice(slice: RegistrableSlice): void {
  if (slice.META.sliceType === 'node') {
    const { type, variant = 'default' } = slice.META
    nodeRegistry.register(type, variant, slice.Shell as NodeRenderer, {
      label: slice.META.label, icon: slice.META.icon,
      category: slice.META.category, schema: slice.META.schema, preview: slice.META.preview,
    })
    if ((slice as NodeSlice).Skeleton)
      skeletonRegistry.register(type, variant, (slice as NodeSlice).Skeleton!)
    // i18n: load META.i18n into i18next per locale
    if (slice.META.i18n) {
      Object.entries(slice.META.i18n).forEach(([locale, translations]) =>
        i18next.addResourceBundle(locale, type, translations))
    }
  } else if (slice.META.sliceType === 'chrome') {
    chromeRegistry.register(slice.META.slot, slice.META.key, slice.Shell as () => ReactNode, {
      label: slice.META.label, preview: slice.META.preview,
    })
  } else if (slice.META.sliceType === 'control') {
    filterControlRegistry.register(slice as FilterControlSlice)
  }
}
```

---

## SectionShell — role toggle, i18n

```tsx
// plugins/nodes/section/SectionShell.tsx
export const SectionShell: NodeRenderer<SectionNode> =
  (def, ctx, children) => <SectionControl def={def} ctx={ctx} children={children} />

function SectionControl({ def, ctx, children }: { def: SectionNode; ctx: RenderContext; children: ChildrenArg }) {
  const t = useResolveLocale()
  const roles = [...new Set(children.defs.map(d => d.layout?.role).filter((r): r is string => !!r))]
  const [activeRole, setActiveRole] = useState<string | undefined>(roles[0])

  return (
    <section className="section" id={def.id}>
      <h2>{t(def.title)}</h2>
      {/* role toggle buttons */}
      {children.defs.map((d, i) => {
        const visible = !d.layout?.role || d.layout.role === activeRole
        return (
          <div key={i} className={`section-view${visible ? ' section-view--visible' : ' section-view--hidden'}`}>
            {children.rendered[i]}
          </div>
        )
      })}
    </section>
  )
}
// all children rendered — CSS controls visibility — no remount on toggle ✅
```

---

## ChartShell — 2-arg interpretChart

```tsx
// plugins/nodes/chart/ChartShell.tsx
// ❌ DEPRECATED: interpretChart(chartDef, ctx.rows, ctx.sectionCtx) — ctx.sectionCtx removed
// ✅ CANONICAL: interpretChart(chartDef, ctx.rows) — rows already resolved by engine step 3

export const ChartShell: NodeRenderer<ChartNode> =
  (def, ctx, _children) => {
    const fmt     = useFmt()
    const t       = useResolveLocale()
    const chartDef = { ...def, type: def.chartType,
                       xLabel: def.xLabel ? t(def.xLabel) : undefined,
                       yLabel: def.yLabel ? t(def.yLabel) : undefined }
    const output  = interpretChart(chartDef, ctx.rows)
    const options = toApexOptions(output)
    const h       = typeof ctx.view?.height === 'number' ? ctx.view.height : 320
    return <ReactApexChart type={options.chart?.type ?? 'line'} series={options.series} options={options} height={h} />
  }
```

---

## InnerPageShell — ZERO chrome import

```tsx
// plugins/nodes/inner-page/InnerPageShell.tsx
export const InnerPageShell: NodeRenderer<InnerPageNode> =
  (_def, _ctx, children) => <main className="page-content">{children.rendered}</main>
// Chrome = route-level (PageLoader wraps). InnerPageShell = pure content.
```

---

## TabPageShell — lazy renderChild

```tsx
export const TabPageShell: NodeRenderer<TabPageNode> =
  (def, _ctx, children) => <TabControl def={def} children={children} />

function TabControl({ def, children }: { def: TabPageNode; children: ChildrenArg }) {
  const t = useResolveLocale()
  const [activeTab, setActiveTab] = useState(def.defaultTab ?? 0)
  return (
    <div className="tab-page">
      <div className="tab-bar" role="tablist">
        {children.defs.map((d, i) => (
          <button key={i} role="tab" aria-selected={i === activeTab} onClick={() => setActiveTab(i)}>
            {d.layout?.label ? t(d.layout.label as LocaleString) : String(i + 1)}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children.renderChild(activeTab)}</div>
    </div>
  )
}
// lazy: only active tab renders — no hidden DOM, no wasted fetch ✅
```

---

## FilterBarShell — display-only, reads FilterProvider

```tsx
// ❌ DEPRECATED: FilterBarShell owned filter state
// const { bars } = useFilters({ bars: def.bars, ... })
// → separate context → disconnected from ctx.dims → sections see stale dims ❌

// ✅ CANONICAL: reads from page-level FilterProvider (set by SiteRenderer)
export const FilterBarShell: NodeRenderer<FilterBarNode> =
  (def, _ctx, _children) => <FilterBarControl barIds={def.barIds} />

function FilterBarControl({ barIds }: { barIds?: string[] }) {
  const { bars } = useFilters()   // no args — reads from FilterProvider
  const visible  = barIds ? bars.filter(b => barIds.includes(b.barId)) : bars
  return (
    <div className="filter-bar-host">
      {visible.map(bar => (
        <div key={bar.barId} className={`filter-bar filter-bar--${bar.position}`}>
          {bar.filters.map(filter => {
            const slice = filterControlRegistry.get(filter.paramDef.type)
            if (!slice) return null
            return <slice.Shell key={filter.key} filterKey={filter.key} config={filter.paramDef} />
          })}
        </div>
      ))}
    </div>
  )
}
// Zero import of YearSelectShell. Pure registry dispatch. ✅
// Replaceable: nodeRegistry.register('filter-bar', 'compact', CompactShell) ✅
```

---

## FullHeader — () => ReactNode, ZERO PROPS

```tsx
// plugins/chrome/AppHeader/default/FullHeader.tsx
export function FullHeader(): ReactNode {
  const nav = useSiteNav()
  const t   = useResolveLocale()
  return (
    <header className="app-header" role="banner">
      {nav.filter(n => !n.hidden).map(item => (
        <NavLink key={item.path} to={item.path}>{t(item.label)}</NavLink>
      ))}
    </header>
  )
}
// ZERO PROPS — chromeRegistry.get(slot, key)() has no args. Passing props → crash.
```

---

## YearSelectShell — self-contained (ISP clean)

```tsx
// plugins/controls/year-select/YearSelectShell.tsx
export function YearSelectShell({ filterKey, config }: { filterKey: string; config: YearSelectDef }) {
  const { value, set } = useFilter<number>(filterKey)
  const years = config.range
    ? Array.from({ length: config.range[1] - config.range[0] + 1 }, (_, i) => config.range![0] + i)
    : []
  return (
    <select value={value ?? ''} onChange={e => set(parseInt(e.target.value, 10))}>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
// Engine does NOT pre-resolve paramOptions. Shell is self-contained. ISP clean. ✅
```