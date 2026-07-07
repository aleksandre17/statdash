// @vitest-environment jsdom
//
// ── SharePermalinkButton — HTTP-safe copy + success feedback ──────────────────
//
//  Root cause pinned here: on a NON-secure context (plain HTTP LAN prod), the
//  async Clipboard API is unavailable (`navigator.clipboard` is undefined), so
//  the old `navigator.clipboard?.writeText()` silently no-oped. The copy must
//  fall back to the legacy execCommand path and STILL surface success feedback.
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'

// useT → identity translator (returns the key) so we assert the localized keys
// are wired without standing up i18next.
vi.mock('@statdash/react', () => ({ useT: () => (key: string) => key }))

import { SharePermalinkButton, copyToClipboard } from './SharePermalinkButton'

afterEach(cleanup)

// jsdom (v29) no longer defines document.execCommand, so it cannot be spied —
// assign a stub directly (mirrors a real browser where execCommand exists).
function stubExecCommand(result: boolean) {
  const fn = vi.fn(() => result)
  ;(document as unknown as { execCommand: unknown }).execCommand = fn
  return fn
}

describe('copyToClipboard — context-robust copy', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original)
    else delete (navigator as { clipboard?: unknown }).clipboard
    vi.restoreAllMocks()
  })

  it('FALLS BACK to execCommand when navigator.clipboard is undefined (HTTP)', async () => {
    // Simulate a non-secure context — no async Clipboard API.
    delete (navigator as { clipboard?: unknown }).clipboard
    const exec = stubExecCommand(true)

    const ok = await copyToClipboard('http://192.168.1.199:3002/ka/gdp#x')

    expect(ok).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    // the off-screen textarea is cleaned up (no leak)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('uses the async Clipboard API when available (secure context)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const exec = stubExecCommand(true)

    const ok = await copyToClipboard('https://x/#y')

    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://x/#y')
    expect(exec).not.toHaveBeenCalled()
  })

  it('falls through to the legacy path when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const exec = stubExecCommand(true)

    const ok = await copyToClipboard('https://x/#y')

    expect(ok).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })
})

describe('SharePermalinkButton — accessible button + feedback', () => {
  beforeEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard
    stubExecCommand(true)
  })
  afterEach(() => vi.restoreAllMocks())

  it('is an accessible <button> and announces success via aria-live on copy', async () => {
    const { container, getByRole } = render(<SharePermalinkButton sectionId="prod" />)

    const btn = getByRole('button')
    expect(btn.getAttribute('aria-label')).toBe('share.permalink')

    // Live region present + empty before the copy.
    const live = container.querySelector('[aria-live="polite"]')!
    expect(live.textContent).toBe('')

    fireEvent.click(btn)

    // After the async copy resolves: the button shows the copied visual state and
    // the polite live region announces the localized "copied" key.
    await waitFor(() => expect(live.textContent).toBe('share.copied'))
    expect(btn.classList.contains('is-copied')).toBe(true)
  })
})
