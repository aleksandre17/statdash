// @vitest-environment jsdom
//
// ── FF-RADIX-A11Y-INTACT (MultiSelect) ───────────────────────────────────────
//
//  The owned MultiSelect must expose the WAI-ARIA MENU pattern Radix ships
//  (menu + menuitemcheckbox with aria-checked), be keyboard-operable, and keep
//  the defining multi-select gesture: toggling an item does NOT dismiss the
//  surface. We STYLE the primitive, we never re-implement or clobber its
//  semantics — if a future className/prop spread breaks the role tree, the
//  keyboard path, or the stay-open toggle, this fails.
//
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useState } from 'react'
import { MultiSelect } from './MultiSelect'

// jsdom gaps Radix expects (pointer capture / scroll / resize) — not behavior
// under test; identical polyfill set to the Select a11y fitness.
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

const OPTIONS = [
  { value: 'C',  label: 'Manufacturing' },
  { value: 'F',  label: 'Construction' },
  { value: 'G',  label: 'Trade' },
] as const

function Harness({ onValuesChange }: { onValuesChange?: (v: string[]) => void }) {
  const [values, setValues] = useState<string[]>(['C'])
  const handle = (next: string[]) => { setValues(next); onValuesChange?.(next) }
  return (
    <MultiSelect.Root values={values} onValuesChange={handle}>
      <MultiSelect.Trigger aria-label="Sectors" placeholder="—">
        {values.map((v) => (
          <MultiSelect.Chip key={v}>{OPTIONS.find((o) => o.value === v)?.label}</MultiSelect.Chip>
        ))}
      </MultiSelect.Trigger>
      <MultiSelect.Content>
        {OPTIONS.map((o) => (
          <MultiSelect.Item key={o.value} value={o.value}>{o.label}</MultiSelect.Item>
        ))}
      </MultiSelect.Content>
    </MultiSelect.Root>
  )
}

describe('FF-RADIX-A11Y-INTACT — the owned MultiSelect keeps Radix WAI-ARIA + keyboard', () => {
  it('exposes a real button trigger with popup state + the selection as chips', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Sectors' })
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // The current selection is visible while closed (the chip summary).
    expect(trigger.textContent).toContain('Manufacturing')
  })

  it('opens to menuitemcheckbox options via the keyboard, with aria-checked truth', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Sectors' })

    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const menu = await screen.findByRole('menu')
    expect(menu).toBeInTheDocument()
    const items = screen.getAllByRole('menuitemcheckbox')
    expect(items).toHaveLength(3)
    // aria-checked mirrors the controlled values — 'C' in, others out.
    expect(items[0]).toHaveAttribute('aria-checked', 'true')
    expect(items[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('toggling accumulates values WITHOUT dismissing the menu (the multi-select gesture)', async () => {
    const onValuesChange = vi.fn()
    render(<Harness onValuesChange={onValuesChange} />)
    const trigger = screen.getByRole('button', { name: 'Sectors' })

    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await screen.findByRole('menu')

    // Add 'F' — the menu must STAY open, selection = ['C','F'].
    fireEvent.click(screen.getAllByRole('menuitemcheckbox')[1])
    expect(onValuesChange).toHaveBeenLastCalledWith(['C', 'F'])
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Un-toggle 'C' — still open, selection = ['F'].
    fireEvent.click(screen.getAllByRole('menuitemcheckbox')[0])
    expect(onValuesChange).toHaveBeenLastCalledWith(['F'])
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
