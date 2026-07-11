// ── SummaryCard — the constant-weight glance card for rich/opaque values (§3.1) ─
//
//  The acute right-side fix. A rich value (DataSpec · ChartDef · opaque object /
//  array, and any subject the Placement Law weighs heavy) NO LONGER renders as a
//  raw-JSON textarea (unbounded, illegible, "looks wrong"). It renders as a
//  CONSTANT-SIZE, *populated* card — a glance projection of what it IS
//  ("bar chart · GDP", "query · by year", "3 items") + one "Open editor →"
//  affordance that hands the full editor OUT to the law-derived depth (a focus-view
//  screen), never cramming the dock.
//
//  ── Why this is the structural fix, not a skin ─────────────────────────────────
//    • CONSTANT WEIGHT (FF-DOCK-CONSTANT-WEIGHT): the card is a fixed-height box by
//      CSS (clamped, ellipsised) — the dock's content is bounded BY CONSTRUCTION,
//      so it cannot overflow no matter how large the value is.
//    • NEVER BURIED (FF-SUMMARY-EVERYWHERE): `summarize()` is total (bespoke summary
//      or generic field-count) — every in-scope subject is visible + populated, even
//      though its editor lives elsewhere.
//    • NO RAW JSON (FF-NO-RAW-JSON-DEFAULT): the raw-JSON control leaves the default
//      path entirely (dev escape only, `rawJsonEscape`).
//
//  ── SummaryCardView (presentational) is the grammar's SSOT ─────────────────────
//  The bespoke SL-5 FiltersDrawer affordance ("N bars · M controls") is retired INTO
//  this component — it now renders `<SummaryCardView/>`, one visual grammar for every
//  glance card in the studio (no second card idiom).
//
import type { ReactNode } from 'react'
import type { FieldControlProps } from '../fieldControl.types'
import { summarize } from '../summarize'
import { useFocusEscalation } from '../focusEscalation'
import { isRawJsonEscapeEnabled } from '../rawJsonEscape'
import { readLocale, type LocaleStringValue } from '../localeString'
import { JsonControl } from './primitives'
import './SummaryCard.css'

// ── SummaryCardView — the presentational card (one visual grammar, SSOT) ────────
export interface SummaryCardViewProps {
  primary:    string
  secondary?: string
  badges?:    string[]
  /** Optional leading glyph (a small type/status indicator). */
  glyph?:     ReactNode
  /** When present, renders the "Open editor →" affordance wired to this handler. */
  onOpen?:    () => void
  /** Accessible label for the Open affordance (defaults to a generic open label). */
  openLabel?: string
  /** DOM id for the card root — the target of the Inspector's `<label htmlFor>`. */
  id?:        string
  /** Test hook — a stable data-testid on the card root. */
  testId?:    string
}

export function SummaryCardView({
  primary, secondary, badges, glyph, onOpen, openLabel = 'Open editor', id, testId = 'summary-card',
}: SummaryCardViewProps) {
  return (
    <div className="summary-card" id={id} role="group" aria-label={primary} data-testid={testId}>
      <div className="summary-card__body">
        <div className="summary-card__primary">
          {glyph && <span className="summary-card__glyph" aria-hidden="true">{glyph}</span>}
          <span className="summary-card__primary-text" title={primary}>{primary}</span>
          {badges?.map((b) => (
            <span key={b} className="summary-card__badge">{b}</span>
          ))}
        </div>
        {secondary && (
          <div className="summary-card__secondary" title={secondary}>{secondary}</div>
        )}
      </div>
      {onOpen && (
        <button
          type="button"
          className="summary-card__open"
          onClick={onOpen}
          aria-label={openLabel}
        >
          {openLabel} →
        </button>
      )}
    </div>
  )
}

// ── RichValueDetail — the escalated full-room view (W-A honest terminal) ─────────
//
//  Opened when the author clicks "Open editor" on a card. In the routed focus-view
//  (full room, not the dock), it shows the value's STRUCTURE as a read-only detail
//  list — legible, never JSON — and, ONLY behind the dev escape, the raw-JSON editor.
//  Real structured editing (governed picker · field-wells · drained schema) is the
//  Chart Studio stage (SPEC §3.2, W-C); this is the truthful W-A terminal that keeps
//  the subject visible without pretending to a Stage that does not exist yet.
//
function RichValueDetail({ field, value, onChange }: {
  field: FieldControlProps['field']
  value: unknown
  onChange: (next: unknown) => void
}) {
  const entries: Array<[string, unknown]> =
    Array.isArray(value)
      ? value.map((v, i) => [String(i), v])
      : value != null && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>)
        : []

  return (
    <div className="summary-detail" data-testid="summary-detail">
      {entries.length > 0 ? (
        <dl className="summary-detail__list">
          {entries.map(([k, v]) => (
            <div key={k} className="summary-detail__row">
              <dt className="summary-detail__key">{k}</dt>
              <dd className="summary-detail__val">
                {v != null && typeof v === 'object' ? '{…}' : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="summary-detail__empty">not set</p>
      )}

      {isRawJsonEscapeEnabled() && (
        <div className="summary-detail__raw">
          <JsonControl
            field={field}
            id={`raw-${field.field.replace(/\./g, '-')}`}
            value={value}
            locales={[]}
            locale={'en'}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}

// ── SummaryCard — the FieldControl (summarize + escalate) ────────────────────────
//  The live write happens through the escalation's FieldBinding (bind.onChange), not
//  the inline onChange — the card is a glance + an "open", never an inline editor.
export function SummaryCard({ field, id, value, locale }: FieldControlProps) {
  const summary    = summarize(field, value, locale)
  const escalation = useFocusEscalation()
  const label      = readLocale(field.label as unknown as LocaleStringValue, locale) || field.field

  const onOpen = escalation
    ? () =>
        escalation.escalate({
          source:    'node-field',
          fieldPath: field.field,
          title:     { ka: label, en: label },
          render:    (bind) => (
            <RichValueDetail field={field} value={bind.value} onChange={bind.onChange} />
          ),
        })
    : undefined

  return (
    <SummaryCardView
      primary={summary.primary}
      secondary={summary.secondary}
      badges={summary.badges}
      onOpen={onOpen}
      openLabel={`Open ${label}`}
      id={id}
      testId="summary-card"
    />
  )
}
