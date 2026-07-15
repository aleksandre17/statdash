import { useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Box, Typography, Button, IconButton, Tooltip } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import { SITE_FRAME_ID } from '@statdash/react/engine'
import { DockBody, registerBuiltinDockSections } from '../inspector/sections'
import { useRole } from './useRole'
import { StudioEmptyState } from './StudioEmptyState'
import { BreadcrumbSlotContext, useBreadcrumbHost } from '../inspector/breadcrumbSlot'
import type { Locale } from '../types/constructor'
import type { CanvasController } from './useCanvasController'

// The dock body composes from ONE section registry (SPEC §3.1). Register the
// built-ins on module load — idempotent, so boot/HMR/tests all share one grammar.
registerBuiltinDockSections()

// ── RightDock — the purely-contextual inspector dock (SPEC-studio-ia-canonical S1) ─
//
//  The dock is a PURE PROJECTION of the ONE active selection address (SPEC §3.2 —
//  the Figma/Framer law: show the selection's contract and nothing else):
//    • an ELEMENT is selected (node / part / chrome) → ONLY its own declared
//      contract fills the dock — never a page-config tab stapled alongside;
//    • NOTHING selected → the PAGE context (page config · perspectives · filters).
//      Page authoring is reached by DESELECTING (canvas-background click, already
//      `onSelect(null)`), not by a persistent tab — so page-config never bleeds
//      into an element's surface (the owner's "right dock shows page-config out of
//      place" defect, resolved by removing the persistent Element|Page switch);
//    • no page exists → a single guided empty-state.
//
//  ── The 3-zone contract (SL-1 — one header tier, never a collision) ───────────
//  The dock is a HEADER / BODY / FOOTER structure (SPEC-studio-shell-layout §6):
//    • HEADER — exactly ONE tier: an Inspector overline, REPLACED BY the drill
//      breadcrumb when the author has drilled into a nested item (D7.1b promotes it
//      here via the breadcrumb slot). Mutually exclusive — never both stacked.
//    • BODY — the sole flex-fill scroll region: the facet-grouped Inspector (its
//      group accordion/tabs, M4 §2.11) + the active form, or a single guided
//      empty-state. Fill-by-construction so a short form never strands a void.
//    • FOOTER — the element actions (Delete), a fixed tier that stays reachable
//      regardless of how far the body scrolls.
//
//  Scope is DERIVED from selection — no manual override, no peek tab: selecting an
//  element switches to the element context; deselecting returns to the Page context.

const DOCK_MIN_W = 240
const DOCK_MAX_W = 560
const clampWidth = (w: number) => Math.max(DOCK_MIN_W, Math.min(DOCK_MAX_W, w))

type DockScope = 'element' | 'page'

const T = {
  collapse: { en: 'Collapse inspector', ka: 'ინსპექტორის ჩაკეცვა' },
  expand:   { en: 'Expand inspector',   ka: 'ინსპექტორის გაშლა' },
  resize:   { en: 'Resize inspector',   ka: 'ინსპექტორის ზომის შეცვლა' },
  overline: { en: 'Inspector',          ka: 'ინსპექტორი' },
  del:      { en: 'Delete',             ka: 'წაშლა' },
} as const
const t = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

export interface RightDockProps {
  controller:         CanvasController
  locale:             Locale
  collapsed:          boolean
  onToggleCollapsed:  () => void
  /** Current dock width (px) — owned by StudioShell so the grid column resizes. */
  width:              number
  onResize:           (next: number) => void
  /**
   * True when a PROJECT-SCOPE surface (Site / Style) owns the LEFT dock. In that
   * authoring context the right inspector's default page tree would DOUBLE the
   * context (two competing "what am I editing?" surfaces), so with nothing selected
   * the dock shows a quiet orientation hint instead — one clear authoring focus
   * (AR-52 · Least Astonishment). A deliberate element selection still wins.
   */
  siteContext?:       boolean
}

export function RightDock({ controller, locale, collapsed, onToggleCollapsed, width, onResize, siteContext = false }: RightDockProps) {
  const { selected, pageId, deleteSelected, selectedItemPath, selectedBand, selectedId } = controller
  // The active audience lens (root Law 11) — passed into every dock ctx so facet
  // sections filter by plane (a steward facet hides from the author dock).
  const role = useRole()

  // Scope is PURELY derived from the ONE selection — an element selected shows only its
  // contract; deselecting returns to Page. No override, no persistent tab (SPEC §3.2 —
  // page-config never bleeds into an element's surface). An element is selected when a
  // page node is (`selected`) OR a bounded PART is (`selectedBand`) — the latter covers a
  // chrome region, whose owning site-frame is not a page node (S6: chrome is a Part, no
  // `chromeSel` species).
  //  The site-frame is a reachable WHOLE element (D-CH1) even though it is not a page node
  //  (`selected` is null for it) and has no drilled part — its selection is the synthetic
  //  SITE_FRAME_ID. It resolves to the element scope so its chrome-composition inspector
  //  shows (not the page context).
  const scope: DockScope =
    (selected || selectedBand || selectedId === SITE_FRAME_ID) ? 'element' : 'page'

  // The one-header-tier seam: a drilled nested editor (D7.1b) in the body PROMOTES
  // its breadcrumb up here; while promoted the header shows the breadcrumb XOR the
  // Inspector overline — never both. Absent a drill, `promoted` is null → overline.
  const { slot: breadcrumbSlot, promoted } = useBreadcrumbHost()

  // ── Resize (pointer-drag on the left edge + keyboard on the separator) ────────
  const dragRef = useRef<{ x: number; w: number } | null>(null)
  const onResizeDown = (e: ReactPointerEvent) => {
    dragRef.current = { x: e.clientX, w: width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e: ReactPointerEvent) => {
    const s = dragRef.current
    if (!s) return
    onResize(clampWidth(s.w + (s.x - e.clientX)))
  }
  const onResizeUp = (e: ReactPointerEvent) => {
    dragRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const onResizeKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowLeft')       onResize(clampWidth(width + 16)) // grow toward canvas
    else if (e.key === 'ArrowRight') onResize(clampWidth(width - 16))
    else return
    e.preventDefault()
  }

  // ── Collapsed: a slim strip; the canvas has reclaimed the space (no void) ─────
  if (collapsed) {
    return (
      <Box className="studio-dock studio-dock--collapsed">
        <Tooltip title={t('expand', locale)} placement="left">
          <IconButton size="small" aria-label={t('expand', locale)} onClick={onToggleCollapsed}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  // FOOTER — element actions. Present only in the element context with a WHOLE page node
  // selected. A bounded part (a band item, or a chrome region — whose `selected` page node
  // is absent) carries no destructive action here: `deleteSelected` acts on the owning
  // node, so offering "Delete" under a card/region would misleadingly remove the whole
  // owner (least astonishment — the footer follows the bounded selection, ADR-038).
  const footer = scope === 'element' && selected && !selectedItemPath && (
    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={deleteSelected}>
      {t('del', locale)}
    </Button>
  )

  // ── Content — ONE context, composed from the section grammar (§3.1) ───────────
  //  The dock body is the applicable sections from `dockSectionRegistry`, rendered
  //  by <DockBody> through one divider grammar. The empty state (no page) is not a
  //  section. Element scope implies a live selection (selKey ⟹ selected || chrome),
  //  so the "nothing selected" hole is unrepresentable — deselecting IS the Page
  //  context, never a void.
  let content: React.ReactNode
  if (!pageId) {
    // No pages exist → a single guided empty-state that fills the region.
    content = <StudioEmptyState kind="no-pages" locale={locale} fill />
  } else if (scope === 'page' && siteContext) {
    // A project-scope surface (Site / Style) owns the left dock — showing the page
    // tree here too would double the authoring context. One quiet orientation hint
    // instead; a deliberate element selection still switches to the element scope.
    content = <StudioEmptyState kind="site-context" locale={locale} fill />
  } else if (scope === 'page') {
    content = <DockBody ctx={{ scope: 'page', locale, controller, role }} />
  } else {
    // Element context — the chrome panel OR the node's schema/context/visibility
    // sections; the registry's `appliesTo` picks the right set (mutually exclusive).
    content = <DockBody ctx={{ scope: 'element', locale, controller, role }} />
  }

  return (
    <Box className="studio-dock">
      {/* Resize separator on the dock's leading (canvas-facing) edge. */}
      <div
        className="studio-dock__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('resize', locale)}
        aria-valuenow={width}
        aria-valuemin={DOCK_MIN_W}
        aria-valuemax={DOCK_MAX_W}
        tabIndex={0}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onKeyDown={onResizeKey}
      />

      {/* HEADER — exactly ONE tier: the promoted drill breadcrumb XOR the Inspector
          overline (never both stacked). The collapse control is chrome, not a tier. */}
      <Box className="studio-dock__header">
        {promoted ? (
          <Box className="studio-dock__header-crumbs">{promoted}</Box>
        ) : (
          <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
            {t('overline', locale)}
          </Typography>
        )}
        <Tooltip title={t('collapse', locale)} placement="left">
          <IconButton size="small" aria-label={t('collapse', locale)} onClick={onToggleCollapsed}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* BODY — the sole flex-fill scroll region. The breadcrumb slot provider lets a
          drilled nested editor promote its breadcrumb up into the header. */}
      <BreadcrumbSlotContext.Provider value={breadcrumbSlot}>
        <Box className="studio-dock__content" data-testid="dock-content">
          {content}
        </Box>
      </BreadcrumbSlotContext.Provider>

      {/* FOOTER — element actions, a fixed tier (absent when there is nothing to act on). */}
      {footer && <Box className="studio-dock__footer">{footer}</Box>}
    </Box>
  )
}
