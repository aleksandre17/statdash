// ── breadcrumbSlot — hoist a nested-drill breadcrumb to an ancestor host (SL-1) ─
//
//  The nested-item editor (`controls/NestedItemControl`'s DrillEditor) owns the
//  drill PATH as component-local state, deep in the form body, and renders a
//  breadcrumb for it. A HOST that wants to show that breadcrumb in its own chrome —
//  the RightDock header, whose one-tier contract puts the breadcrumb in place of the
//  context switch (SPEC-studio-shell-layout §6, SL-1) — provides this slot; the
//  editor then PROMOTES its breadcrumb up instead of rendering it in-body.
//
//  The port lives in the inspector layer (the breadcrumb's PRODUCER) so the shell
//  depends on the feature, never the reverse — the sanctioned direction. A host
//  (studio/RightDock) implements the port; the editor consumes it. Dependency
//  Inversion: the low-level module defines the interface, the high-level provides it.
//
//  ── Deterministic ownership (a stack, like a modal stack) ─────────────────────
//  Several DrillEditors can be mounted at once (a node with two array fields). One
//  header shows ONE breadcrumb, so the MOST-RECENTLY-drilled editor owns it; when it
//  navigates back to its root (or unmounts) it releases and the previous owner — or,
//  when none remain, the host's default chrome — returns. A source's own crumb
//  refreshes keep its slot in place (stable order), so drilling deeper never
//  reshuffles ownership.
//
//  ── Fail-soft (zero regression) ──────────────────────────────────────────────
//  A nested editor rendered with NO host (unit tests, any other mount) reads a null
//  slot and falls back to rendering its breadcrumb in-body, exactly as before.
//
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface BreadcrumbSlot {
  /** Register or refresh this source's breadcrumb; the latest registrant is shown. */
  promote: (id: string, node: ReactNode) => void
  /** Withdraw this source (drilled back to its root, or unmounted). */
  release: (id: string) => void
}

/** Null when no host provides a slot → consumers fall back to their own in-body UI. */
export const BreadcrumbSlotContext = createContext<BreadcrumbSlot | null>(null)

/** The reader a nested editor uses to promote its breadcrumb (or null → render local). */
export function useBreadcrumbSlot(): BreadcrumbSlot | null {
  return useContext(BreadcrumbSlotContext)
}

interface Entry { id: string; order: number; node: ReactNode }

export interface BreadcrumbHost {
  /** Pass to `<BreadcrumbSlotContext.Provider value=…>` around the host's body. */
  slot:      BreadcrumbSlot
  /** The promoted breadcrumb to render in the host chrome, or null → default chrome. */
  promoted:  ReactNode | null
}

/**
 * The HOST side: owns the promoted-breadcrumb stack. The host renders `promoted` in
 * its chrome when non-null (a drill is active), else its default (e.g. the dock's
 * context switch) — the mutual exclusion that guarantees exactly one header tier.
 */
export function useBreadcrumbHost(): BreadcrumbHost {
  const [entries, setEntries] = useState<Entry[]>([])
  const orderRef = useRef(0)

  const promote = useCallback((id: string, node: ReactNode) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.id === id)
      const order    = existing?.order ?? (orderRef.current += 1)
      const rest     = prev.filter((e) => e.id !== id)
      return [...rest, { id, order, node }].sort((a, b) => a.order - b.order)
    })
  }, [])

  const release = useCallback((id: string) => {
    setEntries((prev) => (prev.some((e) => e.id === id) ? prev.filter((e) => e.id !== id) : prev))
  }, [])

  const slot     = useMemo<BreadcrumbSlot>(() => ({ promote, release }), [promote, release])
  const promoted = entries.length ? entries[entries.length - 1].node : null

  return { slot, promoted }
}
