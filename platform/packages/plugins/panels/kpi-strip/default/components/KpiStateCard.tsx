import './kpi.css'
import type { ReactNode } from 'react'
import type { ValueState } from '@statdash/engine'

// ── KpiStateCard — the honest INTERPRET-DERIVED state of a KPI card (AR-52 · Law 11) ─
//
//  The sibling of KpiUnboundCard. Where KpiUnboundCard renders the STATIC unbound state
//  (a measure never chosen — known without a store read), THIS renders the states only
//  the interpreter can see AFTER reading: `no-data` (the spec IS bound but the store has
//  no observation at the coordinate) and `masked` (SDMX OBS_STATUS 'c' — confidential,
//  the value must NOT be published). Both are the difference between an honest tool and
//  one that renders a fabricated `0` (the data-integrity breach Law 11 forbids).
//
//  The value the interpreter withholds never reaches this leaf — KpiDef.value is a
//  placeholder the shell discards when `state !== 'ok'`; this card shows the DECLARED
//  affordance instead. Layout-identical to KpiCard/KpiUnboundCard (same `.kpi-card` box)
//  so the strip grid never reflows between ok, unbound, no-data and masked tiles.
//
//  Accessibility (WCAG 2.1 AA / Law 9): meaning is carried by ICON + TEXT, never colour
//  alone; the tile is a `group` labelled by its own title. Strings are supplied by the
//  shell (useT('kpi-strip')) — never hardcoded here (Law 1 / Law 4): the leaf is pure.
//

/** The interpret-derived non-ok states this leaf renders (unbound has its own card). */
export type KpiHonestState = Exclude<ValueState, 'ok' | 'unbound'>

export interface KpiStateCardProps {
  /** Which honest state — drives the icon and the `data-kpi-state` hook. */
  state:  KpiHonestState
  /** The card's own localized label — so the author sees WHICH tile it is. */
  label?: string
  /** Localized headline for the state (e.g. "No data" / "Confidential"). */
  title:  string
  /** Localized secondary line explaining the state. */
  hint?:  string
}

function StateIcon({ state }: { state: KpiHonestState }): ReactNode {
  const common = {
    width: '26', height: '26', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: '1.5',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true, focusable: false as const,
  }
  if (state === 'masked') {
    // A lock — the confidential/suppressed cell.
    return (
      <svg {...common}>
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    )
  }
  if (state === 'error') {
    // Alert triangle.
    return (
      <svg {...common}>
        <path d="M12 3 2 20h20L12 3z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  // no-data (and loading fallback) — an empty database cylinder.
  return (
    <svg {...common}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </svg>
  )
}

export default function KpiStateCard({ state, label, title, hint }: KpiStateCardProps): ReactNode {
  return (
    <div
      className={`kpi-card kpi-card--state kpi-card--${state}`}
      role="group"
      aria-label={label ? `${label} — ${title}` : title}
      data-kpi-state={state}
    >
      {label && <div className="kpi-label">{label}</div>}
      <div className="kpi-unbound">
        <span className="kpi-unbound__icon"><StateIcon state={state} /></span>
        <span className="kpi-unbound__text">
          <span className="kpi-unbound__title">{title}</span>
          {hint && <span className="kpi-unbound__hint">{hint}</span>}
        </span>
      </div>
    </div>
  )
}
