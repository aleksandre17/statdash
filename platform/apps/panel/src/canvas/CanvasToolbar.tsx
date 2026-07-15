// ── CanvasToolbar — preview-mode control + fail-soft badge (W1 · C2) ───────────
//
//  The small chrome above the WYSIWYG canvas. Two responsibilities:
//    1. A live | structural segmented toggle. LIVE is the DEFAULT (the canvas never
//       lies — Canon C2): real data paints by default; STRUCTURAL is an explicit
//       opt-out perf mode that the veil (CanvasView) declares honestly so its empty
//       shells are never mistaken for real values.
//    2. A non-blocking badge when live was requested but is unavailable
//       (no cube-bound source / profile error / API unreachable) — the canvas
//       keeps rendering the structural preview underneath, HONESTLY veiled.
//
//  Perspective is NOT switched here anymore (W1 · G9): a page's own perspective-bar
//  node renders faithfully ON the canvas as content, and the perspective PREVIEW is
//  authored/switched in the dock Perspectives pane (the P-final SSOT). A second
//  perspective tab-bar in this chrome duplicated the page's own bar side-by-side and
//  confused the surface — it is removed so there is ONE perspective model.
//
//  Accessibility (WCAG 2.1 AA / WAI-ARIA):
//    • The mode toggle is a `radiogroup` of two `radio` buttons (single-choice) —
//      full keyboard operability, screen-reader announces the selected mode.
//    • The badge is a `status` live-region with an icon + TEXT (no color-only
//      signal): the "unavailable" meaning is carried by words, not just hue.
//
//  Separation of concerns: pure presentational + a callback. All mode/availability
//  logic lives in useLivePreviewStores; this component only renders state.
//
//  Strings: Georgian (ka) — the panel's authoring locale (Law-4 i18n is the
//  engine/runtime concern; the Constructor chrome is single-locale ka like the
//  rest of apps/panel, e.g. PageStep). Kept inline alongside the other ka chrome.
//
import type { PreviewMode, PreviewStatus } from './useLivePreviewStores'
import { BreakpointSwitcher } from '../studio/BreakpointSwitcher'

/** The canvas theme-PREVIEW mode — a Studio view-state, NOT authored config. */
export type ThemePreview = 'light' | 'dark'

export interface CanvasToolbarProps {
  mode:         PreviewMode
  status:       PreviewStatus
  onModeChange: (mode: PreviewMode) => void
  /** The Studio dark-preview state (distinct from the page's authored AppHeader toggle). */
  themePreview:         ThemePreview
  onThemePreviewChange: (theme: ThemePreview) => void
}

// Live leads — it is the default reality of the canvas (C2). Structural follows as
// the explicit opt-out.
const MODE_OPTIONS: ReadonlyArray<{ value: PreviewMode; label: string }> = [
  { value: 'live',       label: 'ცოცხალი მონაცემები' },
  { value: 'structural', label: 'სტრუქტურა' },
]

// The theme-preview options — a Studio control (light | dark), icon + text (never
// colour/icon alone — Law 9). Distinct from the page's authored sun/moon chrome: this
// previews the tool's render, it does not edit the page.
const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreview; label: string; icon: string }> = [
  { value: 'light', label: 'ნათელი', icon: '☀' },
  { value: 'dark',  label: 'მუქი',   icon: '☾' },
]

export function CanvasToolbar({
  mode, status, onModeChange, themePreview, onThemePreviewChange,
}: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar" data-testid="canvas-toolbar">
      {/* Active-breakpoint switcher — the Builder.io / Framer control. Picking a
          breakpoint retargets per-breakpoint authoring AND constrains the canvas
          preview width so the page reflows live via the container-query cascade. */}
      <BreakpointSwitcher />

      <div
        className="canvas-toolbar__modes"
        role="radiogroup"
        aria-label="გადახედვის რეჟიმი"
      >
        {MODE_OPTIONS.map((opt) => {
          const active = mode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`canvas-toolbar__mode${active ? ' canvas-toolbar__mode--active' : ''}`}
              onClick={() => onModeChange(opt.value)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Theme PREVIEW — see the page in light / dark without editing the config. A
          Studio control, not the authored AppHeader toggle (which is page content). */}
      <div
        className="canvas-toolbar__modes"
        role="radiogroup"
        aria-label="გადახედვის თემა"
        data-testid="canvas-theme-preview"
      >
        {THEME_OPTIONS.map((opt) => {
          const active = themePreview === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`canvas-toolbar__mode${active ? ' canvas-toolbar__mode--active' : ''}`}
              onClick={() => onThemePreviewChange(opt.value)}
            >
              <span aria-hidden="true" className="canvas-toolbar__mode-icon">{opt.icon}</span>
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Fail-soft badge — only when live was requested but could not mount. Icon
          + text (no color-only signal), announced politely to assistive tech. */}
      {status === 'unavailable' && (
        <span
          className="canvas-toolbar__badge"
          role="status"
          data-testid="canvas-live-unavailable"
        >
          <span aria-hidden="true" className="canvas-toolbar__badge-icon">⚠</span>
          ცოცხალი მონაცემები მიუწვდომელია — ნაჩვენებია სტრუქტურა
        </span>
      )}
    </div>
  )
}
