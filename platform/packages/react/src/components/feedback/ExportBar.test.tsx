// @vitest-environment jsdom
//
// ── ExportBar — registry-driven rendering [N16] ───────────────────────
//
//  The bar renders exactly one button per registered export format
//  (listExportFormats() is the SSOT). This guards against the old leaky
//  'csv' | 'xlsx' literal union: a newly-registered format (e.g. xlsx)
//  must surface a button with NO consumer edit.
//

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExportBar }    from './ExportBar'
import { SiteProvider } from '../../context/SiteContext'
import { listExportFormats } from '@statdash/engine'
import type { DataRow } from '@statdash/engine'
// Side-effect: ensure built-in formats (csv, xlsx, sdmx-json) are registered.
import '@statdash/engine'

const ROWS: DataRow[] = [
  { id: '2021', label: 'Tbilisi', value: 12.3 },
  { id: '2022', label: 'Kutaisi', value: 14.5 },
]

function renderBar(props: Parameters<typeof ExportBar>[0]) {
  return render(
    <SiteProvider
      stores={{}}
      nav={[]}
      i18n={{ defaultLocale: 'en', locales: ['en'], fallbackLocale: 'en' }}
    >
      <ExportBar {...props} />
    </SiteProvider>,
  )
}

describe('ExportBar — registry-driven', () => {
  it('renders one button per registered export format (no hardcoded union)', () => {
    renderBar({ rows: ROWS, meta: {} })
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(listExportFormats().length)
  })

  it('renders an xlsx (Excel) button now that the format is registered', () => {
    renderBar({ rows: ROWS, meta: {} })
    // Button text is `↓ ${fmt.toUpperCase()}` — assert the XLSX label is present.
    expect(screen.getByText(/XLSX/)).toBeInTheDocument()
    expect(screen.getByText(/CSV/)).toBeInTheDocument()
  })

  it('is an accessible toolbar', () => {
    renderBar({ rows: ROWS, meta: {} })
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })

  it('renders nothing when rows are empty', () => {
    const { container } = renderBar({ rows: [], meta: {} })
    expect(container.querySelector('.export-bar')).toBeNull()
  })

  it('forwards the registry format id to onExport when provided', () => {
    const onExport = vi.fn()
    renderBar({ rows: ROWS, meta: {}, onExport })
    fireEvent.click(screen.getByText(/XLSX/))
    expect(onExport).toHaveBeenCalledWith('xlsx')
  })
})
