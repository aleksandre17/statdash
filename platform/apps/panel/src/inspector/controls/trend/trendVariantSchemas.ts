// ── trendVariantSchemas — the declarative per-variant authoring schemas (ADR-049 P2a) ──
//
//  The TrendField authors a `KpiTrendSpec` — a discriminated union over `type`:
//    • 'yoy'    — year-on-year %      → a governed measure (+ optional year pin)
//    • 'cagr'   — compound annual GR  → a governed measure + from/to years
//    • 'share'  — a computed ratio    → a num / denom ObsRef pair (measure + year each)
//    • 'static' — a user-facing caption + a direction glyph (up/down/flat/none)
//
//  Each variant DECLARES its fields as a PropSchema, projected through the SAME generic
//  Inspector the whole node + the EventsField arms use (no bespoke per-variant form — the
//  Bounded-Element mandate). A governed measure is an `enum-ref source:'metrics'` (the
//  author picks a GOVERNED noun, never a raw code — Law 2), identical to the KPI item's
//  own `value.measure`. Pure data + engine types only (no React) — trivially testable.
//
import type { PropField, PropSchema } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/engine'

/** The KpiTrendSpec discriminants a trend may take (the union's `type` tags). */
export type TrendType = 'yoy' | 'cagr' | 'share' | 'static'

/** Bilingual labels for the discriminant selector (Law 4 — labels live in the app tier). */
export const TREND_TYPE_LABELS: Record<TrendType, LocaleString> = {
  yoy:    { ka: 'წლიური % (YoY)', en: 'Year-on-year %' },
  cagr:   { ka: 'CAGR',           en: 'CAGR' },
  share:  { ka: 'წილი',           en: 'Share' },
  static: { ka: 'ტექსტური წარწერა', en: 'Static caption' },
}

/** The clear-trend option (a card MAY have no trend — absent ⇒ no trend line). */
export const TREND_NONE = 'none'

const MEASURE_FIELD: PropField = {
  field: 'measure', type: 'enum-ref', source: 'metrics', required: true,
  label: { ka: 'მეტრიკა', en: 'Metric' },
}
const YEAR_FIELD = (label: LocaleString): PropField => ({ field: 'time', type: 'number', label })
const FROM_FIELD: PropField = { field: 'from', type: 'number', label: { ka: 'დან (წელი)', en: 'From (year)' } }
const TO_FIELD:   PropField = { field: 'to',   type: 'number', label: { ka: 'მდე (წელი)', en: 'To (year)' } }

// An ObsRef sub-editor — a governed measure read at an optional year pin. Reused by the
// `share` num/denom pair (each projected as a drill-in object via itemSchema).
const OBSREF_SCHEMA: PropSchema = [
  MEASURE_FIELD,
  { field: 'time', type: 'number', label: { ka: 'წელი', en: 'Year' } },
]

/** The per-variant field schemas — the SSOT the TrendField projects (OCP: a new variant
 *  is a new entry, the control body unchanged). */
export const TREND_VARIANT_SCHEMAS: Record<TrendType, PropSchema> = {
  yoy: [
    MEASURE_FIELD,
    YEAR_FIELD({ ka: 'წელი', en: 'Year' }),
  ],
  cagr: [
    MEASURE_FIELD,
    FROM_FIELD,
    TO_FIELD,
  ],
  share: [
    { field: 'num',   type: 'object', itemSchema: OBSREF_SCHEMA, label: { ka: 'მრიცხველი',   en: 'Numerator' } },
    { field: 'denom', type: 'object', itemSchema: OBSREF_SCHEMA, label: { ka: 'მნიშვნელი', en: 'Denominator' } },
  ],
  static: [
    { field: 'value', type: 'LocaleString', coverage: 'localized', required: true, label: { ka: 'წარწერა', en: 'Caption' } },
    {
      field: 'dir', type: 'string', label: { ka: 'მიმართულება', en: 'Direction' },
      options: [
        { value: 'up',   label: { ka: 'ზრდა',      en: 'Up' } },
        { value: 'down', label: { ka: 'კლება',     en: 'Down' } },
        { value: 'flat', label: { ka: 'უცვლელი',   en: 'Flat' } },
        { value: 'none', label: { ka: 'ნეიტრალური', en: 'Neutral' } },
      ],
    },
  ],
}

/** The ordered discriminants (the selector's option order). */
export const TREND_TYPES: TrendType[] = ['yoy', 'cagr', 'share', 'static']

/**
 * Seed a default trend value for a chosen discriminant — the minimal valid shell the
 * author then fills through the projected fields. Pure DATA (Law 2 — no functions).
 */
export function makeTrendDefault(type: TrendType): Record<string, unknown> {
  switch (type) {
    case 'yoy':    return { type: 'yoy' }
    case 'cagr':   return { type: 'cagr' }
    case 'share':  return { type: 'share', num: {}, denom: {} }
    case 'static': return { type: 'static', dir: 'up' }
  }
}

/**
 * Change a trend's discriminant, CARRYING OVER any field the new variant also declares
 * (e.g. `measure` survives a yoy↔cagr switch) — so re-picking the type is not a silent
 * data wipe. `'none'` clears the trend entirely (returns undefined).
 */
export function retypeTrend(
  current: Record<string, unknown> | undefined,
  next: TrendType | typeof TREND_NONE,
): Record<string, unknown> | undefined {
  if (next === TREND_NONE) return undefined
  const keep = new Set(TREND_VARIANT_SCHEMAS[next].map((f) => f.field))
  const carried = Object.fromEntries(
    Object.entries(current ?? {}).filter(([k]) => k !== 'type' && keep.has(k)),
  )
  return { ...makeTrendDefault(next), ...carried }
}
