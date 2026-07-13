import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { SITE_FRAME_ID, chromePartPath, PART_FIELD_ATTR } from '@statdash/react/engine'
import { CanvasView } from './CanvasView'
import { projectCanvasSiteChrome } from './canvasSiteChrome'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { SiteDef, CanvasPage } from '../types/constructor'
import type { NodePageConfig } from '@statdash/react/engine'

// ── FF-CANVAS-CHROME-FAITHFUL ────────────────────────────────────────────────
//
//  The live canvas mounts the REAL chrome shells; when the site declares nav, the
//  InnerSidebar rail must render THOSE links (WYSIWYG parity with the runner) — not
//  the hollow, zero-link default the owner saw as a "broken mystery left bar". This
//  fitness pins both halves of the seam:
//    1. projectCanvasSiteChrome maps the authoring session → the engine's site
//       context shapes (NavEntry[] with slug-derived paths, chrome pass-through).
//    2. Feeding those into CanvasView's SiteProvider POPULATES the rendered rail.
//
beforeAll(() => { setupCanvasRegistry() })

const page = {
  type: 'inner-page',
  id:   'page-gdp',
  path: 'gdp',
  children: [{ type: 'section', id: 'sec-1', title: 'GDP', children: [] }],
} as unknown as NodePageConfig

const siteWithNav: SiteDef = {
  name:               'Stat Site',
  defaultLocale:      'ka',
  activeLocales:      ['ka', 'en'],
  logo:               'https://cdn.example/logo.svg',
  nav: [
    { id: 'nav-gdp',    label: { ka: 'მშპ',       en: 'GDP Overview' },   pageId: 'page-gdp',    order: 0 },
    { id: 'nav-region', label: { ka: 'რეგიონები', en: 'Regional' },       pageId: 'page-region', order: 1 },
  ],
  themeOverrides:     {},
  dataSourceBindings: {},
  chrome:             { InnerSidebar: { variant: 'default', config: {} } },
}

const canvasPages: CanvasPage[] = [
  { id: 'page-gdp',    type: 'inner-page', title: { ka: 'მშპ', en: 'GDP' },  slug: 'gdp',    nodeIds: [], nodes: {} },
  { id: 'page-region', type: 'inner-page', title: { ka: 'რეგ', en: 'Reg' },  slug: 'region', nodeIds: [], nodes: {} },
]

describe('FF-CANVAS-CHROME-FAITHFUL — projector', () => {
  it('maps every NavItem to a NavEntry with a slug-derived path', () => {
    const { nav } = projectCanvasSiteChrome(siteWithNav, canvasPages)
    expect(nav).toHaveLength(2)
    expect(nav[0]).toMatchObject({ id: 'nav-gdp', label: { en: 'GDP Overview' }, path: '/gdp' })
    expect(nav[1]).toMatchObject({ id: 'nav-region', path: '/region' })
  })

  it('passes the chrome map through verbatim (SiteDef.chrome IS the engine ChromeEntry map)', () => {
    const { chrome } = projectCanvasSiteChrome(siteWithNav, canvasPages)
    expect(chrome.InnerSidebar).toEqual({ variant: 'default', config: {} })
  })

  it('builds a brand base only when a logo is authored (fail-soft otherwise)', () => {
    expect(projectCanvasSiteChrome(siteWithNav, canvasPages).chromeConfig).toMatchObject({
      logoUrl: 'https://cdn.example/logo.svg',
    })
    const noLogo = { ...siteWithNav, logo: undefined }
    expect(projectCanvasSiteChrome(noLogo, canvasPages).chromeConfig).toBeUndefined()
  })

  it('falls back to the pageId when the target page is not loaded (never an empty path)', () => {
    const { nav } = projectCanvasSiteChrome(siteWithNav, [])
    expect(nav[0].path).toBe('/page-gdp')
  })
})

describe('FF-CANVAS-CHROME-FAITHFUL — rendered rail', () => {
  it('renders the authored nav links in the canvas InnerSidebar (not a hollow default)', () => {
    const { nav, chrome, chromeConfig } = projectCanvasSiteChrome(siteWithNav, canvasPages)
    render(
      <CanvasView
        page={page}
        nav={nav}
        chrome={chrome}
        chromeConfig={chromeConfig}
        locale="en"
        onSelectNode={vi.fn()}
        onDropNode={vi.fn()}
      />,
    )
    // The rail (an <aside> complementary landmark) carries the REAL, authored links.
    const sidebar = document.querySelector('aside.inner-sidebar')
    expect(sidebar).not.toBeNull()
    expect(within(sidebar as HTMLElement).getByText('GDP Overview')).toBeInTheDocument()
    expect(within(sidebar as HTMLElement).getByText('Regional')).toBeInTheDocument()
  })

  it('the pre-fix state (empty nav) yields a hollow rail — the seam is what populates it', () => {
    render(<CanvasView page={page} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)
    const sidebar = document.querySelector('aside.inner-sidebar')
    expect(sidebar).not.toBeNull()
    // No authored links — this is exactly the "broken mystery left bar" the seam fixes.
    expect(screen.queryByText('GDP Overview')).toBeNull()
  })
})

// ── FF-CANVAS-APP-CHROME — the canvas paints the whole app SHELL, not just page content ──
//
//  The render-gap the owner hit: the canvas showed ONLY page content — no header / footer
//  around it — because CanvasView mounted <NodePageRenderer> WITHOUT the runner's AppChrome
//  orchestrator (which paints the top/bottom/… chrome regions). This pins the fix: the
//  canvas now wraps the page in AppChrome (the SAME component the runner's LocaleGuard
//  uses), so the app-shell chrome renders AROUND the page — AND is CANVAS-SELECTABLE
//  (ChromeRegion stamps the ONE part anchor), so the owner can click a header / footer to
//  author it, exactly like the InnerSidebar. Renders even with EMPTY site.chrome (resolve-
//  Chrome mounts every registered slot at its default variant — fail-soft).
describe('FF-CANVAS-APP-CHROME — the app shell renders + is selectable in the canvas', () => {
  const withOverlay = (props: Partial<React.ComponentProps<typeof CanvasView>> = {}) =>
    render(
      <CanvasView
        page={page}
        onSelectNode={vi.fn()}
        onDropNode={vi.fn()}
        onSelectItem={vi.fn()}
        {...props}
      />,
    )

  it('renders the app-shell chrome (AppChrome) around the page — header + footer regions', () => {
    withOverlay()
    // The runner's shell root (AppChrome) now wraps the page: the top region carries the
    // AppHeader, the bottom region the AppFooter. Present even with no authored site.chrome.
    expect(document.querySelector('.app-shell')).not.toBeNull()
    expect(document.querySelector('.chrome-region--top')).not.toBeNull()
    expect(document.querySelector('.chrome-region--bottom')).not.toBeNull()
  })

  it('stamps the ONE generic part anchor on app-chrome regions (ChromeRegion → selectable)', () => {
    withOverlay()
    // Header + footer carry the SAME `data-part-field` anchor the InnerSidebar does — the
    // overlay frames them through the ONE Part port. (Under the authoring canvas only.)
    expect(document.querySelector(`[${PART_FIELD_ATTR}="AppHeader"]`)).not.toBeNull()
    expect(document.querySelector(`[${PART_FIELD_ATTR}="AppFooter"]`)).not.toBeNull()
  })

  it('the overlay frames the header + footer as clickable chrome selections', () => {
    withOverlay()
    // The CanvasOverlay enumerates the site-frame's chrome parts and frames each RENDERED,
    // authorable region — header, footer AND the page-embedded sidebar.
    expect(document.querySelector('.canvas-chrome[data-chrome-slot="AppHeader"]')).not.toBeNull()
    expect(document.querySelector('.canvas-chrome[data-chrome-slot="AppFooter"]')).not.toBeNull()
    expect(document.querySelector('.canvas-chrome[data-chrome-slot="InnerSidebar"]')).not.toBeNull()
  })

  it('clicking the header frame selects the ONE PartAddress (site-frame + chrome.AppHeader)', () => {
    const onSelectItem = vi.fn()
    withOverlay({ onSelectItem })
    const headerFrame = document.querySelector('.canvas-chrome[data-chrome-slot="AppHeader"]')!
    fireEvent.click(headerFrame)
    // The chrome click funnels through the ONE part-select — no chrome-specific handler.
    expect(onSelectItem).toHaveBeenCalledWith(SITE_FRAME_ID, chromePartPath('AppHeader'))
  })
})
