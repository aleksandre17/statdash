import { useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Box, Typography, Chip, Divider, Button, Tabs, Tab, IconButton, Tooltip } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import { Inspector, ChromeInspectorPanel } from '../inspector'
import { VisibilitySection } from '../features/visibility'
import { PageInspectorPanel } from '../features/page-config'
import { PerspectivesPane } from '../features/perspectives'
import { FiltersDrawer } from '../features/filters'
import { nodeContextEditors } from './nodeContextEditors'
import { StudioEmptyState } from './StudioEmptyState'
import type { VisibilityExpr } from '@statdash/engine'
import type { Locale } from '../types/constructor'
import type { CanvasController } from './useCanvasController'

// ── RightDock — the canonical tri-context inspector dock (AR-49 M4 Wave 7) ──────
//
//  The dock shows exactly ONE context, chosen by the active selection (owner idea 5:
//  "always show exactly what the active selection is"):
//    • an ELEMENT is selected (node or chrome) → its schema-driven Inspector fills
//      the dock — and ONLY it (no page panes padding a void beneath);
//    • nothing selected → the PAGE context (page config · perspectives · filters),
//      which is the idle default (no-worse-than-now: page authoring stays visible);
//    • no page exists → a single guided empty-state.
//  A persistent "Page" tab keeps page-scope authoring one gesture away even while a
//  node is selected (D8 tri-context; the "no worse than now" guardrail). The content
//  region is flex-fill so there is never a short island above a stacked remainder
//  (the reported dead-space defect) — fill-by-construction. The dock is collapsible
//  (canvas reclaims the space) and resizable.
//
//  Scope is DERIVED from selection: selecting an element switches to the element
//  context; deselecting (incl. canvas-background click, already `onSelect(null)`)
//  returns to the Page context. The "Page" tab is a manual peek that does not
//  disturb the canvas selection.

const DOCK_MIN_W = 240
const DOCK_MAX_W = 560
const clampWidth = (w: number) => Math.max(DOCK_MIN_W, Math.min(DOCK_MAX_W, w))

type DockScope = 'element' | 'page'

const T = {
  element:  { en: 'Element',           ka: 'ელემენტი' },
  page:     { en: 'Page',              ka: 'გვერდი' },
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
}

export function RightDock({ controller, locale, collapsed, onToggleCollapsed, width, onResize }: RightDockProps) {
  const {
    selected, pageId, chromeSel,
    patchProp, setVisibleWhen, deleteSelected, setPreviewPerspectiveId,
  } = controller

  // The selection key drives the context: element identity or null (→ Page).
  const selKey: string | null = chromeSel
    ? `chrome:${chromeSel.slot}:${chromeSel.key}`
    : selected?.id ?? null

  // Scope is DERIVED from selection, with a manual override that survives until the
  // selection changes (React's "adjust state during render" idiom — no effect). So
  // selecting an element shows the element context; deselecting returns to Page; and
  // clicking the "Page" tab peeks page-scope without disturbing the canvas selection.
  const [scopeOverride, setScopeOverride] = useState<DockScope | null>(null)
  const [prevSelKey, setPrevSelKey] = useState(selKey)
  if (selKey !== prevSelKey) {
    setPrevSelKey(selKey)
    setScopeOverride(null) // selection changed → follow the selection again
  }
  const scope: DockScope = scopeOverride ?? (selKey ? 'element' : 'page')
  const setScope = setScopeOverride

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

  // A type-specific Element-context augmentation (e.g. filter-bar → its controls,
  // authored through the filterSchema SSOT). Declarative seam — absent for nodes
  // fully covered by the generic Inspector. (D7.3 filter-bar control drill bridge.)
  const ContextEditor = selected ? nodeContextEditors[selected.type] : undefined

  const nodePanel = selected && (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Chip size="small" label={selected.type} color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
      <Inspector node={selected} onChange={patchProp} />
      {ContextEditor && (
        <>
          <Divider />
          <ContextEditor node={selected} locale={locale} />
        </>
      )}
      <Divider />
      <VisibilitySection
        value={(selected.props.view as { visibleWhen?: VisibilityExpr } | undefined)?.visibleWhen}
        onChange={setVisibleWhen}
      />
      <Divider />
      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={deleteSelected}>
        {t('del', locale)}
      </Button>
    </Box>
  )

  // ── Content — ONE context, flex-fill (never an island + stacked remainder) ────
  let content: React.ReactNode
  if (!pageId) {
    // No pages exist → a single guided empty-state that fills the region.
    content = <StudioEmptyState kind="no-pages" locale={locale} fill />
  } else if (scope === 'page') {
    // Page context — the page-scoped panes live HERE, never stacked beneath a node
    // Inspector (FF-RIGHTDOCK-CONTEXTUAL). They self-suppress when no page.
    content = (
      <Box className="studio-dock__page" sx={{ display: 'flex', flexDirection: 'column' }}>
        <PageInspectorPanel />
        <Divider sx={{ my: 1.5 }} />
        <PerspectivesPane onPreviewChange={setPreviewPerspectiveId} />
        <Divider sx={{ my: 1.5 }} />
        <FiltersDrawer />
      </Box>
    )
  } else if (chromeSel) {
    content = <ChromeInspectorPanel />
  } else if (selected) {
    content = nodePanel
  } else {
    // Element context with nothing selected → the single quiet hint, filling the region.
    content = <StudioEmptyState kind="no-selection" locale={locale} fill />
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

      <Box className="studio-dock__header">
        {pageId ? (
          <Tabs
            value={scope}
            onChange={(_, v: DockScope) => setScope(v)}
            variant="fullWidth"
            aria-label={t('overline', locale)}
            sx={{ minHeight: 36, flex: 1 }}
          >
            <Tab value="element" label={t('element', locale)} sx={{ minHeight: 36, py: 0 }} />
            <Tab value="page"    label={t('page', locale)}    sx={{ minHeight: 36, py: 0 }} />
          </Tabs>
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

      <Box className="studio-dock__content" data-testid="dock-content">
        {content}
      </Box>
    </Box>
  )
}
