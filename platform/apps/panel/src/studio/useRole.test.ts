import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRole, useToggleRole, useSetRole, useRoleStore } from './useRole'

// ── The role LENS seam (AR-49 M2.0) ───────────────────────────────────────────
//
//  useRole() is THE single reader of the role, and its SOURCE is a swappable seam
//  (persisted local preference today, an auth claim later — §2.3). These tests pin
//  the contract every consumer relies on: default author, a toggle that flips the
//  lens, an explicit setter, and persistence to the documented localStorage key.
beforeEach(() => {
  localStorage.clear()
  useRoleStore.setState({ role: 'author' })
})

describe('useRole — the swappable role seam', () => {
  it('defaults to the author lens (safe, governed-noun surface on a fresh session)', () => {
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('author')
  })

  it('toggleRole flips the lens author ⇄ steward', () => {
    const { result } = renderHook(() => ({ role: useRole(), toggle: useToggleRole() }))
    expect(result.current.role).toBe('author')
    act(() => result.current.toggle())
    expect(result.current.role).toBe('steward')
    act(() => result.current.toggle())
    expect(result.current.role).toBe('author')
  })

  it('setRole sets the lens explicitly (the imperative seam for ⌘K / tests)', () => {
    const { result } = renderHook(() => ({ role: useRole(), set: useSetRole() }))
    act(() => result.current.set('steward'))
    expect(result.current.role).toBe('steward')
  })

  it('persists the lens to localStorage under the documented key `statdash.role`', () => {
    const { result } = renderHook(() => useSetRole())
    act(() => result.current('steward'))
    const raw = localStorage.getItem('statdash.role')
    expect(raw).not.toBeNull()
    // persist middleware wraps the value; the steward lens must round-trip.
    expect(raw).toContain('steward')
  })
})
