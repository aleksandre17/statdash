import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Box, Button, Breadcrumbs, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { getFocusViewTarget, type FocusViewTarget } from './focusViewRegistry'
import { BreadcrumbSlotContext, useBreadcrumbHost } from '../inspector/breadcrumbSlot'
import type { Locale } from '../types/constructor'

// ── FocusView — the workspace-weight container as a SEPARATE Studio screen ──────
//  (AR-49 SL-2, SPEC-studio-shell-layout §3.4)
//
//  The heaviest surface of the Placement Law. Owner clarification (§3.4, binding):
//  a focus-view is NOT a canvas grid-area overlay — it is a SEPARATE Studio
//  page/screen you navigate OUT to (the Notion full-page / Sanity document-route
//  model), leaving the 4-column editing shell entirely, with a breadcrumb/back to
//  return. So when a focus-view is active, StudioShell renders THIS in place of the
//  rail + docks + canvas grid; the rail and dock are NOT the primary chrome here
//  (FF-FOCUSVIEW-SEPARATE-ROUTE). Only a MINIMAL top chrome — a breadcrumb-back +
//  the context title — orients the author.
//
//  ── The route mechanism ───────────────────────────────────────────────────────
//  The panel has no URL router at the shell level (App.tsx is an auth/boot state
//  machine; StudioShell paints the editing chrome directly). The faithful, minimal
//  realization of "a separate screen you navigate to and return from" is therefore
//  a SCREEN STATE, not a URL: the shell swaps its whole grid for this screen while a
//  target is active, and `onBack` returns to exactly where the author was (the shell
//  state — surface, selection, role — is untouched, so return is loss-free). Adding
//  react-router here would be a far larger change that fights the state-machine shell
//  for no gain at this step (see the SL-2 report / D-SL-2a).
//
//  ── Reusable + OCP ────────────────────────────────────────────────────────────
//  The shell is target-agnostic: it resolves the active target from the focus-view
//  REGISTRY and renders its body. A new workspace editor registers a target; this
//  shell is unchanged. Model mode is the first target (FF-MODEL-IS-FOCUSVIEW) — no
//  forked takeover, it composes this shell.
//
//  ── One breadcrumb spine (shared with the dock — SL-1) ────────────────────────
//  The focus-view is a HOST for the SAME breadcrumb slot the RightDock uses
//  (`inspector/breadcrumbSlot`): a nested drill inside the target body promotes its
//  crumb into THIS screen's top chrome, so field → item → workspace is ONE spine
//  whether the last frame is a dock-drill or a focus-view (§4). Dormant-but-correct
//  for Model (which does not drill today); live for future nested-drill targets.
//
//  ── Accessibility (WCAG 2.1 AA, Law 9) ────────────────────────────────────────
//  Focus MOVES into the screen on enter (the back control — a labelled, actionable
//  orientation anchor; 2.4.3 focus order) and RETURNS on back. Esc is a keyboard
//  escape hatch equivalent to back. The screen is a labelled landmark region; the
//  back trigger is a native <button> with a bilingual accessible name (4.1.2).

const T = {
  back:   { en: 'Back',           ka: 'უკან' },
  origin: { en: 'Compose',        ka: 'კომპოზიცია' },
  screen: { en: 'Focus view',     ka: 'ფოკუს-ხედი' },
} as const
const t = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

export interface FocusViewProps {
  /** The registered target to render (a focus-view "route" key) — a STATIC target
   *  (e.g. Model). Ignored when `target` is supplied directly. */
  targetId?: string
  /** A DYNAMIC target supplied directly (SL-4 overflow escalation): a workspace
   *  subject the dock escalated out, built at runtime rather than pre-registered.
   *  Takes precedence over `targetId`. */
  target?: FocusViewTarget
  locale: Locale
  /** Return to the editing shell (breadcrumb-back / Esc). Loss-free — shell state persists. */
  onBack: () => void
}

export function FocusView({ targetId, target, locale, onBack }: FocusViewProps) {
  // A directly-supplied dynamic target (SL-4 escalation) wins; else resolve a static
  // one from the registry. Both render through the SAME shell — the escalated
  // workspace subject and Model share one focus-view container (OCP).
  const resolved = target ?? (targetId ? getFocusViewTarget(targetId) : undefined)
  const backRef = useRef<HTMLButtonElement>(null)

  // WCAG 2.4.3 — move focus INTO the screen on enter. The back control is the
  // orientation anchor: keyboard-first return is one key away, Tab forward reaches
  // the workspace. Runs after the target body mounts (parent effect), so it wins
  // even if the body grabs focus for its own region.
  useEffect(() => { backRef.current?.focus() }, [targetId, resolved])

  // Share the SL-1 breadcrumb spine: a nested drill inside the body promotes its
  // crumb up here (one navigation spine, dock-drill ↔ focus-view).
  const { slot, promoted } = useBreadcrumbHost()

  // Fail-soft: an unknown target id must never strand the author on a blank screen —
  // return to the shell rather than render nothing (defensive; the registry is the SSOT).
  if (!resolved) {
    onBack()
    return null
  }

  const title = resolved.title[locale] ?? resolved.title.en

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      onBack()
    }
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={title || t('screen', locale)}
      className="studio-focusview"
      onKeyDown={onKeyDown}
    >
      {/* MINIMAL top chrome — breadcrumb-back + context title (the only chrome; the
          rail/dock do NOT persist here — this is a separate screen, §3.4). */}
      <Box component="header" className="studio-focusview__header">
        <Button
          ref={backRef}
          size="small"
          color="inherit"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={onBack}
          aria-label={t('back', locale)}
          className="studio-focusview__back"
        >
          {t('back', locale)}
        </Button>
        <Breadcrumbs aria-label={title} className="studio-focusview__crumbs">
          <Typography variant="body2" color="text.secondary">{t('origin', locale)}</Typography>
          <Typography variant="body2" color="text.primary" aria-current="page">{title}</Typography>
          {/* A deeper drill inside the body, if any — the shared spine continues here. */}
          {promoted}
        </Breadcrumbs>
      </Box>

      {/* BODY — the workspace editor, rendered from the registry. Provides the shared
          breadcrumb slot so a nested drill promotes into this screen's chrome. */}
      <BreadcrumbSlotContext.Provider value={slot}>
        <Box component="main" className="studio-focusview__body">
          {resolved.render({ locale })}
        </Box>
      </BreadcrumbSlotContext.Provider>
    </Box>
  )
}
