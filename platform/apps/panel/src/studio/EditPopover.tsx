import type { ReactNode } from 'react'
import { Box, Popover, Typography } from '@mui/material'
import { placeSubject, type SubjectShape } from './placement'

// ── EditPopover — the glance-weight micro-edit container (AR-49 SL-3) ───────────
//  (SPEC-studio-shell-layout §3.2 / §6 · completes the Placement Law container trio:
//   dock-panel/drill · focus-view · POPOVER.)
//
//  The LIGHTEST surface of the Placement Law. A single, transient property — a
//  recolor, a rename, a quick toggle — is `glance`-weight (§3.1). It must NOT take
//  over the dock or a screen; it POPS OVER, anchored to its trigger (a summary row
//  or a canvas element), and dismisses on Esc / click-away. This is the Figma color
//  / component-props popover, but its admission is LAW-GATED, not per-editor taste.
//
//  ── Placement-routed, glance-ONLY (FF-POPOVER-GLANCE-ONLY) ────────────────────
//  The container self-enforces the law: it derives WHERE its subject belongs from
//  the SAME primitive every surface uses — `placeSubject('micro-target', shape)`.
//  A single flat property lands on `popover` and is admitted; a subject whose
//  derived weight is heavier (nested → dock-drill, rich/over-depth → focus-view) is
//  REFUSED here — it must have been routed to its heavier container by the caller.
//  So "a form/workspace subject opens in a popover" is a state the container cannot
//  produce; the guard makes the boundary provable, not conventional.
//
//  ── Accessibility (WCAG 2.1 AA, Law 9) ────────────────────────────────────────
//  MUI `Popover` is Modal-based, so it FOCUS-TRAPS on open and RESTORES focus to the
//  anchoring trigger on close (2.4.3 focus order · 3.2.1 no context trap). Esc and
//  click-away both dismiss (2.1.2 no keyboard trap); the surface is a labelled
//  `role="dialog"` with the edit's title as its accessible name (4.1.2). The caller
//  hands a pre-resolved (already locale-correct) `title` — the container stays i18n-
//  agnostic and reusable for any glance edit.
//
//  Pure container: it owns placement-gating + a11y + anchoring ONLY; the single
//  control is the caller's `children` (OCP — recolor, rename, toggle all reuse it).

/** Why the popover closed — lets the caller commit vs cancel (Least Astonishment). */
export type EditPopoverCloseReason = 'escape' | 'backdrop' | 'commit'

export interface EditPopoverProps {
  open: boolean
  /** The trigger the popover anchors to (a row button or a canvas element frame). */
  anchorEl: HTMLElement | null
  /** Dismiss. `escape` conventionally cancels; `backdrop`/`commit` conventionally keep. */
  onClose: (reason: EditPopoverCloseReason) => void
  /** Visible header + the surface's accessible name (pre-resolved to the active locale). */
  title: string
  /** The subject's shape — the self-guard admits ONLY a glance subject. Default: a
   *  single flat property (`{ flatFields: 1 }`), the canonical micro-target. */
  shape?: SubjectShape
  /** The ONE glance control (a color swatch, a rename field, a toggle). */
  children: ReactNode
}

const GLANCE_SHAPE: SubjectShape = { flatFields: 1 }

export function EditPopover({
  open, anchorEl, onClose, title, shape = GLANCE_SHAPE, children,
}: EditPopoverProps) {
  // FF-POPOVER-GLANCE-ONLY — the law decides admission, not the call site. A subject
  // that resolves to any container OTHER than `popover` is heavier than glance and is
  // refused here (it belongs in the dock/focus-view). Never a form/workspace in a popover.
  const container = placeSubject('micro-target', shape)
  if (container !== 'popover') {
    if (import.meta.env?.DEV) {
      console.warn(
        `[EditPopover] a non-glance subject (→ ${container}) was routed to a popover; ` +
        `refusing. Route it via resolveSurface(scope, weight) to its proper container.`,
      )
    }
    return null
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={(_e, reason) =>
        onClose(reason === 'escapeKeyDown' ? 'escape' : 'backdrop')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': title,
          className: 'studio-edit-popover',
          sx: { p: 1.5, minWidth: 220, maxWidth: 320 },
        },
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}
      >
        {title}
      </Typography>
      <Box>{children}</Box>
    </Popover>
  )
}
