import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PagesSiteSurface } from './PagesSiteSurface'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../../store/constructor.store'
import type { CanvasController } from '../useCanvasController'
import type { NavItem, CanvasPage } from '../../types/constructor'

// The Studio Pages&Site surface — the site's authoring home: identity + navigation +
// page creation + the chrome COMPOSITION. Proves it mounts, writes the real site slice
// (updateSite / updateNavItem / removeNavItem), edits a nav entry (label + target), wires
// "+ add page" to the REAL page-create dialog, AND surfaces the whole-chrome-set editor
// directly (the labeled-entry twin of clicking a chrome region on the canvas).

const NAV: NavItem = { id: 'nav-1', label: { ka: 'მთავარი', en: 'Home' }, pageId: 'p-1', order: 0 }
const PAGE: CanvasPage = {
  id: 'p-2', type: 'inner-page', title: { ka: 'შესახებ', en: 'About' }, slug: 'about',
  nodeIds: [], nodes: {},
}

// The surface consumes only `controller.selectChrome` (the ChromeCompositionPanel "Open"
// action); a minimal stub is sufficient for the surface's own responsibilities.
const controller = { selectChrome: vi.fn() } as unknown as CanvasController
const renderSurface = () => render(<PagesSiteSurface controller={controller} locale="ka" />)

beforeAll(() => { setupCanvasRegistry() })

beforeEach(() => {
  useConstructorStore.getState().updateSite({ name: 'Seed Site', defaultLocale: 'en', nav: [NAV] })
  useConstructorStore.setState({ pages: [PAGE], selection: null })
})

describe('PagesSiteSurface — site authoring home (identity · nav · pages)', () => {
  it('mounts identity + navigation from the store', () => {
    renderSurface()
    expect(screen.getByText('იდენტობა')).toBeInTheDocument()
    expect(screen.getByText('ნავიგაცია')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Seed Site')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('editing the site name writes through updateSite', () => {
    renderSurface()
    fireEvent.change(screen.getByLabelText('საიტის სახელი'), { target: { value: 'Renamed' } })
    expect(useConstructorStore.getState().site.name).toBe('Renamed')
  })

  it('editing a nav entry label writes through updateNavItem', () => {
    renderSurface()
    // Progressive disclosure: the editor is hidden until the row's Edit is clicked.
    expect(screen.queryByLabelText('Label (en)')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Home' }))
    fireEvent.change(screen.getByLabelText('Label (en)'), { target: { value: 'Start' } })
    expect(useConstructorStore.getState().site.nav[0].label.en).toBe('Start')
    expect(useConstructorStore.getState().site.nav[0].label.ka).toBe('მთავარი') // untouched
  })

  it('re-targeting a nav entry to another page writes through updateNavItem', () => {
    renderSurface()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Home' }))
    // The target select lists real pages; pick the About page (id p-2).
    fireEvent.mouseDown(screen.getByLabelText('სამიზნე გვერდი'))
    fireEvent.click(within(screen.getByRole('listbox')).getByText('About'))
    expect(useConstructorStore.getState().site.nav[0].pageId).toBe('p-2')
  })

  it('deleting a nav item writes through removeNavItem', () => {
    renderSurface()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    expect(useConstructorStore.getState().site.nav).toHaveLength(0)
  })

  it('"+ add page" opens the real page-create dialog (not the wizard stub)', async () => {
    renderSurface()
    fireEvent.click(screen.getByRole('button', { name: '+ გვერდის დამატება' }))
    expect(await screen.findByRole('dialog', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /From template/ })).toBeInTheDocument()
  })

  // ── The chrome COMPOSITION is reachable DIRECTLY here (labeled-entry twin of canvas) ──
  //  The whole-chrome-set editor is a section of this surface, so the labeled top-bar
  //  "Site & chrome" entry (which opens this surface) reaches it in ONE step — not only
  //  via the circuitous select-a-region-then-Back path.
  it('surfaces the whole-chrome-set composition editor directly (registry-driven)', () => {
    renderSurface()
    const composition = screen.getByTestId('chrome-composition')
    expect(composition).toBeInTheDocument()
    // Registry-driven: every registered chrome slot has its own row here — a switched-OFF
    // region (not clickable on the canvas) is still enable-able from this panel.
    expect(within(composition).getByTestId('chrome-row-AppHeader')).toBeInTheDocument()
    expect(within(composition).getByTestId('chrome-row-AppFooter')).toBeInTheDocument()
    expect(within(composition).getByTestId('chrome-row-InnerSidebar')).toBeInTheDocument()
  })

  it('switching a chrome region variant writes site.chrome through setChromeVariant', () => {
    renderSurface()
    // The AppHeader row's variant select — swap to a different registered variant. The
    // row is keyed by slot (data-testid) so the target is unambiguous across locales.
    const headerRow = screen.getByTestId('chrome-row-AppHeader')
    fireEvent.mouseDown(within(headerRow).getByRole('combobox'))
    // 'transparent' is a registered AppHeader variant (chrome index barrel). Option LABELS
    // are localized (meta.label), so target the option by its stable `data-value`.
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const transparentOption = document.querySelector('li[data-value="transparent"]')!
    fireEvent.click(transparentOption)
    expect(useConstructorStore.getState().site.chrome.AppHeader?.variant).toBe('transparent')
  })
})
