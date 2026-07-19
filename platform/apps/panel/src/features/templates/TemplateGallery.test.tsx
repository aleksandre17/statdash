// ── TemplateGallery.test — a11y + the pick→create path (V7) ──────────────────
//
//  The gallery is the "never start blank" surface. We pin:
//    - the starters render as a semantic radio group (role=radiogroup/radio),
//      keyboard-operable (Space selects) — WCAG 2.1 AA.
//    - the data-first generate option appears when a cube profile is ready.
//    - confirming a selection calls createFromTemplate with the chosen config +
//      the entered title (the persistence path, mocked here).
//
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import type { CubeProfile } from '../../lib/cubeApi'

// The starters are REGISTERED declarations (ADR-050 R3): the gallery reads
// pageStarterList() (presetRegistry ∩ registered page kinds), so the registry must
// be booted for the starters to project — the same setup the fitness suite runs.
beforeAll(() => { setupCanvasRegistry() })

// A ready profile so the data-first option renders + generates a page.
const PROFILE: CubeProfile = {
  datasetCode: 'DS',
  dimensions: [
    { code: 'TIME', conceptRole: null, isTime: true, members: [] },
    { code: 'SECTOR', conceptRole: null, isTime: false, members: [] },
  ],
  measures: [{
    code: 'GDP', label: { en: 'GDP', ka: 'მშპ' },
    unit: { unit_code: null, symbol: null, label: null, unit_type: null,
            unit_mult: null, decimals: null, base_period: null, source: 'none' },
  }],
  actualRegion: { available: false, combinations: null },
}

vi.mock('../../discovery/useActiveProfile', () => ({
  useActiveProfile: () => ({ status: 'ready', profile: PROFILE }),
}))

const createFromTemplate = vi.fn(
  (_config: unknown, _title: { ka: string; en: string }) => Promise.resolve({ id: 'new-page' }),
)
vi.mock('./loadTemplate', async (orig) => ({
  ...(await orig<typeof import('./loadTemplate')>()),
  createFromTemplate: (config: unknown, title: { ka: string; en: string }) => createFromTemplate(config, title),
}))

import { TemplateGallery } from './TemplateGallery'

beforeEach(() => createFromTemplate.mockClear())

describe('TemplateGallery — a11y + pick→create', () => {
  it('renders the starters as a keyboard radio group', () => {
    render(<TemplateGallery open onClose={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: /საწყისი შაბლონები/ })
    const radios = within(group).getAllByRole('radio')
    expect(radios.length).toBeGreaterThanOrEqual(3)   // the committed starters
    radios.forEach((r) => expect(r).toHaveAttribute('tabindex', '0'))
  })

  it('offers the data-first generate option when a cube is bound', () => {
    render(<TemplateGallery open onClose={() => {}} />)
    expect(screen.getByTestId('template-generate')).toBeInTheDocument()
  })

  it('Space selects a starter (keyboard equivalent of click)', () => {
    render(<TemplateGallery open onClose={() => {}} />)
    const card = screen.getByTestId('template-chart-table')
    expect(card).toHaveAttribute('aria-checked', 'false')
    fireEvent.keyDown(card, { key: ' ' })
    expect(card).toHaveAttribute('aria-checked', 'true')
  })

  it('confirming a chosen starter + title creates the page', async () => {
    render(<TemplateGallery open onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('template-single-chart'))
    fireEvent.change(screen.getByLabelText(/ახალი გვერდის სათაური \(ka\)/), { target: { value: 'GDP' } })
    fireEvent.click(screen.getByTestId('template-create-confirm'))
    // createFromTemplate(config, title) — the starter's config + the entered title.
    expect(createFromTemplate).toHaveBeenCalledTimes(1)
    const title = createFromTemplate.mock.calls[0][1]
    expect(title.ka).toBe('GDP')
  })

  it('blocks create until a template is chosen', () => {
    render(<TemplateGallery open onClose={() => {}} />)
    expect(screen.getByTestId('template-create-confirm')).toBeDisabled()
  })
})
