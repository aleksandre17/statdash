// ── FF-VALUE-AUTHORING — the ONE unified value-authoring wrapper (fixed·bound·responsive) ─
//
//  Locks the invariants of the coherent value-authoring model (the successor to three
//  bolt-on wrappers):
//    • ADDITIVE (Law 8) — a field with NEITHER capability renders the bare Control, no
//      wrapper chrome (reference-identical to no wrapper at all).
//    • BINDING preserved — a bindable field keeps the exact ⚡ toggle (aria-pressed) +
//      literal↔bind flip the standalone bind wrapper shipped (no regression).
//    • RESPONSIVE — a `responsive` field exposes the per-breakpoint mode; authoring AT a
//      breakpoint writes ONLY that breakpoint's entry of the ResponsiveVal map.
//    • HONEST (Law 11) — an unset non-base breakpoint shows the value it INHERITS from the
//      nearest larger set breakpoint, annotated, never fabricated.
//    • UNIFIED — ONE component surfaces BOTH ⚡ and per-breakpoint for a field that is both
//      bindable AND responsive (the coherence mandate — not two competing wrappers).
//
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PropField } from '@statdash/react/engine'
import type { FieldControl } from '../fieldControl.types'
import { ValueAuthoringControl } from './ValueAuthoringControl'
import { ActiveBreakpointProvider } from '../../studio/activeBreakpoint'
import { BreakpointSwitcher } from '../../studio/BreakpointSwitcher'

// A trivial Control: an input reflecting the current value (string coerced).
const MockControl: FieldControl = ({ id, value, onChange }) => (
  <input
    data-testid="mock-control"
    id={id}
    value={value == null ? '' : String(value)}
    onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
  />
)

const field = (over: Partial<PropField> = {}): PropField => ({
  field: 'columns', type: 'number', label: 'Columns', ...over,
})

/** Controlled harness — mirrors how the Inspector owns the value store. */
function Harness({
  field: f, initial, allowProvider = true,
}: { field: PropField; initial: unknown; allowProvider?: boolean }) {
  const [val, setVal] = useState<unknown>(initial)
  const control = (
    <ValueAuthoringControl
      Control={MockControl}
      field={f}
      id="insp-columns"
      value={val}
      locales={['en']}
      locale="en"
      siblingValues={{}}
      onChange={setVal}
    />
  )
  return allowProvider ? (
    <ActiveBreakpointProvider>
      <BreakpointSwitcher />
      {control}
      <output data-testid="value">{JSON.stringify(val)}</output>
    </ActiveBreakpointProvider>
  ) : (
    <>{control}<output data-testid="value">{JSON.stringify(val)}</output></>
  )
}

describe('FF-VALUE-AUTHORING — the unified value-authoring wrapper', () => {
  it('ADDITIVE — a non-bindable, non-responsive field renders the bare Control (no wrapper chrome)', () => {
    render(<Harness field={field({ type: 'boolean' })} initial={true} allowProvider={false} />)
    expect(screen.getByTestId('mock-control')).toBeTruthy()
    // No mode affordance at all — the passthrough path.
    expect(document.querySelector('.insp-bind')).toBeNull()
    expect(document.querySelector('.insp-bind__toggle')).toBeNull()
  })

  it('BINDING — a bindable field keeps the ⚡ toggle and flips literal ↔ bind', () => {
    render(<Harness field={field({ type: 'number' })} initial={4} allowProvider={false} />)
    const toggle = document.querySelector('.insp-bind__toggle') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    // Now bound — the expr editor is shown and the value is a { $bind } marker.
    expect(document.querySelector('.insp-bind__expr')).toBeTruthy()
    expect(JSON.parse(screen.getByTestId('value').textContent!)).toEqual({ $bind: '' })
    expect(document.querySelector('.insp-bind__toggle')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('UNIFIED — a bindable AND responsive field surfaces BOTH ⚡ and the per-breakpoint toggle in ONE control', () => {
    render(<Harness field={field({ type: 'number', responsive: true })} initial={4} />)
    const toggles = document.querySelectorAll('.insp-bind__toggle')
    // Two mode toggles: bind (⚡) + responsive (⧉) — coherent, one wrapper.
    expect(toggles.length).toBe(2)
    expect(document.querySelector('.insp-va__responsive')).toBeTruthy()
  })

  it('RESPONSIVE + HONEST — authoring at md writes only md; an unset md inherits the base honestly', () => {
    render(<Harness field={field({ type: 'number', responsive: true })} initial={4} />)

    // Enter responsive mode — seeds { default: 4 } (nothing lost).
    fireEvent.click(document.querySelector('.insp-va__responsive') as HTMLButtonElement)
    expect(JSON.parse(screen.getByTestId('value').textContent!)).toEqual({ default: 4 })

    // Switch the active breakpoint to md via the switcher.
    fireEvent.click(document.querySelector('[data-bp="md"]') as HTMLButtonElement)

    // md is unset → honestly annotated as inherited, and the nested control shows the
    // inherited base value (4), never a fabricated blank/0.
    expect(screen.getByTestId('bp-inherited')).toBeTruthy()
    expect((screen.getByTestId('mock-control') as HTMLInputElement).value).toBe('4')

    // Author 1 at md → writes ONLY the md entry; the base is untouched.
    fireEvent.change(screen.getByTestId('mock-control'), { target: { value: '1' } })
    expect(JSON.parse(screen.getByTestId('value').textContent!)).toEqual({ default: 4, md: 1 })

    // Clearing the md override returns to inheriting the base (honest unset).
    fireEvent.click(document.querySelector('.insp-va__bp-clear') as HTMLButtonElement)
    expect(JSON.parse(screen.getByTestId('value').textContent!)).toEqual({ default: 4 })
  })

  it('the responsive affordance appears ONLY for a declared-responsive field (opt-in, zero per-type wiring)', () => {
    const { rerender } = render(<Harness field={field({ type: 'number' })} initial={4} />)
    expect(document.querySelector('.insp-va__responsive')).toBeNull()
    rerender(<Harness field={field({ type: 'number', responsive: true })} initial={4} />)
    expect(document.querySelector('.insp-va__responsive')).toBeTruthy()
  })
})
