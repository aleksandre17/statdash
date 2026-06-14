# Section Nav — In-Page TOC + Scrollspy

> Framework-level in-page table of contents with IntersectionObserver-based
> active section tracking. Pattern: ONS "Contents" sidebar.
> Agnostic to chrome implementation — sidebar reads via hook.

---

## Platform comparison

| Platform | Pattern | Mechanism |
|----------|---------|-----------|
| ONS | "Contents" sidebar, sticky, active highlight | Scroll position tracking |
| Eurostat | Publication TOC, left sidebar | Page anchor links |
| Wikipedia | Floating TOC, highlights on scroll | IntersectionObserver |
| Notion | Page outline, right sidebar | IntersectionObserver |
| MDN Web Docs | Right sidebar outline | IntersectionObserver |
| Grafana | No in-page nav (grid layout, no scroll) | N/A |

**Rule:** statistical publications need in-page nav. Dashboards don't (grid = all visible). Our pages are publications — ONS/Eurostat model applies.

---

## Design

### Opt-in via NodeBase

```ts
interface NodeBase {
  // ... existing fields ...
  navLabel?: string   // opt-in to TOC: present + node.id present → TOC entry
}
```

Two conditions for a node to appear in the TOC:
1. `node.navLabel` is set (the display text)
2. `node.id` is set (the anchor / IntersectionObserver target)

If either is missing → node is invisible to SectionNav.

**Why opt-in rather than automatic:** Not every section needs to appear in the TOC. KPI strips, filter bars, decorative sections — excluded by default. Statistician picks which sections are navigable.

### Engine responsibility

At renderNode step for any node with `navLabel + id`:
```ts
// Engine adds data attribute to root DOM element of that node:
// <div data-section-id={node.id} ...>
// SectionNavProvider queries [data-section-id] for IntersectionObserver targets.
```

Engine does NOT build the SectionNavEntry list manually — it delegates to SectionNavProvider which scans the DOM after mount.

### SectionNavProvider (engine/react/)

```ts
// engine/react/src/context/SectionNavContext.tsx

function SectionNavProvider({ stickyOffset = 0, children }) {
  const [entries,  setEntries]  = useState<SectionNavEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Rebuild entries from DOM on every render (sections may mount/unmount)
  useEffect(() => {
    const elements = document.querySelectorAll('[data-section-id]')
    setEntries(Array.from(elements).map((el, order) => ({
      id:    el.getAttribute('data-section-id')!,
      label: el.getAttribute('data-section-label')!,
      depth: Number(el.getAttribute('data-section-depth') ?? 0),
      order,
    })))
  }, [children])  // re-scan when page content changes

  // IntersectionObserver tracks which section is most visible
  useEffect(() => {
    const targets = document.querySelectorAll('[data-section-id]')
    if (!targets.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find topmost intersecting entry (closest to sticky bar bottom)
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.getAttribute('data-section-id'))
      },
      { rootMargin: `-${stickyOffset}px 0px -60% 0px`, threshold: 0 }
      // rootMargin top = sticky bar height → section counts as "active" when below sticky bar
      // rootMargin bottom = -60% → section must be in top 40% of viewport to be "active"
    )

    targets.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [entries, stickyOffset])

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset - 8
    window.scrollTo({ top, behavior: 'smooth' })
  }, [stickyOffset])

  return (
    <SectionNavContext.Provider value={{ entries, activeId, scrollTo }}>
      {children}
    </SectionNavContext.Provider>
  )
}
```

### useSectionNav hook

```ts
// engine/react/src/context/SectionNavContext.tsx
export function useSectionNav(): SectionNavCtxValue {
  const ctx = useContext(SectionNavContext)
  if (!ctx) throw new Error('useSectionNav must be used inside SectionNavProvider')
  return ctx
}
```

### Chrome reads the hook — zero coupling

```tsx
// plugins/chrome/AppSidebar/default/AppSidebarShell.tsx
function AppSidebarShell() {
  const nav              = useSiteNav()        // top-level nav (pages)
  const { entries, activeId, scrollTo } = useSectionNav()  // in-page sections

  return (
    <aside className="app-sidebar">
      {/* Top-level nav links */}
      <nav>{nav.map(item => <NavLink key={item.path} to={item.path}>{item.label}</NavLink>)}</nav>

      {/* In-page TOC — only shown when sections exist */}
      {entries.length > 0 && (
        <div className="sidebar-toc">
          {entries.map(entry => (
            <button
              key={entry.id}
              className={`toc-entry toc-entry--depth-${entry.depth} ${entry.id === activeId ? 'toc-entry--active' : ''}`}
              onClick={() => scrollTo(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
```

---

## SectionNavProvider placement

```tsx
// SiteRenderer (engine/react/) — wraps all page content:
function SiteRenderer({ page, ctx }) {
  const stickyOffset = useStickyOffset()  // reads CSS --sticky-height token

  return (
    <SectionNavProvider stickyOffset={stickyOffset}>
      {engine.renderNode(page, ctx)}
    </SectionNavProvider>
  )
}
```

`SiteRenderer` always wraps with `SectionNavProvider`. If no nodes have `navLabel`, `entries = []` → chrome sidebar shows no TOC (graceful empty state). ✅

---

## stickyOffset — CSS token bridge

The IntersectionObserver rootMargin top must match the sticky filter bar height to avoid sections being counted as "active" before they're actually visible.

```ts
// engine/react/src/context/SectionNavContext.tsx
function useStickyOffset(): number {
  // Reads CSS custom property set by filter bar shell:
  // FilterBarShell sets: document.documentElement.style.setProperty('--sticky-height', `${height}px`)
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--sticky-height')
  return parseInt(raw) || 0
}
```

FilterBarShell measures its own height after render and writes `--sticky-height`. SectionNavProvider reads it. Zero prop-drilling — CSS custom property as a side-channel.

---

## Config example

```ts
// accounts.page.ts — opt-in sections appear in sidebar TOC
{
  type:     'inner-page',
  title:    'ინსტიტუციური სექტორის ანგარიშები',
  children: [
    { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 }, bars: {...} },
    { type: 'kpi-strip',  layout: { position: 'flow', order: 2, span: 'full' }, data: {...} },

    // navLabel → appears in sidebar TOC
    { type: 'section', id: 'sna-hero', navLabel: 'წარმოების ანგარიში',
      layout: { position: 'flow', order: 3, span: 'full' },
      data: {...}, children: [...] },

    { type: 'section', id: 'income', navLabel: 'შემოსავლის განაწილება',
      layout: { position: 'flow', order: 4, span: 'full' },
      data: {...}, children: [...] },

    // no navLabel → invisible to TOC (KPI strip, filter bar, etc.)
    { type: 'links', layout: { position: 'flow', order: 5 }, items: [...] },
  ],
}
// Sidebar TOC entries: ['წარმოების ანგარიში', 'შემოსავლის განაწილება']
// Filter bar, kpi-strip, links: excluded ✅
```

---

## Implementation checklist

```
engine/react/src/context/
  SectionNavContext.tsx    — SectionNavProvider + useSectionNav()

engine/react/src/engine/
  renderNode.ts            — set data-section-id + data-section-label on nodes with navLabel+id

plugins/chrome/AppSidebar/default/
  AppSidebarShell.tsx      — reads useSectionNav() for TOC rendering

plugins/nodes/filter-bar/
  FilterBarShell.tsx       — sets --sticky-height CSS custom property after render
```