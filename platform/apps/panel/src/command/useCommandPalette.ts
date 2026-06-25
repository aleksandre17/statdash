// ── useCommandPalette — open state + the global ⌘K / Ctrl-K shortcut ──────────
//
//  Split out of CommandPalette.tsx so the eager hook (which registers the global
//  keyboard shortcut and must always be live) does NOT pull the cmdk-backed
//  CommandPalette component — that component is lazy-loaded on first open. The
//  hook owns the open flag and the ⌘K listener; the heavy palette UI is deferred.
//
import { useState, useEffect } from 'react'

/**
 * useCommandPalette — owns the open state + the global ⌘K / Ctrl-K shortcut.
 * A "/" pressed while no input is focused also opens the palette in slash mode
 * (Notion ergonomics) — but only when not already typing in a field, so it never
 * hijacks a real "/" keystroke in an Inspector text input.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return { open, setOpen }
}
