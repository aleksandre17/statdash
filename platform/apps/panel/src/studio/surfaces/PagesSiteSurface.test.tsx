import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PagesSiteSurface } from './PagesSiteSurface'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { useConstructorStore, chromeSelectionOf } from '../../store/constructor.store'
import type { NavItem, CanvasPage } from '../../types/constructor'

// The Studio Pages&Site surface — the site's authoring home: identity + navigation
// + chrome. Proves it mounts, writes the real site slice (updateSite / updateNavItem
// / removeNavItem), edits a nav entry (label + target), wires "+ add page" to the
// REAL page-create dialog, and surfaces chrome authoring (ChromePalette → selectChrome).

const NAV: NavItem = { id: 'nav-1', label: { ka: 'მთავარი', en: 'Home' }, pageId: 'p-1', order: 0 }
const PAGE: CanvasPage = {
  id: 'p-2', type: 'inner-page', title: { ka: 'შესახებ', en: 'About' }, slug: 'about',
  nodeIds: [], nodes: {},
}

// Chrome slots come from the registry — populate it once so ChromePalette lists them.
beforeAll(() => { setupCanvasRegistry() })

beforeEach(() => {
  useConstructorStore.getState().updateSite({ name: 'Seed Site', defaultLocale: 'en', nav: [NAV] })
  useConstructorStore.setState({ pages: [PAGE], selection: null })
})

describe('PagesSiteSurface — site authoring home (identity · nav · chrome)', () => {
  it('mounts identity + navigation + chrome from the store', () => {
    render(<PagesSiteSurface />)
    expect(screen.getByText('იდენტობა')).toBeInTheDocument()
    expect(screen.getByText('ნავიგაცია')).toBeInTheDocument()
    expect(screen.getByText('ჩარჩო')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Seed Site')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('editing the site name writes through updateSite', () => {
    render(<PagesSiteSurface />)
    fireEvent.change(screen.getByLabelText('საიტის სახელი'), { target: { value: 'Renamed' } })
    expect(useConstructorStore.getState().site.name).toBe('Renamed')
  })

  it('editing a nav entry label writes through updateNavItem', () => {
    render(<PagesSiteSurface />)
    // Progressive disclosure: the editor is hidden until the row's Edit is clicked.
    expect(screen.queryByLabelText('Label (en)')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Home' }))
    fireEvent.change(screen.getByLabelText('Label (en)'), { target: { value: 'Start' } })
    expect(useConstructorStore.getState().site.nav[0].label.en).toBe('Start')
    expect(useConstructorStore.getState().site.nav[0].label.ka).toBe('მთავარი') // untouched
  })

  it('re-targeting a nav entry to another page writes through updateNavItem', () => {
    render(<PagesSiteSurface />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Home' }))
    // The target select lists real pages; pick the About page (id p-2).
    fireEvent.mouseDown(screen.getByLabelText('სამიზნე გვერდი'))
    fireEvent.click(within(screen.getByRole('listbox')).getByText('About'))
    expect(useConstructorStore.getState().site.nav[0].pageId).toBe('p-2')
  })

  it('deleting a nav item writes through removeNavItem', () => {
    render(<PagesSiteSurface />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    expect(useConstructorStore.getState().site.nav).toHaveLength(0)
  })

  it('selecting a chrome element (ChromePalette) opens its authoring via selectChrome', () => {
    render(<PagesSiteSurface />)
    const palette = screen.getByTestId('chrome-palette')
    // Pick the first registered chrome slot → it becomes the chrome selection.
    fireEvent.click(within(palette).getAllByRole('button')[0])
    expect(chromeSelectionOf(useConstructorStore.getState().selection)).not.toBeNull()
  })

  it('"+ add page" opens the real page-create dialog (not the wizard stub)', async () => {
    render(<PagesSiteSurface />)
    fireEvent.click(screen.getByRole('button', { name: '+ გვერდის დამატება' }))
    expect(await screen.findByRole('dialog', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /From template/ })).toBeInTheDocument()
  })
})
