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
//  Escalating unmounts the dock (the focus-view is a separate screen), so a stale
//  value closure would go dead. A request stays live in ONE of two ways, and that is
//  the ONLY axis of variation — one port, one container (SL-5 generalization):
//    • NODE-FIELD (SL-4) — the subject is a top-level FIELD on the selected node. The
//      request carries its LOCATION (`fieldPath`) and the HOST builds a live
//      `FieldBinding` from the store each render, handing it to `render(bind)`.
//    • SELF-BOUND (SL-5) — the subject is NOT a node field (a PAGE-scoped pipeline —
//      `page.meta.*`). Its editor already sources its OWN live state through a store
//      hook, so the host has nothing to bind: it just mounts `render()`. This is why a
//      page-scoped escalation needs no selection.
//  A new source kind is additive (OCP): the mechanism — open a focus-view target — is
//  unchanged; only how the escalated editor re-derives its live state differs.
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

/** Bilingual context title for the focus-view chrome + breadcrumb (the subject's own
 *  name — author content, resolved per-locale by the shell). Law 9. */
interface FocusEscalationTitled {
  title: { ka: string; en: string }
}

/** NODE-FIELD source (SL-4): the escalated subject is a top-level FIELD on the selected
 *  node; the host binds it live from the store and hands `render` the `FieldBinding`. */
export interface NodeFieldEscalation extends FocusEscalationTitled {
  source: 'node-field'
  /** Dot-path of the TOP-LEVEL field on the selected node — the host reads/writes it
   *  live to build the `FieldBinding`. The escalated editor is rooted here. */
  fieldPath: string
  /**
   * When set, bind `fieldPath` on THIS node — the data OWNER — instead of the selected
   * node (card 0112 · S2). A data-LESS inheriting child (chart/table) whose rows come from
   * an ancestor section routes its Data door to the OWNER's `data`, so an edit reshapes the
   * shared inherited spec — never a fresh copy on the child that would SHADOW it (Law 11).
   * Absent ⇒ the historical behaviour: bind the selected node's own field.
   */
  ownerId?: string
  /** Mount the workspace editor from the host's live field binding. Owned by the
   *  producer (it knows the drill path to replay); the host only supplies `bind`. */
  render: (bind: FieldBinding) => ReactNode
}

/** SELF-BOUND source (SL-5): the escalated editor sources its OWN live state (a store
 *  hook), so it needs no host binding — the host merely mounts it in the focus-view.
 *  For subjects that are NOT a field on the selected node (page-scoped pipelines). */
export interface SelfBoundEscalation extends FocusEscalationTitled {
  source: 'self-bound'
  render: () => ReactNode
}

/** What a producer hands the host to open a workspace subject in a focus-view. The two
 *  variants are the two ways it stays live across the dock→screen unmount. */
export type FocusEscalationRequest = NodeFieldEscalation | SelfBoundEscalation

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
