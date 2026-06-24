// ── CanvasToolbar — preview-mode control + fail-soft badge (G3.1) ─────────────
//
//  The small chrome above the WYSIWYG canvas. Two responsibilities:
//    1. A structural | live segmented toggle (the author opts into live data).
//    2. A non-blocking badge when live was requested but is unavailable
//       (no cube-bound source / profile error / API unreachable) — the canvas
//       keeps rendering the structural preview underneath.
//
//  Accessibility (WCAG 2.1 AA / WAI-ARIA):
//    • The toggle is a `radiogroup` of two `radio` buttons (single-choice) — full
//      keyboard operability, screen-reader announces the selected mode.
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

export interface CanvasToolbarProps {
  mode:         PreviewMode
  status:       PreviewStatus
  onModeChange: (mode: PreviewMode) => void
}

const MODE_OPTIONS: ReadonlyArray<{ value: PreviewMode; label: string }> = [
  { value: 'structural', label: 'სტრუქტურა' },
  { value: 'live',       label: 'ცოცხალი მონაცემები' },
]

export function CanvasToolbar({ mode, status, onModeChange }: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar" data-testid="canvas-toolbar">
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
