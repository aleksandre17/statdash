// @vitest-environment jsdom
//
// ── PanelLayout — role-based (controlled) view toggle ─────────────────────────
//
//  FF-ONE-VIEW-MECHANISM (mechanism side). PanelLayout's bespoke INDEX toggle
//  (`views: PanelView[]` + `defaultViewIndex` + internal activeIdx child-switching)
//  is retired. The panel now renders a CONTROLLED, role-based toggle derived from
//  useViewToggle — the single view-toggle mechanism the section shell also uses.
//
//  Two properties are pinned here:
//    1. The toggle is role-based + controlled: it renders one button per role,
//       reflects `active` via aria-pressed, and calls `onSelect(role)` on click.
//       PanelLayout owns NO active-view state (no index switching).
//    2. ALL children stay mounted regardless of the active role — the caller
//       hides inactive views via resolveViewState (data-view), never PanelLayout.
//

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PanelLayout, type PanelViewToggle } from './PanelLayout'

afterEach(cleanup)

function makeToggle(active: string, onSelect = vi.fn()): PanelViewToggle {
  return {
    roles:     ['map', 'table'],
    labels:    { map: 'Map', table: 'Table' },
    active,
    onSelect,
    ariaLabel: 'Toggle view',
  }
}

describe('PanelLayout — role-based controlled toggle', () => {
  it('renders one button per role with aria-pressed on the active role', () => {
    const { container } = render(
      <PanelLayout title="Regions" viewToggle={makeToggle('map')}>
        <div data-testid="map">map-body</div>
        <div data-testid="table">table-body</div>
      </PanelLayout>,
    )
    const group = container.querySelector('.panel__view-toggle[role="group"]')!
    expect(group.getAttribute('aria-label')).toBe('Toggle view')
    const btns = group.querySelectorAll('button')
    expect(btns.length).toBe(2)
    expect(btns[0].textContent).toBe('Map')
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')
    expect(btns[1].getAttribute('aria-pressed')).toBe('false')
  })

  it('is controlled — clicking a role calls onSelect(role), PanelLayout holds no index state', () => {
    const onSelect = vi.fn()
    const { container, rerender } = render(
      <PanelLayout title="Regions" viewToggle={makeToggle('map', onSelect)}>
        <div>map-body</div>
        <div>table-body</div>
      </PanelLayout>,
    )
    const btns = container.querySelectorAll('.panel__view-btn')
    fireEvent.click(btns[1])
    expect(onSelect).toHaveBeenCalledWith('table')
    // PanelLayout did NOT self-toggle: aria-pressed is still driven by the prop.
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')

    // Only when the controlling caller flips `active` does the pressed state move.
    rerender(
      <PanelLayout title="Regions" viewToggle={makeToggle('table', onSelect)}>
        <div>map-body</div>
        <div>table-body</div>
      </PanelLayout>,
    )
    const after = container.querySelectorAll('.panel__view-btn')
    expect(after[0].getAttribute('aria-pressed')).toBe('false')
    expect(after[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps ALL children mounted regardless of active role (no index child-switching)', () => {
    const { getByTestId } = render(
      <PanelLayout title="Regions" viewToggle={makeToggle('map')}>
        <div data-testid="map">map-body</div>
        <div data-testid="table">table-body</div>
      </PanelLayout>,
    )
    // Both bodies present even though only 'map' is active — the retired index
    // toggle would have rendered childArray[activeIdx] only.
    expect(getByTestId('map')).toBeTruthy()
    expect(getByTestId('table')).toBeTruthy()
  })

  it('renders no toggle group for a single role (nothing to switch)', () => {
    const { container } = render(
      <PanelLayout
        title="Regions"
        viewToggle={{ roles: ['map'], labels: { map: 'Map' }, active: 'map', onSelect: vi.fn() }}
      >
        <div>map-body</div>
      </PanelLayout>,
    )
    expect(container.querySelector('.panel__view-toggle')).toBeNull()
  })
})

// ── Collapse — chevron BUTTON is the sole trigger (not the whole header) ──────
describe('PanelLayout — chevron-only collapse', () => {
  it('collapses ONLY via the chevron button; a header click does not collapse', () => {
    const { container } = render(
      <PanelLayout id="p1" title="Regions" collapseLabel="Collapse" expandLabel="Expand">
        <div data-testid="body">body</div>
      </PanelLayout>,
    )
    expect(container.querySelector('[data-testid="body"]')).toBeTruthy()

    // Header itself is inert — clicking it must not collapse.
    fireEvent.click(container.querySelector('.panel__head')!)
    expect(container.querySelector('[data-testid="body"]')).toBeTruthy()

    // The chevron is a real, labelled button wired to aria-expanded + aria-controls.
    const chevron = container.querySelector('.panel__chevron-btn') as HTMLButtonElement
    expect(chevron.tagName).toBe('BUTTON')
    expect(chevron.getAttribute('aria-label')).toBe('Collapse')
    expect(chevron.getAttribute('aria-expanded')).toBe('true')
    expect(chevron.getAttribute('aria-controls')).toBe('p1-body')

    fireEvent.click(chevron)
    expect(container.querySelector('[data-testid="body"]')).toBeNull()
    expect(chevron.getAttribute('aria-expanded')).toBe('false')
    expect(chevron.getAttribute('aria-label')).toBe('Expand')
  })

  it('renders no chevron button when collapse is disabled (noCollapse)', () => {
    const { container } = render(
      <PanelLayout title="Regions" noCollapse>
        <div>body</div>
      </PanelLayout>,
    )
    expect(container.querySelector('.panel__chevron-btn')).toBeNull()
  })
})
