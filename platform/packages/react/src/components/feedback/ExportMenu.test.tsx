// @vitest-environment jsdom
//
// ── ExportMenu — compact download menu-button [N16] ───────────────────
//
//  The former `.export-bar` rendered one button PER format (dozens per page).
//  ExportMenu collapses that to ONE icon button (WAI-ARIA menu button) that opens
//  a role="menu" of the registered formats. This suite pins the menu pattern:
//  a single trigger, the registry-driven menu (listExportFormats() is the SSOT —
//  a newly-registered format surfaces with NO consumer edit), the ARIA roles, the
//  keyboard model, and that selecting an item forwards the registry format id.
//

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ExportMenu }        from './ExportMenu'
import { SiteProvider }      from '../../context/SiteContext'
import { listExportFormats } from '@statdash/engine'
import type { DataRow }      from '@statdash/engine'
// Side-effect: ensure built-in formats (csv, xlsx, sdmx-json) are registered.
import '@statdash/engine'

const ROWS: DataRow[] = [
  { id: '2021', label: 'Tbilisi', value: 12.3 },
  { id: '2022', label: 'Kutaisi', value: 14.5 },
]

function renderMenu(props: Parameters<typeof ExportMenu>[0]) {
  return render(
    <SiteProvider
      stores={{}}
      nav={[]}
      i18n={{ defaultLocale: 'en', locales: ['en'], fallbackLocale: 'en' }}
    >
      <ExportMenu {...props} />
    </SiteProvider>,
  )
}

/** Open the menu via the trigger and return the menu element. */
function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /./ }))
  return screen.getByRole('menu')
}

describe('ExportMenu — menu-button pattern', () => {
  it('renders exactly ONE trigger button (not one per format)', () => {
    renderMenu({ rows: ROWS, meta: {} })
    // Closed: the only button is the trigger — the clutter win.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('the trigger is a WAI-ARIA menu button (haspopup + expanded + label)', () => {
    renderMenu({ rows: ROWS, meta: {} })
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // Localized aria-label (from the feedback catalog: export.toolbar) — present + non-empty.
    expect(trigger.getAttribute('aria-label')).toBeTruthy()
  })

  it('opens a role=menu with one role=menuitem per registered format', () => {
    renderMenu({ rows: ROWS, meta: {} })
    const menu = openMenu()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(listExportFormats().length)
  })

  it('forwards the registry format id to onExport when a menuitem is chosen', () => {
    const onExport = vi.fn()
    renderMenu({ rows: ROWS, meta: {}, onExport })
    const menu = openMenu()
    const items = within(menu).getAllByRole('menuitem')
    // Menu order follows listExportFormats() order (the SSOT) — pick xlsx by index.
    const formats = listExportFormats()
    const xlsxIdx = formats.indexOf('xlsx')
    fireEvent.click(items[xlsxIdx])
    expect(onExport).toHaveBeenCalledWith('xlsx')
  })

  it('closes and returns focus to the trigger after a selection', () => {
    renderMenu({ rows: ROWS, meta: {}, onExport: vi.fn() })
    const menu = openMenu()
    fireEvent.click(within(menu).getAllByRole('menuitem')[0])
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button'))
  })

  // ── Keyboard (WCAG 2.1 AA) ──────────────────────────────────────────────
  it('ArrowDown on the trigger opens the menu and focuses the first item', () => {
    renderMenu({ rows: ROWS, meta: {} })
    const trigger = screen.getByRole('button')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
  })

  it('ArrowDown/ArrowUp roves between menu items (wrapping)', () => {
    renderMenu({ rows: ROWS, meta: {} })
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(items[1], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[0])
    // wrap: ArrowUp from first → last
    fireEvent.keyDown(items[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('Escape closes the menu and returns focus to the trigger', () => {
    renderMenu({ rows: ROWS, meta: {} })
    const trigger = screen.getByRole('button')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    fireEvent.keyDown(items[0], { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('renders nothing when rows are empty (callers need no guard)', () => {
    const { container } = renderMenu({ rows: [], meta: {} })
    expect(container.querySelector('.export-menu')).toBeNull()
  })
})
