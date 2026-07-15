import './kpi.css'
import type { ReactNode } from 'react'

// ── KpiUnboundCard — the honest UNBOUND state of a KPI card (W1 · Canon C2) ─────
//
//  Grafana's "No data" panel state · Webflow/Framer's empty-slot affordance, for a
//  single KPI tile: when a card's measure was never chosen, it renders THIS instead
//  of a fabricated `0`. The card is honest AND an AFFORDANCE — it names the missing
//  binding and invites the author to choose a metric (the door to journey J4, which
//  Wave 2 lights up with the actual click/drag-to-bind).
//
//  Accessibility (WCAG 2.1 AA / Law 9): the meaning is carried by ICON + TEXT, never
//  colour alone; the tile is a `group` labelled by its own title so assistive tech
//  announces "unbound — pick a metric", not an empty cell. It stays layout-identical
//  to a real KpiCard (same `.kpi-card` box) so the strip grid never reflows between
//  bound and unbound tiles.
//
//  Strings are supplied by the shell (useT('kpi-strip')) — never hardcoded here
//  (Law 1 / Law 4): the leaf is pure/presentational.
//

export interface KpiUnboundCardProps {
  /** The card's own localized label — so the author sees WHICH tile is unbound. */
  label?: string
  /** Localized headline for the unbound state (e.g. "აუბმელი"). */
  title:  string
  /** Localized affordance line (e.g. "აირჩიე მეტრიკა"). */
  hint:   string
}

function UnboundIcon(): ReactNode {
  // 24×24 "unplugged link" glyph — currentColor so it inherits the muted state colour.
  return (
    <svg
      width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 3.5 8.54" />
      <path d="M8 12h3" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

export default function KpiUnboundCard({ label, title, hint }: KpiUnboundCardProps): ReactNode {
  return (
    <div
      className="kpi-card kpi-card--unbound"
      role="group"
      aria-label={label ? `${label} — ${title}` : title}
      data-kpi-state="unbound"
    >
      {label && <div className="kpi-label">{label}</div>}
      <div className="kpi-unbound">
        <span className="kpi-unbound__icon"><UnboundIcon /></span>
        <span className="kpi-unbound__text">
          <span className="kpi-unbound__title">{title}</span>
          <span className="kpi-unbound__hint">{hint}</span>
        </span>
      </div>
    </div>
  )
}
