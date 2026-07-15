// ── threshold.ts — declarative numeric-breakpoint → presentation (token-bound) ─
//
//  The ORDERED-NUMERIC sibling of value-mapping (config/value-mapping.ts). Where a
//  ValueMapping is a first-match-wins list over HETEROGENEOUS conditions (exact /
//  range / regex / empty), a ValueThreshold is a monotonic STEP FUNCTION over ONE
//  numeric axis: an ordered set of breakpoints, and a value takes the presentation of
//  the HIGHEST breakpoint it reaches (Grafana thresholds). The two are deliberately
//  SEPARATE grammars — the mental model differs (map specific values ⟂ colour a
//  continuum by breakpoint), so each stays a clean single-responsibility vocabulary
//  (SRP); Grafana itself ships them as two features for the same reason.
//
//  WHY `ValueThreshold`, NOT `Threshold` — the name `Threshold` is ALREADY taken by
//  the LEGACY chart FieldConfig model (field/config.ts): `{ value, color: '#hex' }`,
//  literal-hex, wired into the chart-series interpreters. That model predates the token
//  spine; `localeChartDef.ts` explicitly draws the ISP boundary "a table / KPI consumer
//  of FieldConfig must not inherit a chart concern". So this is the TOKEN-BOUND family's
//  own threshold (beside ValueMapping), NOT a widening of the chart FieldConfig.
//  CONVERGENCE DEBT (flagged): the chart Threshold should ultimately migrate to
//  token-binding too, unifying on ONE token-bound conditional-format grammar
//  (Strangler-Fig, Law 7) — a future generalization, out of this slice.
//
//  WHY core (the arrow): pure config + a pure resolver — no React, no styles, NO
//  colour resolution. The `token` is carried through as a KEY (a DATA_COLOR_TOKENS
//  entry, e.g. 'status.negative-fg'); the react/plugins consumer resolves it through
//  the token spine via `tokenCssVar`, so a threshold re-themes per tenant for free and
//  can never smuggle a hardcoded hex into config (Law 2 · Law 3). Mirrors the
//  value-mapping split exactly: type + resolver here, authoring face in apps/panel.
//
//  OCP (Law 8) — a threshold is ADDITIVE: an element with no thresholds resolves to
//  `null` (reference-identical presentation). Enriching the model (a new per-step
//  facet) is a new optional field, the resolver interface unchanged.
//
import type { LocaleString } from '../i18n/types'

// ── ValueThresholdStep — one breakpoint on the numeric axis ───────────────────
//
//  `from` is the INCLUSIVE lower bound the step owns (up to the next step's `from`).
//  An absent `from` is the BASE step (−∞) — the default presentation below the first
//  authored breakpoint (Grafana's "Base"). Steps need not be pre-sorted: the resolver
//  orders them, so authoring order is free (the list editor keeps a stable priority
//  view, but resolution is by numeric bound, not list index).
//
export interface ValueThresholdStep {
  /** Inclusive lower bound this step owns. Absent ⟺ the base step (−∞). */
  from?:  number
  /**
   * Semantic-token KEY from the registered palette (DATA_COLOR_TOKENS), e.g.
   * 'status.negative-fg'. NEVER a literal colour — the consumer resolves it through
   * the token spine, so the colour is tenant-overridable and contrast-governed.
   */
  token?: string
  /**
   * Directional glyph rendered beside the value — the NON-COLOUR signal (WCAG 1.4.1:
   * colour is never the sole channel). Bounded to the shared trend glyphs so the
   * rendered character is a declared, a11y-paired set, not free text.
   */
  glyph?: 'up' | 'down' | 'flat'
  /**
   * Optional state label (localized) — the accessible name for the matched step
   * ('below target', 'on track'). Carried as a LocaleString; the consumer collapses
   * it to the active locale. This is what makes a colour-only threshold accessible.
   */
  state?: LocaleString
}

/** An ordered set of numeric breakpoints (authoring order free — resolved by bound). */
export type ValueThreshold = readonly ValueThresholdStep[]

/** The presentation produced by the matched breakpoint (all facets optional). */
export interface ValueThresholdResult {
  token?: string
  glyph?: 'up' | 'down' | 'flat'
  state?: LocaleString
}

/** The effective lower bound of a step — the base step sorts/matches at −∞. */
function lowerBound(step: ValueThresholdStep): number {
  return step.from ?? Number.NEGATIVE_INFINITY
}

/**
 * resolveValueThreshold — resolve a numeric value to the presentation of the HIGHEST
 * breakpoint it reaches (Grafana step semantics). Pure + deterministic.
 *
 * HONEST (Law 11): a non-finite / null / undefined value — a no-data, masked, or
 * unbound cell lowered to "no number" — resolves to `null`, so NO threshold formatting
 * is applied to a value that does not exist (a fabricated 0 is never coloured). The
 * caller passes the raw numeric ONLY for a genuine `ok` cell.
 *
 * Returns `null` when: no thresholds authored · value is not a finite number · no step
 * matches (every `from` is above the value AND there is no base step) · the matched
 * step carries no presentation at all (nothing to apply).
 */
export function resolveValueThreshold(
  value: number | null | undefined,
  steps: ValueThreshold | undefined,
): ValueThresholdResult | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  if (!steps || steps.length === 0) return null

  // Order by numeric bound (base −∞ first), then walk up while the value reaches the
  // step — the last reached step is the match (a monotonic step function). Authoring
  // order is irrelevant to resolution; only the numeric bound is.
  const sorted = [...steps].sort((a, b) => lowerBound(a) - lowerBound(b))
  let matched: ValueThresholdStep | undefined
  for (const step of sorted) {
    if (value >= lowerBound(step)) matched = step
    else break
  }
  if (!matched) return null

  const { token, glyph, state } = matched
  // A matched step with no presentation contributes nothing (defer to the raw value).
  if (token === undefined && glyph === undefined && state === undefined) return null
  return { token, glyph, state }
}
