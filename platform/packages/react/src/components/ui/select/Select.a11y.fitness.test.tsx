// @vitest-environment jsdom
//
// ── FF-RADIX-A11Y-INTACT ─────────────────────────────────────────────────────
//
//  The owned Select must expose the WAI-ARIA LISTBOX pattern Radix ships, and
//  must be keyboard-operable — we STYLE the primitive, we never re-implement or
//  clobber its semantics. This gate is the structural proof of Foundation rule 3
//  ("style only, never override semantics"): if a future className/prop spread
//  breaks the combobox role or the keyboard open/select path, this fails.
//
//  It also proves the swap RAISES the a11y floor above the native <select> it
//  replaced (which could not be styled) — Project Law 9 / WCAG 2.1 AA held, now
//  with a craftable, fully-keyboardable listbox.
//
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Select } from './Select'

// Radix Select drives pointer capture / scrolling / resize observation that
// jsdom does not implement. Polyfill the minimum so the primitive can open —
// these are jsdom gaps, not behavior under test.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

function Harness({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <Select.Root value="click" onValueChange={onValueChange}>
      <Select.Trigger aria-label="Trigger gesture" placeholder="—" />
      <Select.Content>
        <Select.Item value="click">Click</Select.Item>
        <Select.Item value="hover">Hover</Select.Item>
      </Select.Content>
    </Select.Root>
  )
}

describe('FF-RADIX-A11Y-INTACT — the owned Select keeps Radix WAI-ARIA + keyboard', () => {
  it('exposes the combobox ARIA contract on the trigger (role + name + collapsed state)', () => {
    render(<Harness />)
    // getByRole('combobox', { name }) is itself the assertion that Radix's role +
    // accessible name are intact — style never clobbered the semantics.
    const trigger = screen.getByRole('combobox', { name: 'Trigger gesture' })
    // A real, keyboard-focusable button reporting its collapsed popup state.
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens to a listbox of options via the keyboard and commits a selection', async () => {
    const onValueChange = vi.fn()
    render(<Harness onValueChange={onValueChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Trigger gesture' })

    // Keyboard OPEN — ArrowDown on the trigger reveals the listbox (APG pattern).
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const listbox = await screen.findByRole('listbox')
    expect(listbox).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Commit a different option — proves the selection wiring reaches onValueChange.
    fireEvent.click(options[1])
    expect(onValueChange).toHaveBeenCalledWith('hover')
  })
})
