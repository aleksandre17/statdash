// @vitest-environment jsdom
//
// ── FITNESS: compact export menu-button + section export scope ─────────────
//
//  Encodes the redesign invariants so a regression is a RED test:
//    A. The download control is ONE icon menu-button (not a per-format toolbar);
//       it opens a role=menu of the REGISTERED formats and selecting one DISPATCHES
//       the export — proven with `downloadExport` MOCKED (no real browser
//       download), asserting the registry format id + rows/meta reach the seam.
//       ARIA roles + keyboard open are asserted.
//    B. The section-scope mechanism (Law 9 — export per section): a VISIBLE panel
//       publishing rows makes `hasExport` true and `readActive()` return its rows;
//       a HIDDEN (view-toggle) panel CLEARS its report so the header exports only
//       the slice on screen.
//
//  Placed in packages/react (bundler-agnostic) rather than a plugin render, which
//  the worktree MAX_PATH block prevents from running here.
//

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'

// Mock ONLY the browser download trigger — the export selection path must reach it
// with the right (format, rows, meta), without a real navigation.
vi.mock('../../engine/downloadExport', async (importActual) => {
  const actual = await importActual<typeof import('../../engine/downloadExport')>()
  return { ...actual, downloadExport: vi.fn(() => true) }
})

import { downloadExport }   from '../../engine/downloadExport'
import { ExportMenu }       from './ExportMenu'
import { SiteProvider }     from '../../context/SiteContext'
import { NodeExportProvider, useExportScope, useReportPanelExport } from '../../engine/NodeExportContext'
import { NodeVisibilityProvider } from '../../engine/NodeStatusContext'
import { listExportFormats } from '@statdash/engine'
import type { DataRow }      from '@statdash/engine'

const ROWS: DataRow[] = [
  { id: '2021', label: 'Tbilisi', value: 12.3 },
  { id: '2022', label: 'Kutaisi', value: 14.5 },
]

function withSite(node: ReactNode) {
  return render(
    <SiteProvider stores={{}} nav={[]} i18n={{ defaultLocale: 'en', locales: ['en'], fallbackLocale: 'en' }}>
      {node}
    </SiteProvider>,
  )
}

// ── A. menu-button → registered formats → dispatch (download mocked) ─────────

describe('FITNESS A — export menu-button dispatches the selected format', () => {
  it('one icon button; opens a menu of the registered formats; selecting dispatches', () => {
    (downloadExport as Mock).mockClear()
    // No onExport → the internal exportAs path runs, which calls downloadExport.
    withSite(<ExportMenu rows={ROWS} meta={{ filename: 'gdp', title: 'GDP' }} />)

    // ONE trigger icon (the clutter win), and it is a menu button.
    const trigger = screen.getByRole('button')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')

    // Keyboard open → role=menu with one menuitem per registered format.
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const menu  = screen.getByRole('menu')
    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(listExportFormats().length)

    // Select CSV → downloadExport called with that registry id + the rows/meta.
    const csvIdx = listExportFormats().indexOf('csv')
    fireEvent.click(items[csvIdx])
    expect(downloadExport).toHaveBeenCalledTimes(1)
    expect(downloadExport).toHaveBeenCalledWith('csv', ROWS, { filename: 'gdp', title: 'GDP' })
  })
})

// ── B. section export scope — publish up, read the active (visible) slice ─────

/** A panel that publishes its rows to the nearest export scope. */
function Publisher({ id, rows }: { id: string; rows: DataRow[] }) {
  useReportPanelExport(id, rows, { filename: id })
  return null
}

/** Renders the scope's live hasExport + active row-count into the DOM. */
function ScopeProbe({ visible, rows }: { visible: boolean; rows: DataRow[] }) {
  const scope = useExportScope()
  return (
    <NodeExportProvider collector={scope.collector}>
      <NodeVisibilityProvider visible={visible}>
        <Publisher id="panel-1" rows={rows} />
      </NodeVisibilityProvider>
      <span data-testid="has">{String(scope.hasExport)}</span>
      <span data-testid="count">{scope.readActive()?.rows.length ?? -1}</span>
    </NodeExportProvider>
  )
}

describe('FITNESS B — section export scope', () => {
  it('a VISIBLE panel publishes rows → hasExport true, readActive returns them', () => {
    withSite(<ScopeProbe visible rows={ROWS} />)
    expect(screen.getByTestId('has').textContent).toBe('true')
    expect(screen.getByTestId('count').textContent).toBe(String(ROWS.length))
  })

  it('a HIDDEN (toggled-off) panel clears its report → nothing to export', () => {
    withSite(<ScopeProbe visible={false} rows={ROWS} />)
    expect(screen.getByTestId('has').textContent).toBe('false')
    expect(screen.getByTestId('count').textContent).toBe('-1')
  })

  it('an EMPTY visible panel does not surface an export', () => {
    withSite(<ScopeProbe visible rows={[]} />)
    expect(screen.getByTestId('has').textContent).toBe('false')
  })
})
