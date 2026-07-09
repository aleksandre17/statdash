import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PagesSiteSurface } from './PagesSiteSurface'
import { useConstructorStore } from '../../store/constructor.store'
import type { NavItem } from '../../types/constructor'

// The Studio Pages&Site surface — relocates SiteStep's identity + navigation via
// the SHARED SiteIdentityEditor / NavEditor (no fork). Proves it mounts, writes the
// real site slice (updateSite / removeNavItem), and — unlike the wizard's stub —
// wires "+ add page" to the REAL page-create dialog.

const NAV: NavItem = { id: 'nav-1', label: { ka: 'მთავარი', en: 'Home' }, pageId: 'p-1', order: 0 }

beforeEach(() => {
  useConstructorStore.getState().updateSite({ name: 'Seed Site', nav: [NAV] })
})

describe('PagesSiteSurface — relocated site authoring (AR-49 M1.3)', () => {
  it('mounts identity + navigation from the store', () => {
    render(<PagesSiteSurface />)
    expect(screen.getByText('იდენტობა')).toBeInTheDocument()
    expect(screen.getByText('ნავიგაცია')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Seed Site')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('editing the site name writes through updateSite', () => {
    render(<PagesSiteSurface />)
    fireEvent.change(screen.getByLabelText('საიტის სახელი'), { target: { value: 'Renamed' } })
    expect(useConstructorStore.getState().site.name).toBe('Renamed')
  })

  it('deleting a nav item writes through removeNavItem', () => {
    render(<PagesSiteSurface />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    expect(useConstructorStore.getState().site.nav).toHaveLength(0)
  })

  it('"+ add page" opens the real page-create dialog (not the wizard stub)', async () => {
    render(<PagesSiteSurface />)
    fireEvent.click(screen.getByRole('button', { name: '+ გვერდის დამატება' }))
    // The lazy PageBrowser dialog (createPage / createFromTemplate) mounts on demand.
    expect(await screen.findByRole('dialog', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /From template/ })).toBeInTheDocument()
  })
})
