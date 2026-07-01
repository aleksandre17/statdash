// @vitest-environment jsdom
//
// ── AppErrorBoundary — defense-in-depth fail-soft (ADR-0028) ──────────────────
//
//  A crash ANYWHERE below the boundary must degrade to the injected brand-free
//  fallback, not propagate to a blank unmount. This locks the app-root half of
//  the fail-soft guarantee (the shell null-guard is the other half).
//
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen }             from '@testing-library/react'
import { AppErrorBoundary }                    from './AppErrorBoundary'

afterEach(() => cleanup())

function Boom(): never {
  throw new Error('shell exploded')
}

describe('AppErrorBoundary — any descendant crash degrades to the fallback', () => {
  it('renders children unchanged when nothing throws', () => {
    render(
      <AppErrorBoundary fallback={<div>fallback</div>}>
        <div>healthy content</div>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('healthy content')).toBeTruthy()
    expect(screen.queryByText('fallback')).toBeNull()
  })

  it('swaps to the fallback — no throw escapes — when a descendant throws', () => {
    // React re-throws to console.error for a caught boundary error; silence it so
    // the suite output stays clean (the boundary still logs via componentDidCatch).
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary fallback={<div>Something went wrong</div>}>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    // The raw error text must NOT reach the user (graceful degradation).
    expect(screen.queryByText(/shell exploded/)).toBeNull()
    spy.mockRestore()
  })

  it('invokes onError with the thrown Error — fail-soft, never fail-SILENT', () => {
    const spy     = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    render(
      <AppErrorBoundary fallback={<div>fallback</div>} onError={onError}>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    spy.mockRestore()
  })
})
