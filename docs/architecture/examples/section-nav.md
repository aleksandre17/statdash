# section-nav.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — SectionNav: in-page TOC + IntersectionObserver scrollspy
 *
 * Platform model: ONS "Contents" sidebar · Wikipedia TOC · MDN outline.
 * Framework-level: agnostic to sidebar implementation.
 * Opt-in: node.navLabel + node.id → appears in TOC.
 * Chrome reads useSectionNav() — zero coupling to page config.
 */

import type {
  NodeDef, SectionNavEntry, SectionNavCtxValue,
  InnerPageNode,
} from '@geostat/react'
import { useSectionNav, useSiteNav } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Opt-in: navLabel + id on section nodes
// ═══════════════════════════════════════════════════════════════════════════
//
// Rule: navLabel present AND id present → node registered in TOC.
// Either missing → node excluded (filter-bar, kpi-strip, links always excluded).

export const ACCOUNTS_PAGE: InnerPageNode = {
  type:     'inner-page',
  id:       'accounts',
  title:    'ინსტიტუციური სექტორის ანგარიშები',
  storeKey: 'accounts',

  children: [
    // filter-bar: no navLabel → excluded from TOC ✅
    {
      type:   'filter-bar',
      layout: { position: 'sticky-top', order: 1 },
      bars:   { main: { position: 'sticky', order: 1, filters: {
        time: { type: 'year-select', years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }, defaultValue: { from: 'options', pick: 'last' } },
        account: { type: 'chip-select', options: { type: 'inline', items: { $d: 'account' }, valueField: 'code', labelField: 'label' }, defaultValue: 'S1' },
      }}},
    },

    // kpi-strip: no navLabel → excluded from TOC ✅
    {
      type:   'kpi-strip',
      layout: { position: 'flow', order: 2, span: 'full' },
      data:   { type: 'row-list', indicators: ['B1G', 'D1', 'B8G'], dims: { time: { $ctx: 'time' } } },
    },

    // Section 1: navLabel + id → TOC entry "წარმოების ანგარიში"
    {
      type:     'section',
      id:       'production-account',
      navLabel: 'წარმოების ანგარიში',        // ← TOC entry
      layout:   { position: 'flow', order: 3, span: 'full' },
      data:     { type: 'query', indicator: 'B1G', dims: { time: { $ctx: 'time' }, account: { $ctx: 'account' } } },
      view:     { exportable: true },
      children: [
        { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },
        { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
      ],
    },

    // Section 2: navLabel + id → TOC entry "შემოსავლის განაწილება"
    {
      type:     'section',
      id:       'income-distribution',
      navLabel: 'შემოსავლის განაწილება',    // ← TOC entry
      layout:   { position: 'flow', order: 4, span: 'full' },
      data:     { type: 'query', indicator: 'D1', dims: { time: { $ctx: 'time' }, account: { $ctx: 'account' } } },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },

    // Section 3: navLabel + id → TOC entry "კაპიტალის ანგარიში"
    {
      type:     'section',
      id:       'capital-account',
      navLabel: 'კაპიტალის ანგარიში',       // ← TOC entry
      layout:   { position: 'flow', order: 5, span: 'full' },
      data:     { type: 'query', indicator: 'B8G', dims: { time: { $ctx: 'time' }, account: { $ctx: 'account' } } },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },

    // links: no navLabel → excluded from TOC ✅
    {
      type:   'links',
      layout: { position: 'flow', order: 6 },
      title: 'მეთოდოლოგია',
      items: [{ label: 'ეროვნული ანგარიშების SNA 2008', href: '/docs/sna2008.pdf', icon: 'file-text' }],
    },
  ],
} as InnerPageNode
// TOC entries built by SectionNavProvider from DOM: [
//   { id: 'production-account',  label: 'წარმოების ანგარიში',     depth: 0, order: 0 },
//   { id: 'income-distribution', label: 'შემოსავლის განაწილება', depth: 0, order: 1 },
//   { id: 'capital-account',     label: 'კაპიტალის ანგარიში',    depth: 0, order: 2 },
// ]


// ═══════════════════════════════════════════════════════════════════════════
// Chrome sidebar — reads useSectionNav() (zero coupling to page config)
// ═══════════════════════════════════════════════════════════════════════════

function AppSidebarShell() {
  const nav                         = useSiteNav()      // top-level nav items (pages)
  const { entries, activeId, scrollTo } = useSectionNav()   // in-page TOC

  return (
    <aside className="app-sidebar" aria-label="ნავიგაცია">

      {/* Top-level page navigation */}
      <nav className="sidebar-nav" aria-label="გვერდები">
        {nav.filter(n => !n.hidden).map(item => (
          <a key={item.path} href={item.path} className="sidebar-nav__link">
            {item.label}
          </a>
        ))}
      </nav>

      {/* In-page TOC — only when entries exist */}
      {entries.length > 0 && (
        <nav className="sidebar-toc" aria-label="გვერდის შინაარსი">
          <p className="sidebar-toc__heading">შინაარსი</p>
          {entries.map(entry => (
            <button
              key={entry.id}
              className={[
                'sidebar-toc__entry',
                `sidebar-toc__entry--depth-${entry.depth}`,
                entry.id === activeId ? 'sidebar-toc__entry--active' : '',
              ].join(' ')}
              onClick={() => scrollTo(entry.id)}
              aria-current={entry.id === activeId ? 'location' : undefined}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      )}

    </aside>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// SectionNavProvider — placed in SiteRenderer (engine/react/)
// ═══════════════════════════════════════════════════════════════════════════
//
// SiteRenderer always wraps content with SectionNavProvider.
// entries=[] when no nodes have navLabel → TOC section hidden in sidebar.
// No conditional SectionNavProvider — always present, graceful empty state. ✅

function SectionNavProviderUsage() {
  // SiteRenderer (engine/react/src/engine/SiteRenderer.tsx):
  return (
    <SectionNavProvider stickyOffset={useStickyOffset()}>
      {/* engine.renderNode(page, ctx) */}
    </SectionNavProvider>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Engine step — sets data attributes (renderNode.ts)
// ═══════════════════════════════════════════════════════════════════════════
//
// Engine renders node with navLabel + id → wraps in div with data attributes:
//
// function renderNode(node, ctx) {
//   const content = shell(node, ctx, children)
//   if (node.navLabel && node.id) {
//     return (
//       <div
//         id={node.id}
//         data-section-id={node.id}
//         data-section-label={node.navLabel}
//         data-section-depth={String(ctx.depth ?? 0)}
//       >
//         {content}
//       </div>
//     )
//   }
//   return content
// }
//
// SectionNavProvider runs IntersectionObserver on [data-section-id] elements.
// No shell changes needed. Engine owns the data-attribute bridge.


// ═══════════════════════════════════════════════════════════════════════════
// stickyOffset — CSS token bridge (FilterBarShell → SectionNavProvider)
// ═══════════════════════════════════════════════════════════════════════════
//
// FilterBarShell measures its own height and writes --sticky-height:
//
// function FilterBarShell({ def, bars }) {
//   const ref = useRef<HTMLDivElement>(null)
//   useEffect(() => {
//     if (!ref.current) return
//     const height = ref.current.offsetHeight
//     document.documentElement.style.setProperty('--sticky-height', `${height}px`)
//   })
//   return <div ref={ref} className="filter-bar">{...}</div>
// }
//
// SectionNavProvider reads --sticky-height for IntersectionObserver rootMargin:
//
// function useStickyOffset() {
//   const raw = getComputedStyle(document.documentElement).getPropertyValue('--sticky-height')
//   return parseInt(raw) || 0
// }
// → rootMargin: `-${stickyOffset}px 0px -60% 0px`
// → section counts as "active" only when its top is below the sticky bar ✅


// ═══════════════════════════════════════════════════════════════════════════
// Depth — nested TOC (publication-style with sub-sections)
// ═══════════════════════════════════════════════════════════════════════════

export const DEEP_PAGE: InnerPageNode = {
  type:     'inner-page',
  id:       'methodology',
  title:    'მეთოდოლოგია',
  children: [
    // Depth 0 — top-level chapter
    {
      type:     'section',
      id:       'chapter-1',
      navLabel: '1. ზოგადი ჩარჩო',
      layout:   { position: 'flow', order: 1 },
      children: [
        // Depth 1 — sub-section (nested inside chapter)
        {
          type:     'section',
          id:       'chapter-1-1',
          navLabel: '1.1. ეროვნული ანგარიშები',
          layout:   { position: 'flow', order: 1 },
          children: [{ type: 'chart', layout: { role: 'chart' } }],
        },
        {
          type:     'section',
          id:       'chapter-1-2',
          navLabel: '1.2. SDMX სტანდარტი',
          layout:   { position: 'flow', order: 2 },
          children: [{ type: 'table', layout: { role: 'table' } }],
        },
      ],
    },
    {
      type:     'section',
      id:       'chapter-2',
      navLabel: '2. კლასიფიკაციები',
      layout:   { position: 'flow', order: 2 },
      children: [{ type: 'table', layout: { role: 'table' } }],
    },
  ],
} as InnerPageNode
// TOC entries (depth from ctx.depth engine tracks):
//   { id:'chapter-1',   label:'1. ზოგადი ჩარჩო',          depth:0 }
//   { id:'chapter-1-1', label:'1.1. ეროვნული ანგარიშები', depth:1 }
//   { id:'chapter-1-2', label:'1.2. SDMX სტანდარტი',      depth:1 }
//   { id:'chapter-2',   label:'2. კლასიფიკაციები',         depth:0 }
// Sidebar renders depth-1 entries as indented ← CSS only (sidebar-toc__entry--depth-1)


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ Passing sections list to sidebar as prop:
//    <AppSidebar sections={[{ id:'s1', label:'...' }]} />
// ✅ useSectionNav() — sidebar reads context, zero coupling to page config

// ❌ Shell managing its own IntersectionObserver:
//    function SectionShell() { useEffect(() => new IntersectionObserver(...) }
// ✅ SectionNavProvider owns single IntersectionObserver for all sections

// ❌ navLabel on every node:
//    { type: 'kpi-strip', navLabel: 'KPI ბლოკი' }
// ✅ Opt-in only. KPI strips, filter bars, links — always excluded (no navLabel)

// ❌ navLabel without id:
//    { type: 'section', navLabel: 'ეს სექცია' }  // id absent → no anchor
// ✅ Engine requires both: navLabel + id. Missing id → navLabel silently ignored.

declare const React: { createElement: Function }
declare function SectionNavProvider(props: { stickyOffset: number; children: unknown }): unknown
declare function useStickyOffset(): number
```
