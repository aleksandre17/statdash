// ── focusEscalation — hand a workspace-weight drill OUT of the dock (SL-4) ──────
//
//  The dock is bounded (240–560px) and reserved for FORM-weight subjects. When the
//  nested-item editor is about to enter a subject the Placement Law weighs as
//  WORKSPACE (`resolveSurface('nested-item', …) === 'focus-view'` — a rich-type item,
//  a deep tree), it must NOT drill it into the dock (that is the reported cram). It
//  ESCALATES: it asks an ancestor HOST to open the subject in a SEPARATE focus-view
//  screen (SL-2), continuing the SAME breadcrumb spine.
//
//  ── The seam (mirrors `breadcrumbSlot` — DIP, the sanctioned direction) ────────
//  The PORT lives in the inspector layer (the escalation's PRODUCER); the HOST
//  (studio/StudioShell, which already renders the dock + owns the focus-view screen
//  state) IMPLEMENTS it. So the low-level module defines the interface and the
//  high-level module provides it — inspector never imports studio. A nested editor
//  rendered with NO host (unit tests, any other mount) reads a null escalation and
//  falls back to an in-dock drill, exactly as D7.1b did — zero regression, fail-soft.
//
//  ── Live binding, not a captured value ────────────────────────────────────────
//  Escalating unmounts the dock (the focus-view is a separate screen). So the request
//  carries the subject's LOCATION (`fieldPath` — the top-level field's dot-path on the
//  selected node) and a `render(bind)` that mounts the editor from a LIVE field
//  binding the HOST supplies out of the store. The escalated editor therefore edits
//  the real config live and returns loss-free — the store, not a stale closure, is the
//  source of truth.
//
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/** A live read/write binding to the escalated subject's ROOT field value. The host
 *  derives it from the store each render, so the focus-view editor stays live. */
export interface FieldBinding {
  /** Current value of the top-level field (the escalated editor's root). */
  value: unknown
  /** Write the whole field value back through the store (the host owns the write). */
  onChange: (next: unknown) => void
}

/** What a nested editor hands the host to open a workspace subject in a focus-view. */
export interface FocusEscalationRequest {
  /** Dot-path of the TOP-LEVEL field on the selected node — the host reads/writes it
   *  live to build the `FieldBinding`. The escalated editor is rooted here. */
  fieldPath: string
  /** Bilingual context title for the focus-view chrome + breadcrumb (the subject's
   *  own name — author content, resolved per-locale by the shell). Law 9. */
  title: { ka: string; en: string }
  /** Mount the workspace editor from the host's live field binding. Owned by the
   *  producer (it knows the drill path to replay); the host only supplies `bind`. */
  render: (bind: FieldBinding) => ReactNode
}

/** The host side — open a workspace subject in the focus-view screen. */
export interface FocusEscalation {
  escalate: (req: FocusEscalationRequest) => void
}

/** Null when no host provides escalation → consumers fall back to an in-dock drill. */
export const FocusEscalationContext = createContext<FocusEscalation | null>(null)

/** The reader a nested editor uses to escalate a workspace subject (or null → drill). */
export function useFocusEscalation(): FocusEscalation | null {
  return useContext(FocusEscalationContext)
}
