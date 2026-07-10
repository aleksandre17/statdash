import type { ReactNode } from 'react'
import { ModelSurface } from './surfaces/ModelSurface'
import type { Locale } from '../types/constructor'
import type { FocusEscalationRequest, FieldBinding } from '../inspector/focusEscalation'

// ── Focus-view target registry (AR-49 SL-2, SPEC-studio-shell-layout §3.4) ─────
//
//  The Placement Law's heaviest container — the FOCUS-VIEW — is a SEPARATE Studio
//  screen a workspace-weight subject navigates OUT to (owner clarification §3.4:
//  the Notion full-page / Sanity document-route model, NOT a canvas overlay). This
//  registry is the OCP seam that makes the container extensible without touching its
//  shell: a new workspace editor (chart encoding, metric calc, filters pipeline)
//  REGISTERS a target here — one row — and `<FocusView>` renders it unchanged.
//
//  ── Why a data table, not a switch (mirrors RAIL_ENTRIES) ─────────────────────
//  A target is pure DATA: an id, a bilingual context title (the focus-view's top
//  chrome + breadcrumb identity — Law 9, no bare string leak), and a `render` that
//  produces its body. The shell dispatches by table lookup, never by
//  `if (id === 'data-model')` — so placement stays derived and uniform, and adding
//  a workspace editor is additive (open for extension, the shell closed to change).
//
//  ── Model mode is the first target (FF-MODEL-IS-FOCUSVIEW) ────────────────────
//  Model mode — the Steward's define workspace — was the un-generalized precedent
//  (an activeSurface that swapped the left dock). It re-homes here as the FIRST
//  registered target, proving the shell with zero capability change: the SAME
//  ModelSurface body now renders inside the shared `<FocusView>` screen instead of
//  the dock. ModelSurface's ONLY mount site is this registry — the shell no longer
//  references it directly.

export interface FocusViewRenderContext {
  locale: Locale
}

export interface FocusViewTarget {
  /** Stable id — the "route" key a caller navigates to. */
  id: string
  /** Bilingual context title (focus-view top chrome + breadcrumb). Law 9. */
  title: { ka: string; en: string }
  /** The workspace-weight editor body, rendered inside the shared shell. */
  render: (ctx: FocusViewRenderContext) => ReactNode
}

// The CLOSED target table — the whole focus-view vocabulary. A new workspace editor
// is one more row (OCP); SL-4/SL-5 register the element/nested-scoped targets
// (chart encoding, filters pipeline) here as the placement law escalates them out
// of the dock. Data, not a branch — mirrors `RAIL_ENTRIES`.
export const FOCUS_VIEW_TARGETS: Readonly<Record<string, FocusViewTarget>> = {
  'data-model': {
    id: 'data-model',
    title: { ka: 'მონაცემთა მოდელი', en: 'Data model' },
    render: ({ locale }) => <ModelSurface locale={locale} />,
  },
} as const

/** Resolve a target by id (undefined for an unknown id → the shell fails soft). */
export function getFocusViewTarget(id: string): FocusViewTarget | undefined {
  return FOCUS_VIEW_TARGETS[id]
}

export type FocusViewTargetId = keyof typeof FOCUS_VIEW_TARGETS

// ── Escalated (dynamic) target — the SL-4/SL-5 overflow subject ─────────────────
//
//  A workspace-weight subject escalated OUT of the dock is NOT a pre-registered route —
//  it is built at runtime from the escalation request. This factory is the registry's
//  constructor for that dynamic target, so the escalated subject rides the SAME
//  <FocusView> shell as the static targets (one container, no fork). It adapts to the
//  request's live-binding source: a NODE-FIELD subject is handed the host's live
//  `FieldBinding` (value+onChange out of the store); a SELF-BOUND subject mounts its own
//  store-hooked editor (no host binding — `bind` is null). Either way it edits real
//  config live and returns loss-free.
//
export const ESCALATED_TARGET_ID = 'escalated-subject'

export function makeEscalatedTarget(req: FocusEscalationRequest, bind: FieldBinding | null): FocusViewTarget {
  return {
    id:     ESCALATED_TARGET_ID,
    title:  req.title,
    render: () => (req.source === 'node-field' ? req.render(bind!) : req.render()),
  }
}
